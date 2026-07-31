// Verifies allowed commands with non-zero exits fail the task instead of
// producing a false COMPLETED state.

import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import type { AddressInfo } from 'net';
import { TaskStore } from '../store';
import { createTaskRuntimeRouter, taskRuntimeJsonErrorHandler, taskRuntimeJsonParser } from '../../routes/task-runtime';

function startApp(store: TaskStore): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(taskRuntimeJsonParser);
  app.use('/api/task-runtime', createTaskRuntimeRouter(store));
  app.use(taskRuntimeJsonErrorHandler);
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api/task-runtime`,
        close: () => new Promise<void>((res, rej) => server.close(err => (err ? rej(err) : res()))),
      });
    });
  });
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-failure-data-'));
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-failure-workspace-'));
  const oldRoots = process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS;
  process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = workspaceDir;

  let store = new TaskStore(dataDir);
  const app1 = await startApp(store);
  try {
    const createRes = await fetch(`${app1.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userRequest: 'Fail deterministically', workingDirectory: workspaceDir }),
    });
    assert.strictEqual(createRes.status, 201);
    const task = await createRes.json();

    const runRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/inspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ command: 'node', args: ['--task-runtime-intentional-failure'] }),
    });
    assert.strictEqual(runRes.status, 422);
    const runBody = await runRes.json();
    assert.strictEqual(runBody.task.status, 'FAILED');
    assert.notStrictEqual(runBody.exitCode, 0);
    assert.ok(runBody.relativePath.endsWith('/step-1-command.json'));

    const eventsRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/events`);
    const events = await eventsRes.json();
    assert.ok(events.some((e: any) => e.type === 'task.failed'));
    assert.ok(!events.some((e: any) => e.type === 'task.completed'));

    const evidencePath = path.join(dataDir, 'evidence', runBody.relativePath);
    assert.ok(fs.existsSync(evidencePath), 'evidence must remain available for failed commands');
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    assert.notStrictEqual(evidence.exitCode, 0);
    assert.ok('stdout' in evidence);
    assert.ok('stderr' in evidence);

    store.close();

    store = new TaskStore(dataDir);
    const recovered = store.getTask(task.id);
    const recoveredEvents = store.listEvents(task.id);
    assert.strictEqual(recovered?.status, 'FAILED');
    assert.strictEqual(recoveredEvents.filter(e => e.type === 'command.completed').length, 1);
    assert.strictEqual(recoveredEvents.filter(e => e.type === 'task.failed').length, 1);
  } finally {
    await app1.close().catch(() => undefined);
    store.close();
    if (oldRoots === undefined) delete process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS;
    else process.env.MI_TASK_RUNTIME_WORKSPACE_ROOTS = oldRoots;
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(workspaceDir, { recursive: true, force: true });
  }
}

run()
  .then(() => {
    console.log('[execution-failure] PASS');
  })
  .catch(err => {
    console.error('[execution-failure] FAIL:', err);
    process.exitCode = 1;
  });
