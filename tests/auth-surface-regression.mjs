#!/usr/bin/env node
/**
 * Auth Surface Regression Test
 * Verifies that protected endpoints enforce auth and public endpoints
 * do not expose sensitive data without a token.
 *
 * Usage: node tests/auth-surface-regression.mjs
 * Requires: mi-core running on localhost:4001, MI_PIN set in env
 */

import http from 'http';

const BASE = 'http://localhost:4001';
const CORRECT_PIN = process.env.TEST_PIN || '4452';
const WRONG_PIN   = '0000';

let pass = 0;
let fail = 0;

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const payload = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...headers,
      },
    };
    const r = http.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    fail++;
  }
}

// ── T1: Login ────────────────────────────────────────────────────────────────
console.log('\n[T1] Login endpoint');

const loginOk = await req('POST', '/api/auth/login', { pin: CORRECT_PIN });
assert('Correct PIN → 200', loginOk.status === 200, `got ${loginOk.status}`);
assert('Response has token', typeof loginOk.body?.token === 'string');
const TOKEN = loginOk.body?.token ?? '';

const loginBad = await req('POST', '/api/auth/login', { pin: WRONG_PIN });
assert('Wrong PIN → 401', loginBad.status === 401, `got ${loginBad.status}`);

const loginEmpty = await req('POST', '/api/auth/login', { pin: '' });
assert('Empty PIN → 400', loginEmpty.status === 400, `got ${loginEmpty.status}`);

// ── T2: Protected endpoints reject without token ─────────────────────────────
console.log('\n[T2] Protected endpoints → 401 without token');

const PROTECTED = [
  ['POST', '/api/chat'],
  ['GET',  '/api/approval/pending'],
  ['GET',  '/api/memory'],
  ['GET',  '/api/graph'],
  ['GET',  '/api/brain'],
  ['GET',  '/api/operations/health'],
  ['GET',  '/api/nodes'],
];

for (const [method, path] of PROTECTED) {
  const r = await req(method, path, method === 'POST' ? { message: 'test' } : undefined);
  assert(`${method} ${path} → 401`, r.status === 401, `got ${r.status}`);
}

// ── T3: Protected endpoints accept valid token ───────────────────────────────
console.log('\n[T3] Protected endpoints → accept valid token');

if (!TOKEN) {
  console.log('  ⚠️  No token — skipping T3 (login failed above)');
} else {
  const authHeader = { Authorization: `Bearer ${TOKEN}` };

  const approvalR = await req('GET', '/api/approval/pending', undefined, authHeader);
  assert('GET /api/approval/pending → not 401', approvalR.status !== 401, `got ${approvalR.status}`);

  const opsR = await req('GET', '/api/operations/health', undefined, authHeader);
  assert('GET /api/operations/health → not 401', opsR.status !== 401, `got ${opsR.status}`);

  const nodesR = await req('GET', '/api/nodes', undefined, authHeader);
  assert('GET /api/nodes → not 401', nodesR.status !== 401, `got ${nodesR.status}`);
}

// ── T4: Public endpoints remain accessible ───────────────────────────────────
console.log('\n[T4] Public endpoints → accessible without token');

const PUBLIC = [
  ['GET',  '/api/health'],
  ['GET',  '/api/remote/health'],
  ['POST', '/api/auth/login'],
];

for (const [method, path] of PUBLIC) {
  const r = await req(method, path, method === 'POST' ? { pin: CORRECT_PIN } : undefined);
  assert(`${method} ${path} → not 401`, r.status !== 401, `got ${r.status}`);
}

// ── T5: Public endpoints expose no sensitive data without auth ───────────────
console.log('\n[T5] Public endpoints expose no sensitive data');

const healthR = await req('GET', '/api/health');
const body = JSON.stringify(healthR.body ?? '');
assert('/api/health has no token field', !body.includes('"token"'));
assert('/api/health has no PIN field',   !body.includes('"pin"'));

// ── Summary ──────────────────────────────────────────────────────────────────
const total = pass + fail;
console.log(`\n${'─'.repeat(60)}`);
console.log(`Auth Surface Regression: ${pass}/${total} PASS`);
if (fail > 0) {
  console.log(`AUTH_REGRESSION_FAIL: ${fail} test(s) failed`);
  process.exit(1);
} else {
  console.log('AUTH_REGRESSION_PASS: ✅');
}
