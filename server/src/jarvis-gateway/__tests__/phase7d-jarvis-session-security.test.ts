/**
 * Phase 7D — session endpoint security tests. Boots a real HTTP server
 * mounting the real jarvisGatewayRouter twice, matching index.ts's actual
 * dual-mount: `/api/command-center` behind a remote-session mock (sets
 * `req.device_id`, mirroring requireRemoteAuth's actual behavior byte-for-
 * byte — same convention phase7c-jarvis-gateway-api-security.test.ts already
 * uses for requireTaskRuntimeAuth) and bare `/api` behind an API-key mock.
 */
import assert from 'assert';
import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { NextFunction, Request, Response } from 'express';

const API_KEY = 'phase7d-session-security-test-key';

async function run(): Promise<void> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mi-7d-session-sec-'));
  process.env.MI_PERSONAL_OS_DIR = path.join(root, 'personal-os');
  process.env.MI_TASK_RUNTIME_DIR = path.join(root, 'task-runtime');
  process.env.MI_PROJECT_REGISTRY_DIR = path.join(root, 'project-registry');
  process.env.MI_PROJECT_REGISTRY_WORKSPACE_ROOTS = root;
  process.env.MI_CORE_API_KEY = API_KEY;

  const { jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, jarvisGatewayRouter } = require('../router');

  function taskRuntimeAuth(req: Request, res: Response, next: NextFunction) {
    const supplied = String(req.headers['x-api-key'] || '');
    if (supplied && supplied === API_KEY) return next();
    return res.status(401).json({ error: 'Unauthorized' });
  }
  function remoteSessionAuth(req: Request, res: Response, next: NextFunction) {
    const token = String(req.headers['x-session-token'] || '');
    if (token === 'device-A-token') { (req as Request & { device_id?: string }).device_id = 'device-A'; return next(); }
    if (token === 'device-B-token') { (req as Request & { device_id?: string }).device_id = 'device-B'; return next(); }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const app = express();
  app.use('/api/command-center', jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, remoteSessionAuth, jarvisGatewayRouter);
  app.use('/api', jarvisGatewayJsonParser, jarvisGatewayJsonErrorHandler, taskRuntimeAuth, jarvisGatewayRouter);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  let scenarios = 0;
  let passed = 0;
  const assertPass = (cond: boolean, msg: string) => { scenarios++; assert.ok(cond, msg); passed++; };

  try {
    // ── Unauthenticated GET /jarvis/session/current rejected on both mounts ──
    {
      const r1 = await fetch(`${base}/api/jarvis/session/current`);
      assertPass(r1.status === 401, 'unauthenticated GET /api/jarvis/session/current must be rejected');
      const r2 = await fetch(`${base}/api/command-center/jarvis/session/current`);
      assertPass(r2.status === 401, 'unauthenticated GET /api/command-center/jarvis/session/current must be rejected');
    }

    // ── api_key caller with no ?sessionId= gets 404, not an empty/forged session ──
    {
      const res = await fetch(`${base}/api/jarvis/session/current`, { headers: { 'x-api-key': API_KEY } });
      assertPass(res.status === 404, 'api_key caller with no ?sessionId= query param must get 404, never a fabricated session');
    }

    // ── remote_session (device A) creates a turn, then reads its own session back ──
    {
      const post = await fetch(`${base}/api/command-center/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': 'device-A-token' },
        body: JSON.stringify({ text: 'hello from device A' }),
      });
      const postBody = await post.json() as { sessionId: string | null };
      assertPass(postBody.sessionId === 'device:device-A', `expected device:device-A, got ${postBody.sessionId}`);

      const get = await fetch(`${base}/api/command-center/jarvis/session/current`, { headers: { 'x-session-token': 'device-A-token' } });
      assertPass(get.status === 200, 'device A must be able to read its own session');
      const session = await get.json() as { sessionId: string; turns: unknown[] };
      assertPass(session.sessionId === 'device:device-A' && session.turns.length === 1, 'device A must see exactly its own 1 recorded turn');
    }

    // ── Cross-tenant isolation: device B can never read device A's session ──
    {
      const getAsB = await fetch(`${base}/api/command-center/jarvis/session/current`, { headers: { 'x-session-token': 'device-B-token' } });
      assertPass(getAsB.status === 404, 'device B must get 404 for its own (never-yet-created) session, never device A\'s data');
      const bodyText = await getAsB.text();
      assertPass(!bodyText.includes('hello from device A'), 'device B\'s response must never contain device A\'s turn text');
    }

    // ── Forged device_id in a JSON request body has zero effect: the router ──
    // ── only ever reads req.device_id (set exclusively by trusted auth ──
    // ── middleware), never any client-supplied body/query field of the ──
    // ── same name. An api_key caller trying to impersonate device A by ──
    // ── putting "device_id":"device-A" in its POST body must still resolve ──
    // ── via the plain api_key/explicit path, never gain device A's identity. ──
    {
      const post = await fetch(`${base}/api/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ text: 'attempting identity forgery', device_id: 'device-A', sessionId: 'device-A' }),
      });
      const postBody = await post.json() as { sessionId: string | null };
      assertPass(postBody.sessionId === 'explicit:device-A', `a spoofed body.device_id must be silently ignored — expected explicit:device-A (the literal sessionId string, api_key-namespaced), got ${postBody.sessionId}`);
      assertPass(postBody.sessionId !== 'device:device-A', 'must never resolve to the bare device:device-A key that a real authenticated device A request would get');
    }

    // ── GET /jarvis/request/:id ownership: device B can never read device A's stored response ──
    // (found by independent review of PR #105 — 7C's endpoint had no
    // ownership check, and 7D raised its sensitivity by adding sessionId
    // to every stored response).
    {
      const post = await fetch(`${base}/api/command-center/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-token': 'device-A-token' },
        body: JSON.stringify({ text: 'device A private request' }),
      });
      const postBody = await post.json() as { requestId: string };

      const ownerGet = await fetch(`${base}/api/command-center/jarvis/request/${postBody.requestId}`, { headers: { 'x-session-token': 'device-A-token' } });
      assertPass(ownerGet.status === 200, 'the creating caller (device A) must still be able to read its own stored request');

      const otherDeviceGet = await fetch(`${base}/api/command-center/jarvis/request/${postBody.requestId}`, { headers: { 'x-session-token': 'device-B-token' } });
      assertPass(otherDeviceGet.status === 404, 'a different device must get 404, never device A\'s stored response, even with a valid requestId');

      const apiKeyGet = await fetch(`${base}/api/jarvis/request/${postBody.requestId}`, { headers: { 'x-api-key': API_KEY } });
      assertPass(apiKeyGet.status === 404, 'an api_key caller must never read a remote_session caller\'s stored request either');
    }

    // ── GET /jarvis/session/current query sessionId length validation ───────
    {
      const res = await fetch(`${base}/api/jarvis/session/current?sessionId=${'x'.repeat(200)}`, { headers: { 'x-api-key': API_KEY } });
      assertPass(res.status === 400, 'an oversized ?sessionId= query param must be rejected with 400, same as POST body validation');
    }

    // ── An api_key caller can never read a device: session by guessing the id ──
    {
      const res = await fetch(`${base}/api/jarvis/session/current?sessionId=${encodeURIComponent('device:device-A')}`, { headers: { 'x-api-key': API_KEY } });
      // Must resolve to explicit:device:device-A (a different, empty session), never the real device-A session.
      assertPass(res.status === 404, 'an api_key caller passing "device:device-A" as its own explicit sessionId must never see device A\'s real session (must land on a distinct, empty explicit: session instead)');
    }

    // ── api_key session round-trip via its own explicit id works normally ──
    {
      const sessionId = 'my-explicit-session';
      const post = await fetch(`${base}/api/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ text: 'hello', sessionId }),
      });
      const postBody = await post.json() as { sessionId: string | null };
      assertPass(postBody.sessionId === `explicit:${sessionId}`, `expected explicit:${sessionId}, got ${postBody.sessionId}`);

      const get = await fetch(`${base}/api/jarvis/session/current?sessionId=${encodeURIComponent(sessionId)}`, { headers: { 'x-api-key': API_KEY } });
      assertPass(get.status === 200, 'the same api_key caller must be able to read back its own explicit session');
    }

    // ── sessionId length validation ──────────────────────────────────────────
    {
      const res = await fetch(`${base}/api/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ text: 'hello', sessionId: 'x'.repeat(200) }),
      });
      assertPass(res.status === 400, 'an oversized sessionId must be rejected with 400');
    }
    {
      const res = await fetch(`${base}/api/jarvis/request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ text: 'hello', sessionId: 12345 }),
      });
      assertPass(res.status === 400, 'a non-string sessionId must be rejected with 400');
    }
  } finally {
    server.close();
  }

  assert.strictEqual(passed, scenarios);
  console.log(`[phase7d-jarvis-session-security] PASS — ${passed}/${scenarios} scenarios verified`);
}

run().catch(err => { console.error(err); process.exit(1); });
