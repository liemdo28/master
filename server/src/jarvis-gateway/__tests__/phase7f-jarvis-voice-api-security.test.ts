/**
 * Phase 7F — voice API-level security tests. Same real-HTTP-server pattern
 * as phase7c-jarvis-gateway-api-security.test.ts, against the real voice
 * routes on jarvisGatewayRouter.
 */
import assert from 'assert';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';

const API_KEY = 'phase7f-voice-security-test-key';

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7f-voice-api-sec-'));
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal-os');
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'task-runtime');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'project-registry');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
  process.env.MI_CORE_API_KEY = API_KEY;

  const { jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, jarvisGatewayRouter } = require('../router');
  const { projectRegistry, taskEngine } = require('../services');

  const projectA = projectRegistry.registerProject({ displayName: 'API Sec Project', canonicalRoot: root });
  taskEngine.createTask({ userRequest: 'API sec secret task', projectId: projectA.id });

  function taskRuntimeAuth(req: Request, res: Response, next: NextFunction) {
    const supplied = String(req.headers['x-api-key'] || '');
    const expected = process.env.MI_CORE_API_KEY || '';
    if (supplied && expected && supplied === expected) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const app = express();
  app.use('/api', jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, taskRuntimeAuth, jarvisGatewayRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  let scenarios = 0;
  let passed = 0;

  async function post(pathSuffix: string, body: unknown, headers: Record<string, string> = {}) {
    return fetch(`${base}${pathSuffix}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }

  try {
    // ── Auth bypass — no key ──────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'what tasks are waiting on me', source: 'typed' });
      assert.strictEqual(res.status, 401);
      passed++;
    }

    // ── Auth bypass — wrong key ──────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'what tasks are waiting on me', source: 'typed' }, { 'x-api-key': 'wrong-key' });
      assert.strictEqual(res.status, 401);
      passed++;
    }

    // ── Missing transcript ───────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { source: 'typed' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Missing source ───────────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'hello' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Invalid source value ─────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'hello', source: 'not_a_real_source' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Oversized transcript ─────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'a'.repeat(3000), source: 'typed' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Malformed JSON ───────────────────────────────────────────────────
    {
      scenarios++;
      const res = await fetch(`${base}/api/jarvis/voice/transcript`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY }, body: '{not valid json',
      });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Confidence out of range ──────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'hello', source: 'server_stt', confidence: 1.5 }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Field-smuggling — extra unexpected fields are ignored, never
    //    interpreted as instructions (e.g. no way to smuggle a projectId
    //    override via a nested/renamed field) ────────────────────────────
    {
      scenarios++;
      const res = await post(
        '/api/jarvis/voice/transcript',
        { transcript: 'what tasks are waiting on me', source: 'typed', __proto__: { admin: true }, provider: 'openai', shellCommand: 'rm -rf /' },
        { 'x-api-key': API_KEY },
      );
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(!('admin' in body) && !('shellCommand' in body));
      passed++;
    }

    // ── Real, authenticated, safe request succeeds and never claims
    //    EXECUTED ───────────────────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'what tasks are waiting on me', projectId: projectA.id, source: 'typed' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.safetyLabel, 'SAFE');
      assert.ok(body.gatewayResponse);
      assert.ok(!JSON.stringify(body).includes('EXECUTED'));
      passed++;
    }

    // ── Forbidden intent is blocked at 200 with a BLOCKED-shaped body, not
    //    silently succeeding as a normal answer ──────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/transcript', { transcript: 'send the email to the whole team right now', source: 'typed' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.safetyLabel, 'FORBIDDEN_GMAIL_SEND');
      assert.strictEqual(body.gatewayResponse, null);
      passed++;
    }

    // ── Synthesize — missing text ─────────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/synthesize', {}, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    // ── Synthesize — unauthenticated ─────────────────────────────────────
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/synthesize', { text: 'hello' });
      assert.strictEqual(res.status, 401);
      passed++;
    }

    // ── Synthesize — authenticated, gracefully reports unavailable rather
    //    than throwing (no TTS binary present in this test environment) ──
    {
      scenarios++;
      const res = await post('/api/jarvis/voice/synthesize', { text: 'hello there' }, { 'x-api-key': API_KEY });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(typeof body.available, 'boolean');
      passed++;
    }

    // ── audio-transcribe — unauthenticated ───────────────────────────────
    {
      scenarios++;
      const res = await fetch(`${base}/api/jarvis/voice/audio-transcribe`, { method: 'POST' });
      assert.strictEqual(res.status, 401);
      passed++;
    }

    // ── audio-transcribe — authenticated, no file supplied ───────────────
    {
      scenarios++;
      const res = await fetch(`${base}/api/jarvis/voice/audio-transcribe`, { method: 'POST', headers: { 'x-api-key': API_KEY } });
      assert.strictEqual(res.status, 400);
      passed++;
    }

    assert.strictEqual(passed, scenarios);
    console.log(`[phase7f-jarvis-voice-api-security] PASS — ${passed}/${scenarios} scenarios verified`);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

run().catch(err => { console.error(err); process.exit(1); });
