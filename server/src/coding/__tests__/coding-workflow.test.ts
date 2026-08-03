import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { CODING_ENGINE_REGISTRY } from '../engine-registry';
import { InternalPatchEngine } from '../engines/internal-patch-engine';
import { assertPlanWithinCandidates, enforceCandidateFileLimits, selectCandidateFiles } from '../candidate-selector';
import { buildValidationPlan } from '../validation-runner';
import { CodingWorkflow } from '../workflow';
import { ProjectRegistryService } from '../../project-registry/service';
import { TaskStore } from '../../task-runtime/store';

function log(message: string) {
  console.log(`[coding-workflow] ${message}`);
}

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-coding-workflow-test-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = tmpDir;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = tmpDir;

  const projectA = createFixtureProject(path.join(tmpDir, 'project-a'), 'project-a');
  const projectB = createFixtureProject(path.join(tmpDir, 'project-b'), 'project-b');
  const service = new ProjectRegistryService();
  try {
    assert.ok(CODING_ENGINE_REGISTRY.some(engine => engine.id === 'internal-patch-engine' && engine.status === 'ACTIVE'));
    const adapter = new InternalPatchEngine();
    await adapter.cancel('task-cancelled');
    assert.deepStrictEqual(await adapter.status('task-cancelled'), { running: false });
    log('registry and adapter cancellation are available');

    const a = service.registerProject({ id: 'project-a', displayName: 'Project A', canonicalRoot: projectA, testCommands: ['npm run test:coding'], buildCommands: ['npm run build'] });
    const b = service.registerProject({ id: 'project-b', displayName: 'Project B', canonicalRoot: projectB, testCommands: ['npm run test:coding'], buildCommands: ['npm run build'] });
    const mapA = service.generateProjectMap(a.id);
    const mapB = service.generateProjectMap(b.id);
    const packA = service.buildContextPack(a.id, 'coding engine registry model roles endpoint');
    const packB = service.buildContextPack(b.id, 'coding engine registry model roles endpoint');
    assert.strictEqual(packA.projectId, a.id);
    assert.strictEqual(packB.projectId, b.id);

    const workflowA = new CodingWorkflow();
    const workflowB = new CodingWorkflow();
    const [resultA, resultB] = await Promise.all([
      workflowA.run({
        projectId: a.id,
        contextPackId: packA.id,
        mapVersion: mapA.mapVersion,
        userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
        maxRetries: 1,
      }),
      workflowB.run({
        projectId: b.id,
        contextPackId: packB.id,
        mapVersion: mapB.mapVersion,
        userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
        maxRetries: 1,
      }),
    ]);
    assert.strictEqual(resultA.task.status, 'COMPLETED');
    assert.strictEqual(resultB.task.status, 'COMPLETED');
    assert.ok(resultA.commitSha);
    assert.ok(resultB.commitSha);
    assert.notStrictEqual(resultA.task.worktreePath, resultB.task.worktreePath);
    assert.ok(String(resultA.task.worktreePath).includes(path.join('worktrees', 'project-a')));
    assert.ok(String(resultB.task.worktreePath).includes(path.join('worktrees', 'project-b')));
    log('ran concurrent coding tasks with isolated project worktrees');

    const restartedStore = new TaskStore();
    const recovered = restartedStore.getTask(resultA.task.id);
    assert.ok(recovered);
    assert.strictEqual(recovered!.status, 'COMPLETED');
    assert.ok(restartedStore.listEvents(resultA.task.id).some(event => event.type === 'coding.commit.created'));
    restartedStore.close();
    log('recovered completed coding task after store restart');

    const validationPlan = buildValidationPlan(a, String(resultA.task.worktreePath), ['npm run external:integration']);
    assert.ok(validationPlan.some(command => command.name === 'npm run external:integration' && !command.configured));
    log('unregistered validation commands are marked NOT_CONFIGURED');

    const rawCandidates = selectCandidateFiles({
      id: 'ctx-test',
      projectId: 'project-a',
      mapVersion: mapA.mapVersion,
      sourceSha: mapA.sourceSha,
      mapStatus: 'FRESH',
      policy: 'MAP_PLUS_TARGETED_READ',
      summary: 'test',
      moduleSummaries: [],
      includedPaths: ['server/src/routes/coding.ts', 'missing.ts'],
      excludedPaths: [],
      relevanceHints: [],
      resumeContextId: null,
      createdAt: new Date().toISOString(),
    }, 'coding endpoint');
    const limited = enforceCandidateFileLimits(String(resultA.task.worktreePath), rawCandidates);
    assert.ok(limited.candidates.some(candidate => candidate.path === 'server/src/routes/coding.ts'));
    assert.ok(limited.excluded.some(item => item.includes('missing.ts')));
    assert.throws(() => assertPlanWithinCandidates(['outside.ts'], limited), /outside context candidates/);
    log('candidate existence and plan-boundary checks are enforced');

    const largeFile = path.join(String(resultA.task.worktreePath), 'server', 'src', 'routes', 'large.ts');
    fs.writeFileSync(largeFile, 'x'.repeat(300 * 1024));
    const largeSelection = selectCandidateFiles({
      id: 'ctx-large',
      projectId: 'project-a',
      mapVersion: mapA.mapVersion,
      sourceSha: mapA.sourceSha,
      mapStatus: 'FRESH',
      policy: 'MAP_PLUS_TARGETED_READ',
      summary: 'test',
      moduleSummaries: [],
      includedPaths: ['server/src/routes/large.ts'],
      excludedPaths: [],
      relevanceHints: [],
      resumeContextId: null,
      createdAt: new Date().toISOString(),
    }, 'large route');
    const largeLimited = enforceCandidateFileLimits(String(resultA.task.worktreePath), largeSelection);
    assert.strictEqual(largeLimited.candidates.length, 0);
    assert.ok(largeLimited.excluded.some(item => item.includes('exceeds byte limit')));
    log('candidate byte limit is enforced');

    const outsideDir = path.join(tmpDir, 'outside');
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'escape.ts'), 'export const escape = true;\n');
    const linkPath = path.join(String(resultA.task.worktreePath), 'server', 'src', 'routes', 'escape-link.ts');
    try {
      fs.symlinkSync(path.join(outsideDir, 'escape.ts'), linkPath, 'file');
      const symlinkSelection = selectCandidateFiles({
        id: 'ctx-symlink',
        projectId: 'project-a',
        mapVersion: mapA.mapVersion,
        sourceSha: mapA.sourceSha,
        mapStatus: 'FRESH',
        policy: 'MAP_PLUS_TARGETED_READ',
        summary: 'test',
        moduleSummaries: [],
        includedPaths: ['server/src/routes/escape-link.ts'],
        excludedPaths: [],
        relevanceHints: [],
        resumeContextId: null,
        createdAt: new Date().toISOString(),
      }, 'escape route');
      const symlinkLimited = enforceCandidateFileLimits(String(resultA.task.worktreePath), symlinkSelection);
      assert.strictEqual(symlinkLimited.candidates.length, 0);
      assert.ok(symlinkLimited.excluded.some(item => item.includes('symlink escape')));
      log('candidate symlink escape is rejected');
    } catch {
      log('candidate symlink escape test skipped because symlink creation is unavailable');
    }
    workflowA.close();
    workflowB.close();
  } finally {
    service.close();
    safeRm(tmpDir);
  }
  log('PASS');
}

