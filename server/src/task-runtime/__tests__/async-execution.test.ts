// Async command execution hardening tests.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import { TaskStore } from '../store';
import { TaskEngine } from '../engine';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createRunningTask(engine: TaskEngine, workingDirectory: string, userRequest = 'Async execution test') {
  const task = engine.createTask({ userRequest, workingDirectory });
  engine.transition(task.id, 'CONTEXT_BUILDING');
  engine.transition(task.id, 'PLANNING');
  engine.transition(task.id, 'READY');
  engine.transition(task.id, 'RUNNING');
  return task;
}

function fakeNodeScript(mode: 'sleep' | 'big-output'): string {
  const scriptDir = makeTempDir('mi-task-runtime-fake-node-');
  const scriptPath = path.join(scriptDir, 'node-shim.cjs');
  const body = mode === 'sleep'
    ? 'setTimeout(() => { console.log("done"); }, 5000);\n'
    : 'process.stdout.write("x".repeat(200000));\n';
  fs.writeFileSync(scriptPath, body);
  return scriptPath;
}

async function waitForRunning(engine: TaskEngine, taskId: string): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    if (engine.getRunningTaskIds().includes(taskId)) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`process was not tracked for ${taskId}`);
}

async function run() {
  const oldPath = process.env.PATH;
  const oldPathUpper = process.env.Path;
  const oldTimeout = process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS;
  const oldMaxBuffer = process.env.MI_TASK_RUNTIME_COMMAND_MAX_BUFFER_BYTES;
  const oldRoots = process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS;
  const oldShim = process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT;
  const dataDir = makeTempDir('mi-task-runtime-async-data-');
  const workspaceDir = makeTempDir('mi-task-runtime-async-workspace-');
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = workspaceDir;
  const store = new TaskStore(dataDir);
  const engine = new TaskEngine(store);

  try {
    const successTask = createRunningTask(engine, workspaceDir, 'success');
    const success = await engine.runCommandStep(successTask.id, 'node', ['--version']);
    assert.strictEqual(success.exitCode, 0);
    engine.transition(successTask.id, 'VALIDATING');
    engine.completeTask(successTask.id, 'success');
    assert.strictEqual(store.getTask(successTask.id)?.status, 'COMPLETED');

    const failureTask = createRunningTask(engine, workspaceDir, 'non-zero failure');
    const failure = await engine.runCommandStep(failureTask.id, 'node', ['--task-runtime-intentional-failure']);
    assert.notStrictEqual(failure.exitCode, 0);
    engine.failTask(failureTask.id, 'non-zero command failed');
    assert.strictEqual(store.getTask(failureTask.id)?.status, 'FAILED');

    process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT = fakeNodeScript('sleep');
    process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS = '100';
    const timeoutTask = createRunningTask(engine, workspaceDir, 'timeout');
    const timeout = await engine.runCommandStep(timeoutTask.id, 'node', ['--version']);
    assert.notStrictEqual(timeout.exitCode, 0);
    assert.strictEqual(timeout.signal, 'TIMEOUT');
    engine.failTask(timeoutTask.id, 'command timed out');
    assert.strictEqual(store.getTask(timeoutTask.id)?.status, 'FAILED');

    process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT = fakeNodeScript('sleep');
    const cancelTask = createRunningTask(engine, workspaceDir, 'cancel');
    process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS = '5000';
    const running = engine.runCommandStep(cancelTask.id, 'node', ['--version']);
    await waitForRunning(engine, cancelTask.id);
    const cancelled = engine.cancelTask(cancelTask.id, 'cancel test');
    assert.strictEqual(cancelled.status, 'CANCELLED');
    const cancelResult = await running;
    assert.notStrictEqual(cancelResult.exitCode, 0);
    assert.strictEqual(store.getTask(cancelTask.id)?.status, 'CANCELLED');

    if (oldShim === undefined) delete process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT;
    else process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT = oldShim;
    process.env.PATH = oldPath;
    process.env.Path = oldPathUpper;
    if (oldTimeout === undefined) delete process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS;
    else process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS = oldTimeout;

    const concurrentTasks = [0, 1, 2].map(i => createRunningTask(engine, workspaceDir, `concurrent ${i}`));
    const concurrent = await Promise.all(concurrentTasks.map(task => engine.runCommandStep(task.id, 'node', ['--version'])));
    assert.ok(concurrent.every(result => result.exitCode === 0));
    assert.deepStrictEqual(engine.getRunningTaskIds(), []);

    process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT = fakeNodeScript('big-output');
    process.env.MI_TASK_RUNTIME_COMMAND_MAX_BUFFER_BYTES = '1024';
    const outputTask = createRunningTask(engine, workspaceDir, 'output limit');
    const output = await engine.runCommandStep(outputTask.id, 'node', ['--version']);
    assert.notStrictEqual(output.exitCode, 0);
    assert.strictEqual(output.signal, 'OUTPUT_LIMIT');
    const outputEvidence = JSON.parse(fs.readFileSync(path.join(dataDir, 'evidence', output.relativePath), 'utf8'));
    assert.strictEqual(outputEvidence.outputLimitExceeded, true);

    const persistedEvents = store.listEvents(successTask.id).length;
    store.close();
    const recoveredStore = new TaskStore(dataDir);
    assert.strictEqual(recoveredStore.getTask(successTask.id)?.status, 'COMPLETED');
    assert.strictEqual(recoveredStore.getTask(failureTask.id)?.status, 'FAILED');
    assert.strictEqual(recoveredStore.getTask(cancelTask.id)?.status, 'CANCELLED');
    assert.strictEqual(recoveredStore.listEvents(successTask.id).length, persistedEvents);
    recoveredStore.close();
  } finally {
    try { store.close(); } catch {}
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
    if (oldPathUpper === undefined) delete process.env.Path; else process.env.Path = oldPathUpper;
    if (oldTimeout === undefined) delete process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS;
    else process.env.MI_TASK_RUNTIME_COMMAND_TIMEOUT_MS = oldTimeout;
    if (oldMaxBuffer === undefined) delete process.env.MI_TASK_RUNTIME_COMMAND_MAX_BUFFER_BYTES;
    else process.env.MI_TASK_RUNTIME_COMMAND_MAX_BUFFER_BYTES = oldMaxBuffer;
    if (oldRoots === undefined) delete process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS;
    else process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = oldRoots;
    if (oldShim === undefined) delete process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT;
    else process.env.MI_TASK_RUNTIME_TEST_NODE_SHIM_SCRIPT = oldShim;
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log('[async-execution] PASS');
  })
  .catch(err => {
    console.error('[async-execution] FAIL:', err);
    process.exitCode = 1;
  });
