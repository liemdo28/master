// HTTP boundary checks: real JSON parser limits, malformed JSON, auth, and path safety.

import express from 'express';
import http from 'http';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import assert from 'assert';
import type { AddressInfo } from 'net';
import { TaskStore } from '../store';
import { createTaskRuntimeRouter, taskRuntimeJsonErrorHandler, taskRuntimeJsonParser } from '../../routes/task-runtime';
import { requireAuth } from '../../routes/auth';

function startApp(store: TaskStore): Promise<{ baseUrl: string; port: number; close: () => Promise<void> }> {
  const app = express();
  app.use('/api/task-runtime', taskRuntimeJsonParser, requireAuth, createTaskRuntimeRouter(store));
  app.use(taskRuntimeJsonErrorHandler);
  return new Promise(resolve => {
    const server = app.listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}/api/task-runtime`,
        port,
        close: () => new Promise<void>((res, rej) => server.close(err => (err ? rej(err) : res()))),
      });
    });
  });
}

function postChunked(port: number, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port,
      path: '/api/task-runtime/tasks',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
    }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    for (let i = 0; i < body.length; i += 32_768) req.write(body.slice(i, i + 32_768));
    req.end();
  });
}

async function run() {
  const oldPin = process.env.MI_PIN;
  const oldApiKey = process.env.MI_CORE_API_KEY;
  const oldBypass = process.env.LOCALHOST_BYPASS;
  process.env.MI_PIN = '123456';
  process.env.MI_CORE_API_KEY = 'test-key';
  process.env.LOCALHOST_BYPASS = 'false';

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-task-runtime-body-auth-'));
  const store = new TaskStore(dataDir);
  const app = await startApp(store);
  try {
    const unauth = await fetch(`${app.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userRequest: 'unauth', workingDirectory: process.cwd() }),
    });
    assert.strictEqual(unauth.status, 401);

    const auth = await fetch(`${app.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify({ userRequest: 'auth ok', workingDirectory: process.cwd() }),
    });
    assert.strictEqual(auth.status, 201);
    const task = await auth.json();

    const malformed = await fetch(`${app.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
      body: '{"userRequest":',
    });
    assert.strictEqual(malformed.status, 400);
    const malformedBody = await malformed.text();
    assert.ok(!/SyntaxError|stack|at /.test(malformedBody));

    const oversized = await fetch(`${app.baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': 'test-key' },
      body: JSON.stringify({ userRequest: 'x'.repeat(1024 * 1024 + 1), workingDirectory: process.cwd() }),
    });
    assert.strictEqual(oversized.status, 413);

    const chunked = await postChunked(app.port, JSON.stringify({ userRequest: 'y'.repeat(1024 * 1024 + 1), workingDirectory: process.cwd() }));
    assert.strictEqual(chunked.status, 413);

    const badTaskId = await fetch(`${app.baseUrl}/tasks/${encodeURIComponent('../tasks.db')}`, {
      headers: { 'x-api-key': 'test-key' },
    });
    assert.strictEqual(badTaskId.status, 400);

    const badEvidence = await fetch(`${app.baseUrl}/tasks/${task.id}/evidence/${encodeURIComponent('/etc/passwd')}`, {
      headers: { 'x-api-key': 'test-key' },
    });
    assert.strictEqual(badEvidence.status, 400);
  } finally {
    await app.close();
    store.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
    if (oldPin === undefined) delete process.env.MI_PIN; else process.env.MI_PIN = oldPin;
    if (oldApiKey === undefined) delete process.env.MI_CORE_API_KEY; else process.env.MI_CORE_API_KEY = oldApiKey;
    if (oldBypass === undefined) delete process.env.LOCALHOST_BYPASS; else process.env.LOCALHOST_BYPASS = oldBypass;
  }
}

run()
  .then(() => {
    console.log('[body-auth-path] PASS');
  })
  .catch(err => {
    console.error('[body-auth-path] FAIL:', err);
    process.exitCode = 1;
  });