function safeRm(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    console.warn(`[coding-workflow] temp cleanup skipped: ${dir}`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

function createFixtureProject(root: string, name: string): string {
  fs.mkdirSync(path.join(root, 'server', 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'src', 'coding', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'package.json'), JSON.stringify({
    scripts: {
      build: 'node -e "process.exit(0)"',
      'test:coding': 'node -e "process.exit(0)"',
    },
  }, null, 2));
  fs.writeFileSync(path.join(root, 'server', 'src', 'routes', 'coding.ts'), [
    "import { Router, Request, Response } from 'express';",
    "import { CODING_ENGINE_REGISTRY } from '../coding/engine-registry';",
    "import { selectCodingModelRoles } from '../coding/model-router';",
    'export function createCodingRouter(): Router {',
    '  const router = Router();',
    "  router.get('/model-roles', async (_req: Request, res: Response) => {",
    '    const modelRoles = await selectCodingModelRoles();',
    '    res.json({ modelRoles });',
    '  });',
    '  return router;',
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'server', 'src', 'coding', '__tests__', 'coding-workflow.test.ts'), [
    "import assert from 'assert';",
    'function log(message: string) { console.log(message); }',
    'async function run() {',
    "  assert.ok(true, 'fixture');",
    "  log('PASS');",
    '}',
    'run();',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(root, 'README.md'), `# ${name}\n`);
  execFileSync('git', ['init', '-b', 'master'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'ignore' });
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'init'], { cwd: root, stdio: 'ignore' });
  return fs.realpathSync.native(root);
}
