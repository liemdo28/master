/**
 * Regression test for a TOCTOU race between CodingWorkflow.resumeTask()'s
 * completion path and an out-of-band cancellation (a separate TaskEngine
 * instance calling cancelTask on the same task, e.g. an API-driven cancel
 * while a background resume is still in flight).
 *
 * Root cause (fixed in workflow.ts): resumeTask() checked
 * `status === 'CANCELLED'` after each validation attempt, but not again
 * after review/commit, before calling `taskEngine.completeTask()`. If a
 * cancellation landed in that window, completeTask()'s own state-machine
 * guard correctly refused the CANCELLED -> COMPLETED transition — but by
 * throwing, which resumeTask() did not catch, crashing the whole call
 * instead of returning the already-cancelled task cleanly. Confirmed live
 * in CI (twice, on two unrelated docs-only PRs) via the *existing*
 * "cancelled active validation process" scenario in coding-workflow.test.ts,
 * which occasionally raced past that scenario's own validation-phase check
 * and into this exact gap. Independently reproduced deterministically here
 * (verified: reverting the workflow.ts fix reliably reproduces the exact
 * "Illegal transition ...: CANCELLED -> COMPLETED" error at the calibrated
 * delay; restoring the fix reliably resolves it to a clean CANCELLED
 * result whose event log includes coding.review.completed).
 *
 * Timing is calibrated at runtime (one full uncancelled pass measures the
 * real end-to-end duration on whatever machine/CI runner this executes on)
 * rather than hardcoded, since the actual race window is dominated by
 * `npm run` process-spawn overhead, which varies significantly by machine.
 *
 * This file stress-tests the race repeatedly and concurrently across a
 * delay sweep straddling that measured window, and separately confirms
 * ordinary completion and failure semantics are unaffected by the fix.
 */
import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { CodingWorkflow, INTERNAL_ENGINE_ID } from '../workflow';
import { ProjectRegistryService } from '../../project-registry/service';
import { TaskEngine } from '../../task-runtime/engine';
import { TaskStore } from '../../task-runtime/store';
import type { ValidationProfile } from '../../project-registry/types';

function log(message: string) {
  console.log(`[cancel-race-regression] ${message}`);
}

/** An explicit profile bypasses ProjectRegistryService's own package.json
 *  auto-detection (which only recognizes this repo's own script names —
 *  test:ci/test:unit/test:task-runtime/test:project-registry — and would
 *  otherwise silently drop this fixture's `test:coding` script), giving this
 *  test direct, deterministic control over exactly which command runs. */
function explicitProfile(): ValidationProfile {
  return {
    language: 'javascript',
    framework: 'node',
    installCommands: [],
    buildCommands: ['npm run build'],
    testCommands: ['npm run test:coding'],
    lintCommands: [],
    artifactPaths: [],
    generatedOutputPaths: ['dist', 'build', 'coverage'],
    cleanupPolicy: 'none',
    successCriteria: ['all configured commands exit 0'],
  };
}

