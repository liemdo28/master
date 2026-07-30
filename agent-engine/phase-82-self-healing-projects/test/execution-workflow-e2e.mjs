/**
 * Sprint 5.2: Execution Workflow E2E Tests
 * Tests: plan → validate → apply → track
 *
 * Run: node execution-workflow-e2e.mjs
 * Validates: bridge.mjs /patch/plan, /patch/validate, /patch/apply, memory endpoints
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';

const BRIDGE_URL = process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:4003';
const TEST_DIR = mkdtempSync(join(tmpdir(), 'sprint52-e2e-'));
const TEST_FILE = join(TEST_DIR, 'example.txt');

let passed = 0, failed = 0;

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BRIDGE_URL}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = { raw: await res.text() }; }
  return { status: res.status, ok: res.ok, json };
}

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Sprint 5.2: Execution Workflow E2E ===\n');
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Test dir: ${TEST_DIR}`);

  // ── Health check ──────────────────────────────────────────────────────────
  console.log('\n[1] Health check');
  const health = await req('GET', '/health');
  assert(health.status === 200, 'GET /health returns 200');
  assert(health.json.status === 'ok', 'Health status is ok');
  assert(health.json.service === 'agent-engine', 'Service is agent-engine');

  // ── Capabilities ─────────────────────────────────────────────────────────────
  console.log('\n[2] Capabilities list');
  const caps = await req('GET', '/capabilities');
  assert(caps.status === 200, 'GET /capabilities returns 200');
  assert(Array.isArray(caps.json.capabilities), 'Capabilities is array');
  const hasPatch = caps.json.capabilities?.includes('patch/plan');
  assert(hasPatch, '/patch/plan is listed in capabilities');

  // ── Memory: set + get ───────────────────────────────────────────────────
  console.log('\n[3] Memory set/get');
  const setRes = await req('POST', '/memory/set', {
    key: `sprint52-${Date.now()}`,
    value: { test: true, ts: Date.now() },
  });
  assert(setRes.status === 200, 'POST /memory/set returns 200');
  assert(setRes.json.ok === true, 'Memory set returns ok');

  const memKey = setRes.json.key;
  const getRes = await req('GET', `/memory/get?key=${memKey}`);
  assert(getRes.status === 200, 'GET /memory/get returns 200');
  assert(getRes.json.value?.test === true, 'Memory get returns stored value');

  // ── Test file setup ────────────────────────────────────────────────────────
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(TEST_FILE, 'Hello World\n', 'utf8');
  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0' }), 'utf8');

  // ── Patch: plan ──────────────────────────────────────────────────────────────
  console.log('\n[4] Patch: plan');
  const planRes = await req('POST', '/patch/plan', {
    projectPath: TEST_DIR,
    task: 'Add a comment line to example.txt',
    context: { dryRun: false },
  });
  assert(planRes.status === 200, 'POST /patch/plan returns 200');
  assert(planRes.json.ok === true, 'patch/plan returns ok');

  // ── Patch: validate ─────────────────────────────────────────────────────────
  console.log('\n[5] Patch: validate');
  const plan = planRes.json.plan;
  const valRes = await req('POST', '/patch/validate', {
    projectPath: TEST_DIR,
    plan,
  });
  assert(valRes.status === 200, 'POST /patch/validate returns 200');
  assert(valRes.json.ok === true, 'patch/validate returns ok');

  // ── Patch: dry-run apply ──────────────────────────────────────────────────
  console.log('\n[6] Patch: apply (dry-run)');
  const dryRes = await req('POST', '/patch/apply', {
    projectPath: TEST_DIR,
    plan,
    dryRun: true,
  });
  assert(dryRes.status === 200, 'POST /patch/apply (dry-run) returns 200');
  assert(dryRes.json.ok === true, 'patch/apply returns ok');
  assert(dryRes.json.patchId, 'patch/apply returns patchId');

  // ── Verify dry-run didn't modify file ─────────────────────────────────────
  console.log('\n[7] Verify dry-run did NOT modify file');
  const contentAfterDry = readFileSync(TEST_FILE, 'utf8');
  assert(contentAfterDry === 'Hello World\n', 'File unchanged after dry-run');

  // ── Harness catalog ──────────────────────────────────────────────────────────
  console.log('\n[8] Harness catalog');
  const catRes = await req('GET', '/harness/catalog');
  assert(catRes.status === 200, 'GET /harness/catalog returns 200');
  assert(catRes.json.ok === true, 'catalog returns ok');

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);

  // Cleanup
  try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch { /* ignore */ }

  if (failed > 0) {
    console.log('\nE2E TESTS FAILED — Sprint 5.2');
    process.exit(1);
  } else {
    console.log('\nALL E2E TESTS PASSED — Sprint 5.2 ✓');
    process.exit(0);
  }
}

run().catch((e) => {
  console.error('Test runner error:', e.message);
  console.log(`\nResults: ${passed} passed, ${failed + 1} failed`);
  process.exit(1);
});
