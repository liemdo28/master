/**
 * Phase 4 acceptance.
 *
 * Runs every fixture through the *real* control plane — project registry, fresh
 * map, context pack, candidate ranking, isolated worktree, validation, review,
 * local commit — using the local LLM engine. The benchmark harness bypasses the
 * registry to isolate model capability; this deliberately does not, because the
 * question here is whether the whole pipeline works end to end.
 *
 * Every criterion is checked per task and reported individually. Acceptance
 * requires all fixtures to pass; anything less is reported as PARTIAL with the
 * specific tasks and criteria that failed, rather than rounded up.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { CodingWorkflow } from './workflow';
import { LLM_ENGINE_ID } from './llm/engine';
import { ProjectRegistryService } from '../project-registry/service';
import { TaskStore } from '../task-runtime/store';
import { FIXTURES, type Fixture } from './__fixtures__/fixtures';

interface CriterionResult {
  name: string;
  ok: boolean;
  detail: string;
}

interface TaskReport {
  fixtureId: string;
  category: string;
  taskId: string | null;
  commitSha: string | null;
  criteria: CriterionResult[];
  passed: boolean;
  failureCategory: string | null;
  seconds: number;
}

function gitSync(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function materializeProject(fixture: Fixture, root: string): string {
  fs.mkdirSync(root, { recursive: true });
  for (const file of fixture.files) {
    const target = path.join(root, file.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, file.content);
  }
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\ndist/\n');
  gitSync(root, ['init', '--initial-branch=master']);
  gitSync(root, ['config', 'user.name', 'Mi Phase4 Acceptance']);
  gitSync(root, ['config', 'user.email', 'phase4@example.invalid']);
  gitSync(root, ['config', 'commit.gpgsign', 'false']);
  gitSync(root, ['add', '--', '.']);
  gitSync(root, ['commit', '-m', `fixture: ${fixture.id}`]);
  return fs.realpathSync.native(root);
}

function linkTypescript(root: string): void {
  const serverModules = path.resolve(__dirname, '..', '..', 'node_modules');
  if (!fs.existsSync(path.join(serverModules, 'typescript'))) return;
  const target = path.join(root, 'node_modules');
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['typescript', '.bin']) {
    const from = path.join(serverModules, name);
    const to = path.join(target, name);
    if (fs.existsSync(from) && !fs.existsSync(to)) {
      try {
        fs.symlinkSync(from, to, 'junction');
      } catch {
        fs.cpSync(from, to, { recursive: true });
      }
    }
  }
}

async function runFixture(fixture: Fixture, tmpDir: string, service: ProjectRegistryService): Promise<TaskReport> {
  const startedAt = Date.now();
  const criteria: CriterionResult[] = [];
  const add = (name: string, ok: boolean, detail = '') => criteria.push({ name, ok, detail });

  const projectRoot = materializeProject(fixture, path.join(tmpDir, fixture.id));
  if (fixture.category === 'type-repair') linkTypescript(projectRoot);
  const baseCommitBefore = gitSync(projectRoot, ['rev-parse', 'HEAD']);
  const baseTreeBefore = gitSync(projectRoot, ['rev-parse', 'HEAD^{tree}']);

  const project = service.registerProject({
    id: fixture.id,
    displayName: fixture.title,
    canonicalRoot: projectRoot,
    testCommands: fixture.validationCommands,
    buildCommands: [],
  });

  const map = service.generateProjectMap(project.id);
  add('fresh map generated', map.status === 'FRESH' && Boolean(map.mapVersion), `status=${map.status} version=${map.mapVersion}`);

  const pack = service.buildContextPack(project.id, fixture.userRequest);
  add('context pack built', pack.includedPaths.length > 0 && pack.policy !== 'REMAP_REQUIRED', `policy=${pack.policy} paths=${pack.includedPaths.length}`);

  let taskId: string | null = null;
  let commitSha: string | null = null;
  let failureCategory: string | null = null;

  try {
    const workflow = new CodingWorkflow(undefined, service);
    const result = await workflow.run({
      projectId: project.id,
      contextPackId: pack.id,
      mapVersion: map.mapVersion,
      userRequest: fixture.userRequest,
      maxRetries: 3,
      commitPolicy: 'local-only',
      engineId: LLM_ENGINE_ID,
      validationCommands: fixture.validationCommands,
    });
    taskId = result.task.id;
    commitSha = result.commitSha;

    add('candidate ranking produced', result.candidates.candidates.length > 0, `${result.candidates.candidates.length} candidates`);
    add('plan produced before apply', Boolean(result.plan?.summary) && result.plan.filesToChange.length > 0, result.plan?.summary ?? '');
    add('engine is the local LLM engine', result.task.codingEngine === LLM_ENGINE_ID, String(result.task.codingEngine));
    add('a local model was actually invoked', Boolean(result.task.selectedModel), String(result.task.selectedModel));
    add(
      'isolated worktree used',
      Boolean(result.task.worktreePath) && path.resolve(String(result.task.worktreePath)) !== path.resolve(projectRoot),
      String(result.task.worktreePath)
    );
    add(
      'validation passed',
      result.validation.every(v => !v.configured || v.exitCode === 0),
      result.validation.map(v => `${v.name}=${v.configured ? v.exitCode : 'n/a'}`).join(' ')
    );
    add('independent review passed', result.review.status === 'PASS', (result.review.findings ?? []).join('; '));
    add('local commit created', Boolean(commitSha), String(commitSha));

    if (result.task.worktreePath) {
      const branches = gitSync(projectRoot, ['branch', '--list']);
      add('task branch is local only', branches.includes('codex/task-'), branches.replace(/\s+/g, ' ').slice(0, 120));
    }
  } catch (err) {
    failureCategory = err instanceof Error && 'category' in err ? String((err as { category: unknown }).category) : 'ENGINE_CRASHED';
    add('workflow completed without throwing', false, err instanceof Error ? err.message : String(err));
  }

  // These hold regardless of whether the task itself succeeded.
  add('base checkout HEAD unchanged', gitSync(projectRoot, ['rev-parse', 'HEAD']) === baseCommitBefore);
  add('base checkout tree unchanged', gitSync(projectRoot, ['rev-parse', 'HEAD^{tree}']) === baseTreeBefore);
  add('base checkout is clean', gitSync(projectRoot, ['status', '--porcelain']).replace(/node_modules.*/g, '').trim() === '');
  add('no remote configured, so no push occurred', gitSync(projectRoot, ['remote']) === '');

  if (taskId) {
    const store = new TaskStore();
    const events = store.listEvents(taskId);
    const failureEvent = [...events].reverse().find(event => event.type === 'coding.failure.classified');
    if (failureEvent && !failureCategory) {
      try {
        failureCategory = String((JSON.parse(failureEvent.detail) as { category?: string }).category ?? null);
      } catch {
        /* keep null */
      }
    }
    add('engine invocation recorded in events', events.some(event => event.type === 'coding.models.selected'));
    store.close();
  }

  return {
    fixtureId: fixture.id,
    category: fixture.category,
    taskId,
    commitSha,
    criteria,
    passed: criteria.every(c => c.ok),
    failureCategory,
    seconds: (Date.now() - startedAt) / 1000,
  };
}

