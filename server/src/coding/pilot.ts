/**
 * Phase 4 real-project pilot.
 *
 * Runs one low-risk task against Mi Core itself through the full control plane
 * with the local LLM engine. Scope is deliberately narrow: a read-only API
 * response improvement in a single existing file. No auth, no deployment logic,
 * no migration, no secrets, no broad refactor.
 *
 * The commit is local only. Nothing here pushes.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

import { CodingWorkflow } from './workflow';
import { LLM_ENGINE_ID } from './llm/engine';
import { ProjectRegistryService } from '../project-registry/service';
import { TaskStore } from '../task-runtime/store';

const PILOT_REQUEST =
  'The read-only coding task plan endpoint does not report which engine produced the plan. ' +
  'Include the engine id in that response so callers can tell which coding engine was used.';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function main(): Promise<void> {
  const repoRoot = path.resolve(process.env.MI_PILOT_ROOT ?? process.cwd(), '..');
  const gitRoot = git(repoRoot, ['rev-parse', '--show-toplevel']);
  if (path.resolve(gitRoot) !== path.resolve(repoRoot)) {
    throw new Error(`pilot must run at the repository root; got ${repoRoot} vs ${gitRoot}`);
  }

  const dirty = git(repoRoot, ['status', '--porcelain']);
  if (dirty) {
    console.warn(`[pilot] repository has uncommitted changes:\n${dirty.split('\n').slice(0, 10).join('\n')}`);
  }

  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-phase4-pilot-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(stateDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(stateDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(stateDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = repoRoot;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = repoRoot;

  const headBefore = git(repoRoot, ['rev-parse', 'HEAD']);
  const branchBefore = git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);

  const service = new ProjectRegistryService();
  const project = service.registerProject({
    id: 'mi-core',
    displayName: 'Mi Core',
    canonicalRoot: repoRoot,
    defaultBranch: branchBefore,
    testCommands: ['npm run test:coding'],
    buildCommands: ['npm run build'],
  });

  const map = service.generateProjectMap(project.id);
  console.log(`[pilot] map ${map.mapVersion} status=${map.status} sourceSha=${map.sourceSha}`);

  const pack = service.buildContextPack(project.id, PILOT_REQUEST);
  console.log(`[pilot] context pack ${pack.id} policy=${pack.policy} paths=${pack.includedPaths.length}`);
  console.log(`[pilot] included:\n${pack.includedPaths.map(p => `  - ${p}`).join('\n')}`);

  const workflow = new CodingWorkflow(undefined, service);
  let taskId: string | null = null;
  try {
    const result = await workflow.run({
      projectId: project.id,
      contextPackId: pack.id,
      mapVersion: map.mapVersion,
      userRequest: PILOT_REQUEST,
      maxRetries: 3,
      commitPolicy: 'local-only',
      engineId: LLM_ENGINE_ID,
    });
    taskId = result.task.id;

    console.log('\n[pilot] result');
    console.log(`  taskId        ${result.task.id}`);
    console.log(`  status        ${result.task.status}`);
    console.log(`  engine        ${result.task.codingEngine}`);
    console.log(`  model         ${result.task.selectedModel}`);
    console.log(`  worktree      ${result.task.worktreePath}`);
    console.log(`  taskBranch    ${result.task.taskBranch}`);
    console.log(`  candidates    ${result.candidates.candidates.length}`);
    console.log(`  plan          ${result.plan.summary}`);
    console.log(`  filesToChange ${result.plan.filesToChange.join(', ')}`);
    console.log(`  filesChanged  ${result.apply.changedFiles.join(', ')}`);
    console.log(`  validation    ${result.validation.map(v => `${v.name}=${v.configured ? v.exitCode : 'n/a'}`).join(' ')}`);
    console.log(`  review        ${result.review.status} ${(result.review.findings ?? []).join('; ')}`);
    console.log(`  commitSha     ${result.commitSha}`);

    if (result.commitSha && result.task.worktreePath) {
      const worktree = String(result.task.worktreePath);
      console.log('\n[pilot] diff of the local commit:');
      console.log(git(worktree, ['show', '--stat', '--format=%H%n%an%n%s', result.commitSha]));
      console.log(git(worktree, ['show', '--format=', result.commitSha]).slice(0, 4000));
    }

    const outDir = process.env.MI_PILOT_OUT;
    if (outDir && result.task.worktreePath) {
      fs.mkdirSync(outDir, { recursive: true });
      const worktree = String(result.task.worktreePath);
      fs.writeFileSync(
        path.join(outDir, 'pilot-result.json'),
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            taskId: result.task.id,
            projectId: project.id,
            mapVersion: map.mapVersion,
            sourceSha: map.sourceSha,
            contextPackId: pack.id,
            includedPaths: pack.includedPaths,
            candidates: result.candidates.candidates.map(c => ({ path: c.path, confidence: c.confidence })),
            engine: result.task.codingEngine,
            model: result.task.selectedModel,
            plan: result.plan,
            filesChanged: result.apply.changedFiles,
            validation: result.validation.map(v => ({ name: v.name, configured: v.configured, exitCode: v.exitCode })),
            review: result.review,
            commitSha: result.commitSha,
            taskBranch: result.task.taskBranch,
          },
          null,
          2
        )
      );
      if (result.commitSha) {
        fs.writeFileSync(path.join(outDir, 'pilot-commit.diff'), git(worktree, ['show', '--format=', result.commitSha]));
      }
    }
  } finally {
    workflow.close();
    service.close();
  }

  // Invariants that must hold whatever the task did.
  const headAfter = git(repoRoot, ['rev-parse', 'HEAD']);
  const dirtyAfter = git(repoRoot, ['status', '--porcelain']);
  console.log('\n[pilot] base checkout invariants');
  console.log(`  HEAD unchanged        ${headAfter === headBefore} (${headBefore.slice(0, 12)})`);
  console.log(`  branch unchanged      ${git(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']) === branchBefore}`);
  console.log(`  no new dirt           ${dirtyAfter === dirty}`);

  if (taskId) {
    const store = new TaskStore();
    const events = store.listEvents(taskId);
    console.log(`  events recorded       ${events.length}`);
    console.log(`  engine invoked        ${events.some(e => e.type === 'coding.models.selected')}`);
    const failure = [...events].reverse().find(e => e.type === 'coding.failure.classified');
    if (failure) console.log(`  failure               ${failure.detail}`);
    store.close();
  }

  if (headAfter !== headBefore) {
    console.error('[pilot] FAIL: base checkout HEAD moved');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
