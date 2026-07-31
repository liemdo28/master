// Verifies task state mutations and their matching events are persisted together.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import { TaskStore } from '../store';
import { TaskEngine } from '../engine';

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-atomic-'));
  const store = new TaskStore(dataDir);
  const engine = new TaskEngine(store);
  try {
    const task = engine.createTask({ userRequest: 'Atomic transaction test', workingDirectory: process.cwd() });
    assert.strictEqual(store.listEvents(task.id).filter(e => e.type === 'task.created').length, 1);

    engine.transition(task.id, 'CONTEXT_BUILDING');
    let events = store.listEvents(task.id);
    assert.strictEqual(store.getTask(task.id)?.status, 'CONTEXT_BUILDING');
    assert.strictEqual(events.filter(e => e.type === 'task.status_changed').length, 1);

    engine.transition(task.id, 'PLANNING');
    engine.transition(task.id, 'READY');
    engine.transition(task.id, 'RUNNING');
    const firstRun = await engine.runCommandStep(task.id, 'node', ['--version']);
    assert.strictEqual(firstRun.exitCode, 0);
    events = store.listEvents(task.id);
    assert.strictEqual(events.filter(e => e.type === 'command.completed').length, 1);

    engine.transition(task.id, 'VALIDATING');
    await assert.rejects(() => engine.runCommandStep(task.id, 'node', ['--version']), /must be RUNNING|current/);
    events = store.listEvents(task.id);
    assert.strictEqual(events.filter(e => e.type === 'command.completed').length, 1);
    const completed = engine.completeTask(task.id, 'Atomic completion');
    events = store.listEvents(task.id);
    assert.strictEqual(completed.status, 'COMPLETED');
    assert.strictEqual(events.filter(e => e.type === 'task.completed').length, 1);

    store.close();
    const recoveredStore = new TaskStore(dataDir);
    const recoveredEvents = recoveredStore.listEvents(task.id);
    assert.strictEqual(recoveredStore.getTask(task.id)?.status, 'COMPLETED');
    assert.strictEqual(recoveredEvents.length, events.length);
    assert.strictEqual(recoveredEvents.filter(e => e.type === 'command.completed').length, 1);
    recoveredStore.close();

    const failureStore = new TaskStore(dataDir);
    const failureEngine = new TaskEngine(failureStore);
    const failureTask = failureEngine.createTask({ userRequest: 'Atomic failure test', workingDirectory: process.cwd() });
    failureEngine.transition(failureTask.id, 'CONTEXT_BUILDING');
    failureEngine.transition(failureTask.id, 'PLANNING');
    failureEngine.transition(failureTask.id, 'READY');
    failureEngine.transition(failureTask.id, 'RUNNING');
    failureEngine.failTask(failureTask.id, 'Synthetic failure transition');
    const failureEvents = failureStore.listEvents(failureTask.id);
    assert.strictEqual(failureStore.getTask(failureTask.id)?.status, 'FAILED');
    assert.strictEqual(failureEvents.filter(e => e.type === 'task.status_changed').length, 5);
    assert.strictEqual(failureEvents.filter(e => e.type === 'task.failed').length, 1);
    failureStore.close();
  } finally {
    try { store.close(); } catch {}
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log('[atomic-transactions] PASS');
    process.exit(0);
  })
  .catch(err => {
    console.error('[atomic-transactions] FAIL:', err);
    process.exit(1);
  });