async function main(): Promise<void> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-acceptance-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = tmpDir;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = tmpDir;

  const only = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
  const fixtures = only.length ? FIXTURES.filter(f => only.includes(f.id)) : FIXTURES;

  const service = new ProjectRegistryService();
  const reports: TaskReport[] = [];
  try {
    for (const fixture of fixtures) {
      process.stderr.write(`\n=== ${fixture.id} (${fixture.category}) ===\n`);
      const report = await runFixture(fixture, tmpDir, service);
      reports.push(report);
      for (const criterion of report.criteria) {
        process.stderr.write(`  ${criterion.ok ? 'ok  ' : 'FAIL'} ${criterion.name}${criterion.detail ? ` — ${criterion.detail}` : ''}\n`);
      }
      process.stderr.write(`  => ${report.passed ? 'PASS' : 'FAIL'} (${report.seconds.toFixed(0)}s)\n`);
    }
  } finally {
    service.close();
  }

  const passedCount = reports.filter(r => r.passed).length;
  console.log('\n| fixture | category | result | commit | failure | s |');
  console.log('|---|---|---|---|---|---|');
  for (const report of reports) {
    console.log(
      `| ${report.fixtureId} | ${report.category} | ${report.passed ? 'PASS' : 'FAIL'} | ` +
        `${report.commitSha ? report.commitSha.slice(0, 12) : '-'} | ${report.failureCategory ?? '-'} | ${report.seconds.toFixed(0)} |`
    );
  }
  console.log(`\nAcceptance: ${passedCount}/${reports.length} fixtures passed every criterion.`);

  const outDir = process.env.MI_ACCEPTANCE_OUT;
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'acceptance-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
  }

  if (passedCount !== reports.length) {
    console.error('\nPhase 4 acceptance is PARTIAL. Failing criteria:');
    for (const report of reports.filter(r => !r.passed)) {
      for (const criterion of report.criteria.filter(c => !c.ok)) {
        console.error(`  ${report.fixtureId}: ${criterion.name}${criterion.detail ? ` — ${criterion.detail}` : ''}`);
      }
    }
    process.exit(1);
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  } catch {
    /* temp cleanup is best-effort */
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
