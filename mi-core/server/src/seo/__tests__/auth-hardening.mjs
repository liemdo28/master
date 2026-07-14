/**
 * SEO auth hardening regression tests.
 *
 * Runs real PIN login and SEO middleware in an isolated process. These tests
 * prove role/scope come from server-side mapping, not the login body.
 */

import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { section, check, finalize } from './_harness.mjs';

process.env.NODE_ENV = 'test';
process.env.SEO_SECURITY_TEST_MODE = '1';
process.env.MI_PIN = '123456';
process.env.MI_DATA_DIR = mkdtempSync(join(tmpdir(), 'seo-auth-hardening-'));
process.env.AUTH_AUDIT_PATH = join(process.env.MI_DATA_DIR, 'auth-audit.jsonl');

const { authRouter, __createTestSessionForAuth, getAuthSessionFromToken } = await import('../../routes/auth.ts');
const { requireSeoAccess } = await import('../seo-security.ts');

function withUserMap(map) {
  process.env.MI_AUTH_USER_MAP_JSON = JSON.stringify(map);
}

async function startAuthServer() {
  const app = express();
  app.use(express.json());
  app.use('/auth', authRouter);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}` };
}

async function login(base, body) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '123456', ...body }),
  });
  return { status: res.status, body: await res.json() };
}

function makeReq({ token, query = {} } = {}) {
  return {
    method: 'GET',
    path: '/api/seo/calendar',
    url: '/api/seo/calendar',
    originalUrl: '/api/seo/calendar',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: {},
    query,
    params: {},
    ip: '127.0.0.1',
  };
}

function runMiddleware(req) {
  let statusCode = 200;
  let payload = null;
  let nextCalled = false;
  const res = {
    status(code) { statusCode = code; return this; },
    json(data) { payload = data; return this; },
  };
  requireSeoAccess(req, res, () => { nextCalled = true; });
  return { statusCode, payload, nextCalled };
}

const { server, base } = await startAuthServer();

try {
  section('Trusted role and scope assignment');
  {
    process.env.MI_AUTH_DEFAULT_USER = 'default';
    withUserMap({
      default: { role: 'SEO_VIEWER', actor_id: 'user:default', brand_scope: ['bakudan'], location_scope: ['stone_oak'] },
      ceo: { role: 'CEO', actor_id: 'user:ceo', brand_scope: ['*'], location_scope: ['*'] },
    });
    const res = await login(base, { role: 'CEO', brand_scope: ['*'], location_scope: ['*'] });
    check('login body requesting CEO is ignored when trusted mapping is SEO_VIEWER', res.status === 200 && res.body.role === 'SEO_VIEWER');
    check('login body wildcard brand scope is ignored', JSON.stringify(res.body.brand_scope) === JSON.stringify(['bakudan']));
    check('login body wildcard location scope is ignored', JSON.stringify(res.body.location_scope) === JSON.stringify(['stone_oak']));
    check('invalid login body role does not become CEO', (await login(base, { role: 'NOT_A_ROLE' })).body.role === 'SEO_VIEWER');
    const identityAttack = await login(base, { user_id: 'ceo', username: 'ceo' });
    check('login body cannot select a more privileged mapped identity', identityAttack.status === 200 && identityAttack.body.role === 'SEO_VIEWER');
  }

  section('Fail-closed trusted mapping');
  {
    delete process.env.MI_AUTH_DEFAULT_USER;
    delete process.env.MI_AUTH_USER_MAP_JSON;
    const noMap = await login(base, {});
    check('no map and no explicit legacy fallback rejects login', noMap.status === 403);

    withUserMap({ default: { role: 'SEO_VIEWER', actor_id: 'user:default', brand_scope: ['bakudan'], location_scope: ['stone_oak'] } });
    const missingDefault = await login(base, {});
    check('missing MI_AUTH_DEFAULT_USER rejects mapped login', missingDefault.status === 403);

    process.env.MI_AUTH_DEFAULT_USER = 'default';
    withUserMap({ default: { role: 'ROOT', brand_scope: ['*'], location_scope: ['*'] } });
    const invalidTrusted = await login(base, {});
    check('invalid trusted role rejects login', invalidTrusted.status === 403);

    withUserMap({ someone_else: { role: 'SEO_VIEWER', brand_scope: ['bakudan'], location_scope: ['stone_oak'] } });
    const missing = await login(base, { user_id: 'default' });
    check('missing trusted mapping rejects login', missing.status === 403);

    withUserMap({ default: { role: 'SEO_VIEWER', brand_scope: ['bakudan'], location_scope: ['stone_oak'] } });
    check('missing actor_id rejects login', (await login(base, {})).status === 403);
    withUserMap({ default: { role: 'SEO_VIEWER', actor_id: 'user:default', location_scope: ['stone_oak'] } });
    check('missing brand_scope rejects login', (await login(base, {})).status === 403);
    withUserMap({ default: { role: 'SEO_VIEWER', actor_id: 'user:default', brand_scope: ['bakudan'] } });
    check('missing location_scope rejects login', (await login(base, {})).status === 403);

    process.env.MI_AUTH_DEFAULT_USER = 'ceo';
    withUserMap({ ceo: { role: 'CEO', actor_id: 'user:ceo', brand_scope: ['*'], location_scope: ['*'] } });
    const ceo = await login(base, { user_id: 'ceo', role: 'SEO_VIEWER', brand_scope: ['bakudan'] });
    check('trusted CEO mapping still creates CEO session', ceo.status === 200 && ceo.body.role === 'CEO' && ceo.body.brand_scope.includes('*'));
    delete process.env.MI_AUTH_DEFAULT_USER;
  }

  section('Session and SEO token boundaries');
  {
    const expired = __createTestSessionForAuth({ role: 'SEO_VIEWER', ttlMs: -1 });
    check('session expiry still invalidates tokens', getAuthSessionFromToken(expired.token) === null);

    const currentNodeEnv = process.env.NODE_ENV;
    const currentTestMode = process.env.SEO_SECURITY_TEST_MODE;
    process.env.NODE_ENV = 'production';
    delete process.env.SEO_SECURITY_TEST_MODE;
    let helperBlocked = false;
    try { __createTestSessionForAuth({ role: 'CEO' }); } catch { helperBlocked = true; }
    process.env.NODE_ENV = currentNodeEnv;
    process.env.SEO_SECURITY_TEST_MODE = currentTestMode;
    check('test-only session helper remains unavailable outside test mode', helperBlocked);

    process.env.SEO_SECURITY_TEST_MODE = '1';
    const session = __createTestSessionForAuth({ role: 'CEO' });
    const queryOnly = runMiddleware(makeReq({ query: { token: session.token } }));
    check('/api/seo rejects query token without Bearer header', queryOnly.statusCode === 401 && queryOnly.payload?.error === 'seo_bearer_auth_required');

    const bearer = runMiddleware(makeReq({ token: session.token }));
    check('/api/seo accepts Bearer session for read route', bearer.nextCalled === true);
  }
} finally {
  await new Promise(resolve => server.close(resolve));
  try { rmSync(process.env.MI_DATA_DIR, { recursive: true, force: true }); } catch {}
}

const result = finalize('auth-hardening.mjs');
assert.equal(result.fail, 0);
