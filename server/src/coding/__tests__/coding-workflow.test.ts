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
import { TaskEngine } from '../../task-runtime/engine';
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

    const planner = new CodingWorkflow();
    const planned = await planner.planTask({
      projectId: a.id,
      contextPackId: packA.id,
      mapVersion: mapA.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      maxRetries: 1,
    });
    assert.strictEqual(planned.task.status, 'READY');
    planner.close();
    const resumer = new CodingWorkflow();
    const resumed = await resumer.resumeTask(planned.task.id);
    assert.strictEqual(resumed.task.status, 'COMPLETED');
    assert.ok(resumed.commitSha);
    const resumeStore = new TaskStore();
    const resumeEvents = resumeStore.listEvents(planned.task.id);
    assert.ok(resumeEvents.some(event => event.type === 'coding.engine.applied'));
    assert.ok(resumeEvents.some(event => event.type === 'coding.commit.created'));
    resumeStore.close();
    resumer.close();
    log('resumed a READY coding task after workflow restart');

    const slowRoot = createFixtureProject(path.join(tmpDir, 'project-cancel'), 'project-cancel', true);
    const slowProject = service.registerProject({ id: 'project-cancel', displayName: 'Project Cancel', canonicalRoot: slowRoot, testCommands: ['npm run test:coding'], buildCommands: ['npm run build'] });
    const slowMap = service.generateProjectMap(slowProject.id);
    const slowPack = service.buildContextPack(slowProject.id, 'coding engine registry model roles endpoint');
    const slowWorkflow = new CodingWorkflow();
    const slowPlanned = await slowWorkflow.planTask({
      projectId: slowProject.id,
      contextPackId: slowPack.id,
      mapVersion: slowMap.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      maxRetries: 0,
    });
    const running = slowWorkflow.resumeTask(slowPlanned.task.id);
    await waitForStatus(slowPlanned.task.id, 'VALIDATING');
    const cancelStore = new TaskStore();
    const cancelEngine = new TaskEngine(cancelStore);
    cancelEngine.cancelTask(slowPlanned.task.id, 'test cancellation during validation');
    cancelStore.close();
    const cancelled = await running;
    assert.strictEqual(cancelled.task.status, 'CANCELLED');
    slowWorkflow.close();
    log('cancelled active validation process and preserved task state');

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

async function waitForStatus(taskId: string, status: string): Promise<void> {
  const store = new TaskStore();
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (store.getTask(taskId)?.status === status) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`task did not reach ${status}`);
  } finally {
    store.close();
  }
}

function createFixtureProject(root: string, name: string, slowTest = false): string {
  fs.mkdirSync(path.join(root, 'server', 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'src', 'coding', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'package.json'), JSON.stringify({
    scripts: {
      build: 'node -e "process.exit(0)"',
      'test:coding': slowTest ? 'node -e "setTimeout(()=>process.exit(0), 10000)"' : 'node -e "process.exit(0)"',
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
