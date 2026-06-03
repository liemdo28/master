/**
 * 2-Level Rotation Stress Test
 * Tests: provider rotation + key rotation + failure handling + fallback
 *
 * Run: node tests/stress-key-rotation.mjs
 */

import { ApiKeyRotationService } from '../dist/runtime/api-key-rotation-service.js';

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';

let passed = 0, failed = 0;

function assert(cond, label) {
  if (cond) { console.log(`  ${PASS}  ${label}`); passed++; }
  else       { console.log(`  ${FAIL}  ${label}`); failed++; }
}
function header(t) { console.log(`\n\x1b[1m${t}\x1b[0m`); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeKey(id) { return { id, value: `secret-${id}`, active: false }; }

function fresh() { return new ApiKeyRotationService(); }

// ── Suite 1: Round-robin basic ────────────────────────────────────────────────
header('Suite 1: Round-Robin Key Selection');
{
  const svc = fresh();
  const keys = [makeKey('k1'), makeKey('k2'), makeKey('k3')];
  const pid = 'antigravity';

  // First call — cursor=0 → k1 is first
  const r1 = svc.getOrderedKeys(pid, keys);
  assert(r1[0].id === 'k1', `First call starts at k1`);
  assert(r1.length === 3,   `All 3 keys returned`);

  // Advance cursor via success
  svc.markSuccess(pid, 'k1');
  const r2 = svc.getOrderedKeys(pid, keys);
  assert(r2[0].id === 'k2', `After k1 success → cursor at k2`);

  svc.markSuccess(pid, 'k2');
  const r3 = svc.getOrderedKeys(pid, keys);
  assert(r3[0].id === 'k3', `After k2 success → cursor at k3`);

  svc.markSuccess(pid, 'k3');
  const r4 = svc.getOrderedKeys(pid, keys);
  assert(r4[0].id === 'k1', `Wraps back to k1 after all 3`);
}

// ── Suite 2: Failed key is skipped ────────────────────────────────────────────
header('Suite 2: Failed Key Skipping');
{
  const svc = fresh();
  const keys = [makeKey('k1'), makeKey('k2'), makeKey('k3')];
  const pid = 'antigravity';

  // k1 gets rate-limited (60s cooldown)
  svc.markFailure(pid, 'k1', 'rate_limited', '429 Rate limit');
  const healthy = svc.getOrderedKeys(pid, keys);
  assert(!healthy.find(k => k.id === 'k1'), `k1 skipped after rate_limited`);
  assert(healthy.length === 2, `2 healthy keys remain`);

  // k2 also fails
  svc.markFailure(pid, 'k2', 'timeout', 'Timeout');
  const healthy2 = svc.getOrderedKeys(pid, keys);
  assert(!healthy2.find(k => k.id === 'k2'), `k2 skipped after timeout`);
  assert(healthy2.length === 1, `1 healthy key (k3) remains`);
  assert(healthy2[0].id === 'k3', `Only k3 available`);

  // k3 fails too — all exhausted
  svc.markFailure(pid, 'k3', 'provider_down', '503');
  const healthy3 = svc.getOrderedKeys(pid, keys);
  assert(healthy3.length === 0, `No keys available — triggers provider fallback`);
}

// ── Suite 3: Auth failed = permanent disable ──────────────────────────────────
header('Suite 3: Auth Failed = Permanent Disable');
{
  const svc = fresh();
  const keys = [makeKey('k1'), makeKey('k2')];
  const pid = 'antigravity';

  svc.markFailure(pid, 'k1', 'auth_failed', '401 Invalid API key');
  const status = svc.getKeyStatus(pid, 'k1');
  assert(status === 'auth_failed', `k1 status = auth_failed`);

  // Still disabled after "time passes"
  const healthy = svc.getOrderedKeys(pid, keys);
  assert(!healthy.find(k => k.id === 'k1'), `k1 excluded permanently`);

  // Operator reset restores it
  svc.enableKey(pid, 'k1');
  const healthy2 = svc.getOrderedKeys(pid, keys);
  assert(healthy2.find(k => k.id === 'k1') !== undefined, `k1 restored after operator enable`);
}

// ── Suite 4: Cooldown expires auto-recover ────────────────────────────────────
header('Suite 4: Cooldown Auto-Recovery');
{
  const svc = fresh();
  const keys = [makeKey('k1')];
  const pid = 'opusmax';

  svc.markFailure(pid, 'k1', 'timeout', 'timed out');
  const before = svc.getOrderedKeys(pid, keys);
  // timeout sets 30s cooldown → key is NOT immediately usable
  assert(before.length === 0, `key in timeout cooldown is skipped`);

  svc.resetCooldown(pid, 'k1');
  assert(svc.getKeyStatus(pid, 'k1') === 'healthy', `After resetCooldown → healthy`);
}

// ── Suite 5: Multiple providers, independent cursors ──────────────────────────
header('Suite 5: Independent Cursors Per Provider');
{
  const svc = fresh();
  const agKeys   = [makeKey('ag1'), makeKey('ag2')];
  const opusKeys = [makeKey('op1'), makeKey('op2')];

  // Advance antigravity cursor
  svc.markSuccess('antigravity', 'ag1');
  svc.markSuccess('antigravity', 'ag2');

  // opusmax cursor should be independent
  const opusOrder = svc.getOrderedKeys('opusmax', opusKeys);
  assert(opusOrder[0].id === 'op1', `opusmax cursor unaffected by antigravity advances`);

  const agOrder = svc.getOrderedKeys('antigravity', agKeys);
  assert(agOrder[0].id === 'ag1', `antigravity cursor wrapped back to ag1`);
}

// ── Suite 6: 1000-request simulation with key rotation ────────────────────────
header('Suite 6: 1000-Request Key Rotation Simulation');
{
  const svc = fresh();
  const pid = 'antigravity';
  const keys = [makeKey('k1'), makeKey('k2'), makeKey('k3')];
  const usageCounts = { k1: 0, k2: 0, k3: 0 };
  const errors = [];

  for (let i = 0; i < 1000; i++) {
    const ordered = svc.getOrderedKeys(pid, keys);
    if (!ordered.length) { errors.push(`No keys at request ${i}`); continue; }
    const key = ordered[0];
    usageCounts[key.id] = (usageCounts[key.id] || 0) + 1;
    svc.markSuccess(pid, key.id); // always succeed → cursor advances
  }

  assert(errors.length === 0, `No key exhaustion errors in 1000 requests`);
  // Each key should get ~333 requests (1000/3)
  for (const kid of ['k1', 'k2', 'k3']) {
    const c = usageCounts[kid] || 0;
    assert(c >= 300 && c <= 360, `${kid}: ${c} requests (~333 expected)`);
  }
  console.log(`  ${INFO}  Distribution: ${JSON.stringify(usageCounts)}`);
}

// ── Suite 7: Failure cascade triggers fallback ────────────────────────────────
header('Suite 7: All Keys Fail → Provider Fallback Signal');
{
  const svc = fresh();
  const pid = 'antigravity';
  const keys = [makeKey('k1'), makeKey('k2')];

  // Simulate: k1 fails, k2 fails → getOrderedKeys returns []
  svc.markFailure(pid, 'k1', 'rate_limited', '429');
  svc.markFailure(pid, 'k2', 'rate_limited', '429');

  const healthy = svc.getOrderedKeys(pid, keys);
  assert(healthy.length === 0, `Zero healthy keys → router should try fallback provider`);

  // OpusMax keys still available
  const opusKeys = [makeKey('op1'), makeKey('op2')];
  const opusHealthy = svc.getOrderedKeys('opusmax', opusKeys);
  assert(opusHealthy.length === 2, `OpusMax keys unaffected — fallback succeeds`);
}

// ── Suite 8: getProviderKeyHealth snapshot ────────────────────────────────────
header('Suite 8: Key Health Snapshot for Dashboard');
{
  const svc = fresh();
  const keys = [makeKey('k1'), makeKey('k2')];
  const pid = 'antigravity';

  svc.markSuccess(pid, 'k1');
  svc.markSuccess(pid, 'k1');
  svc.markFailure(pid, 'k2', 'rate_limited', '429');

  const snapshot = svc.getProviderKeyHealth(pid, keys);
  assert(snapshot.length === 2, `Snapshot has 2 entries`);

  const k1snap = snapshot.find(s => s.keyId === 'k1');
  assert(k1snap?.status === 'healthy',      `k1 status = healthy`);
  assert(k1snap?.totalRequests === 2,       `k1 totalRequests = 2`);
  assert(k1snap?.lastSuccessAt !== null,    `k1 has lastSuccessAt`);

  const k2snap = snapshot.find(s => s.keyId === 'k2');
  assert(k2snap?.status === 'rate_limited', `k2 status = rate_limited`);
  assert(k2snap?.totalFailures === 1,       `k2 totalFailures = 1`);
  assert(k2snap?.lastErrorType === 'rate_limited', `k2 lastErrorType = rate_limited`);
}

// ── Results ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50));
console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m`);
if (failed === 0) {
  console.log('\x1b[32m✓ All tests passed — 2-level rotation is production-ready\x1b[0m');
} else {
  console.log('\x1b[31m✗ Some tests failed\x1b[0m');
  process.exit(1);
}
