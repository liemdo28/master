// Integration test for the task-runtime HTTP boundary (routes/task-runtime.ts).
// Proves the router works over real HTTP requests, and that state survives a
// simulated restart, WITHOUT importing index.ts — this router is not mounted
// there yet (see docs/architecture/MIGRATION_PLAN.md "Integration boundary").
//
// Run: cd mi-core/server && npx tsx src/task-runtime/__tests__/http-integration.test.ts

import express from 'express';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import type { AddressInfo } from 'net';
import { TaskStore } from '../store';
import { createTaskRuntimeRouter } from '../../routes/task-runtime';

function log(msg: string) {
  console.log(`[http-integration] ${msg}`);
}

function startApp(store: TaskStore): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use('/api/task-runtime', createTaskRuntimeRouter(store));
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-http-'));
  log(`using isolated data dir: ${tmpDir}`);

  // ── Server instance 1: create + run a task over real HTTP ────────────────
  let store = new TaskStore(tmpDir);
  let app1 = await startApp(store);

  const outsideCwdRes = await fetch(`${app1.baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userRequest: 'Try outside cwd', workingDirectory: path.resolve(process.cwd(), '..') }),
  });
  assert.strictEqual(outsideCwdRes.status, 400, 'workingDirectory outside workspace must be rejected');
  log('confirmed workingDirectory path escape is rejected');

  const createRes = await fetch(`${app1.baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userRequest: 'Inspect repository via HTTP', workingDirectory: process.cwd() }),
  });
  assert.strictEqual(createRes.status, 201);
  const task = await createRes.json();
  assert.strictEqual(task.status, 'CREATED');
  log(`created task via HTTP: ${task.id}`);

  const missingCmdRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'rm', args: ['-rf', '/'] }),
  });
  assert.strictEqual(missingCmdRes.status, 400, 'disallowed command must be rejected with 400');
  log('confirmed disallowed command is rejected over HTTP');

  const nodeEvalRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'node', args: ['-e', 'console.log("unsafe")'] }),
  });
  assert.strictEqual(nodeEvalRes.status, 409, 'node -e must be rejected by args allowlist');
  log('confirmed unsafe node args are rejected over HTTP');

  const metacharRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'node', args: ['--version;whoami'] }),
  });
  assert.strictEqual(metacharRes.status, 409, 'shell metacharacters must be rejected');
  log('confirmed shell metacharacters are rejected over HTTP');

  const badIdRes = await fetch(`${app1.baseUrl}/tasks/${encodeURIComponent('../tasks')}`);
  assert.strictEqual(badIdRes.status, 400, 'malformed task IDs must be rejected');
  log('confirmed malformed task IDs are rejected over HTTP');

  const inspectRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/inspect`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command: 'node', args: ['--version'] }),
  });
  assert.strictEqual(inspectRes.status, 200);
  const inspectBody = await inspectRes.json();
  assert.strictEqual(inspectBody.exitCode, 0);
  assert.strictEqual(inspectBody.task.status, 'COMPLETED');
  log(`task completed via HTTP, exitCode=${inspectBody.exitCode}`);

  const eventsRes = await fetch(`${app1.baseUrl}/tasks/${task.id}/events`);
  const events = await eventsRes.json();
  assert.ok(events.some((e: any) => e.type === 'command.completed'));
  assert.ok(events.some((e: any) => e.type === 'task.completed'));

  await app1.close();
  store.close();
  log('closed server instance 1 (simulated process end)');

  // ── Server instance 2: fresh store + fresh express app, same data dir ────
  store = new TaskStore(tmpDir);
  const app2 = await startApp(store);

  const recoveredRes = await fetch(`${app2.baseUrl}/tasks/${task.id}`);
  assert.strictEqual(recoveredRes.status, 200);
  const recovered = await recoveredRes.json();
  assert.strictEqual(recovered.status, 'COMPLETED', 'status must survive restart');
  assert.strictEqual(recovered.id, task.id);

  const listRes = await fetch(`${app2.baseUrl}/tasks`);
  const list = await listRes.json();
  assert.ok(list.some((t: any) => t.id === task.id), 'task must be visible in list after restart');

  await app2.close();
  store.close();
  log('PASS — HTTP boundary created, executed, and recovered a task across a simulated restart');

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

run()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[http-integration] FAIL:', err);
    process.exit(1);
  });