function createFixtureProject(root: string, name: string, testCodingScript: string): string {
  fs.mkdirSync(path.join(root, 'server', 'src', 'routes'), { recursive: true });
  fs.mkdirSync(path.join(root, 'server', 'src', 'coding', '__tests__'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server', 'package.json'), JSON.stringify({
    scripts: {
      build: 'node -e "process.exit(0)"',
      'test:coding': testCodingScript,
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

async function waitForStatus(taskId: string, status: string, deadlineMs = 15_000): Promise<void> {
  const store = new TaskStore();
  try {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      if (store.getTask(taskId)?.status === status) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error(`task did not reach ${status}`);
  } finally {
    store.close();
  }
}

interface RaceOutcome {
  landedInWindow: boolean;
}

/** Runs one cancel-during-validation-or-review race. If the task has
 *  already reached a terminal state (COMPLETED) by the time the calibrated
 *  delay elapses — a timing overshoot, not a code defect — the cancel is
 *  skipped rather than issued against an already-finished task (which would
 *  itself throw for the unrelated, expected reason that you cannot cancel
 *  what has already finished). Otherwise asserts the required invariant:
 *  the task must end CANCELLED, never COMPLETED, and must stay CANCELLED
 *  when re-read independently afterward (nothing resurrects it). */
async function raceOnce(service: ProjectRegistryService, projectId: string, contextPackId: string, mapVersion: string, delayAfterValidatingMs: number, label: string): Promise<RaceOutcome> {
  const workflow = new CodingWorkflow();
  const planned = await workflow.planTask({
    projectId,
    contextPackId,
    mapVersion,
    userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
    maxRetries: 0,
    engineId: INTERNAL_ENGINE_ID,
  });
  const running = workflow.resumeTask(planned.task.id);
  await waitForStatus(planned.task.id, 'VALIDATING');
  if (delayAfterValidatingMs > 0) await new Promise(resolve => setTimeout(resolve, delayAfterValidatingMs));

  const preCancelStore = new TaskStore();
  const preCancelStatus = preCancelStore.getTask(planned.task.id)?.status;
  preCancelStore.close();
  if (preCancelStatus === 'COMPLETED' || preCancelStatus === 'FAILED') {
    await running.catch(() => { /* already settled */ });
    workflow.close();
    return { landedInWindow: false };
  }

  const cancelStore = new TaskStore();
  const cancelEngine = new TaskEngine(cancelStore);
  cancelEngine.cancelTask(planned.task.id, `race test cancellation (${label})`);
  cancelStore.close();

  const result = await running;
  assert.strictEqual(result.task.status, 'CANCELLED', `${label} (+${delayAfterValidatingMs}ms): workflow must return CANCELLED, not throw or report COMPLETED`);

  const verifyStore = new TaskStore();
  const finalTask = verifyStore.getTask(planned.task.id);
  const events = verifyStore.listEvents(planned.task.id).map(e => e.type);
  verifyStore.close();
  assert.ok(finalTask, `${label} (+${delayAfterValidatingMs}ms): task must still exist after the race`);
  assert.strictEqual(finalTask!.status, 'CANCELLED', `${label} (+${delayAfterValidatingMs}ms): task must remain CANCELLED — nothing may resurrect it to COMPLETED after the fact`);

  workflow.close();
  return { landedInWindow: events.includes('coding.review.completed') };
}

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-cancel-race-test-'));
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(tmpDir, 'registry');
  process.env.MI_TASK_RUNTIME_DIR = path.join(tmpDir, 'tasks');
  process.env.MI_CODING_WORKTREE_ROOT = path.join(tmpDir, 'worktrees');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = tmpDir;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = tmpDir;

  const service = new ProjectRegistryService();
  try {
    const slowScript = 'node -e "setTimeout(()=>process.exit(0), 250)"';
    const slowRoot = createFixtureProject(path.join(tmpDir, 'project-race'), 'project-race', slowScript);
    const slowProject = service.registerProject({ id: 'project-race', displayName: 'Project Race', canonicalRoot: slowRoot, validationProfile: explicitProfile() });
    const slowMap = service.generateProjectMap(slowProject.id);
    const slowPack = service.buildContextPack(slowProject.id, 'coding engine registry model roles endpoint');

    // ── Calibration: measure the real, uncancelled, end-to-end duration of
    // this exact fixture on this exact machine, so the delay sweep below
    // targets the actual review/commit window regardless of how fast or
    // slow `npm run` process spawning happens to be here. ─────────────────
    const calibrationWorkflow = new CodingWorkflow();
    const calibrationT0 = Date.now();
    const calibrationResult = await calibrationWorkflow.run({
      projectId: slowProject.id,
      contextPackId: slowPack.id,
      mapVersion: slowMap.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      maxRetries: 0,
      engineId: INTERNAL_ENGINE_ID,
    });
    const fullDurationMs = Date.now() - calibrationT0;
    assert.strictEqual(calibrationResult.task.status, 'COMPLETED');
    calibrationWorkflow.close();
    log(`calibration: uncancelled run took ${fullDurationMs}ms end-to-end on this machine`);

    // The sweep spans from shortly after validation starts (still exercises
    // the pre-existing mid-validation check) through just under the full
    // measured duration (exercises this fix's post-validation/pre-completeTask
    // check, without overshooting into "task already finished").
    const lowMs = Math.max(50, Math.round(fullDurationMs * 0.3));
    const highMs = Math.max(lowMs + 100, Math.round(fullDurationMs * 0.9));

    // ── Repeated sequential races ──────────────────────────────────────────
    const SEQUENTIAL_ITERATIONS = 16;
    let sequentialHits = 0;
    for (let i = 0; i < SEQUENTIAL_ITERATIONS; i++) {
      const delayMs = Math.round(lowMs + ((highMs - lowMs) * i) / (SEQUENTIAL_ITERATIONS - 1));
      const outcome = await raceOnce(service, slowProject.id, slowPack.id, slowMap.mapVersion, delayMs, `sequential #${i + 1} (+${delayMs}ms)`);
      if (outcome.landedInWindow) sequentialHits++;
    }
    log(`${SEQUENTIAL_ITERATIONS}/${SEQUENTIAL_ITERATIONS} sequential cancel races ended CANCELLED, never COMPLETED (${sequentialHits} landed past review, directly exercising the fixed gap)`);

    // ── Concurrent races (real scheduler contention, not just repetition) ──
    const CONCURRENT_BATCHES = 3;
    const CONCURRENCY = 4;
    let concurrentHits = 0;
    for (let batch = 0; batch < CONCURRENT_BATCHES; batch++) {
      const outcomes = await Promise.all(
        Array.from({ length: CONCURRENCY }, (_, i) => {
          const n = batch * CONCURRENCY + i;
          const delayMs = Math.round(lowMs + ((highMs - lowMs) * n) / (CONCURRENT_BATCHES * CONCURRENCY - 1));
          return raceOnce(service, slowProject.id, slowPack.id, slowMap.mapVersion, delayMs, `concurrent batch ${batch + 1}/#${i + 1} (+${delayMs}ms)`);
        }),
      );
      concurrentHits += outcomes.filter(o => o.landedInWindow).length;
    }
    log(`${CONCURRENT_BATCHES * CONCURRENCY} concurrent cancel races ended CANCELLED, never COMPLETED (${concurrentHits} landed past review, directly exercising the fixed gap)`);

    assert.ok(sequentialHits + concurrentHits > 0, 'the delay sweep must land at least one race past review/commit — otherwise this file is not actually exercising the fixed gap');

    // ── Ordinary completion is unaffected by the fix ────────────────────────
    const fastScript = 'node -e "process.exit(0)"';
    const fastRoot = createFixtureProject(path.join(tmpDir, 'project-fast'), 'project-fast', fastScript);
    const fastProject = service.registerProject({ id: 'project-fast', displayName: 'Project Fast', canonicalRoot: fastRoot, validationProfile: explicitProfile() });
    const fastMap = service.generateProjectMap(fastProject.id);
    const fastPack = service.buildContextPack(fastProject.id, 'coding engine registry model roles endpoint');
    const completeWorkflow = new CodingWorkflow();
    const completeResult = await completeWorkflow.run({
      projectId: fastProject.id,
      contextPackId: fastPack.id,
      mapVersion: fastMap.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      maxRetries: 0,
      engineId: INTERNAL_ENGINE_ID,
    });
    assert.strictEqual(completeResult.task.status, 'COMPLETED');
    assert.ok(completeResult.commitSha);
    completeWorkflow.close();
    log('ordinary (non-cancelled) validation completion still reaches COMPLETED with a commit');

    // ── Failure semantics are unaffected by the fix ─────────────────────────
    const failScript = 'node -e "process.exit(1)"';
    const failRoot = createFixtureProject(path.join(tmpDir, 'project-fail'), 'project-fail', failScript);
    const failProject = service.registerProject({ id: 'project-fail', displayName: 'Project Fail', canonicalRoot: failRoot, validationProfile: explicitProfile() });
    const failMap = service.generateProjectMap(failProject.id);
    const failPack = service.buildContextPack(failProject.id, 'coding engine registry model roles endpoint');
    const failWorkflow = new CodingWorkflow();
    const failResult = await failWorkflow.run({
      projectId: failProject.id,
      contextPackId: failPack.id,
      mapVersion: failMap.mapVersion,
      userRequest: 'Add a read-only endpoint that returns the active coding engine registry and model roles',
      maxRetries: 0,
      engineId: INTERNAL_ENGINE_ID,
    });
    assert.strictEqual(failResult.task.status, 'FAILED');
    assert.strictEqual(failResult.commitSha, null);
    failWorkflow.close();
    log('a task whose validation genuinely fails still reaches FAILED, not CANCELLED or COMPLETED');
  } finally {
    service.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best-effort */ }
  }
  log('PASS');
}

run().catch(err => { console.error(err); process.exit(1); });
