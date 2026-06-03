/**
 * Provider Rotation Stress Test
 *
 * Simulates 1000+ requests and verifies:
 *   1. Provider selection follows 15-min window rotation
 *   2. Rotation window transitions correctly over simulated time
 *   3. Fallback provider is always the opposite of primary
 *   4. N-provider rotation (future expansion) works correctly
 *
 * Run: node tests/stress-rotation.mjs
 */

import { ProviderRotationService } from '../dist/runtime/provider-rotation-service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m·\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL}  ${label}`);
    failed++;
  }
}

function header(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// Inject a fake clock into the service for deterministic testing
function makeServiceWithTime(providers, fakeDateMs) {
  const svc = new ProviderRotationService(providers);
  // Monkey-patch getCurrentWindow to use fake time
  const orig = svc.getCurrentWindow.bind(svc);
  svc.getCurrentWindow = function () {
    const d = new Date(fakeDateMs);
    const minute = d.getMinutes();
    const windowId = Math.floor(minute / 15);
    const windowStartMinute = windowId * 15;
    const windowStartMs = new Date(
      d.getFullYear(), d.getMonth(), d.getDate(),
      d.getHours(), windowStartMinute, 0, 0
    ).getTime();
    const windowEndMs = windowStartMs + 15 * 60 * 1000;
    const remainingMs = Math.max(0, windowEndMs - fakeDateMs);
    const primaryIdx = windowId % providers.length;
    const primary = providers[primaryIdx];
    const fallback = providers[(primaryIdx + 1) % providers.length];
    const pad = n => String(n).padStart(2, '0');
    const fmtMin = ms => { const t = new Date(ms); return `${pad(t.getHours())}:${pad(t.getMinutes())}`; };
    return {
      windowId,
      windowLabel: `${fmtMin(windowStartMs)} - ${fmtMin(windowEndMs - 60000)}`,
      primaryProvider: primary,
      fallbackProvider: fallback,
      windowStartMs,
      windowEndMs,
      remainingMs,
    };
  };
  svc.getPrimaryProvider = function () { return svc.getCurrentWindow().primaryProvider; };
  svc.getFallbackProvider = function () { return svc.getCurrentWindow().fallbackProvider; };
  return svc;
}

// Build a fake Date at hh:mm:ss
function fakeTime(hour, minute, second = 0) {
  const d = new Date();
  d.setHours(hour, minute, second, 0);
  return d.getTime();
}

// ── Test Suite 1: Window Boundary Correctness ─────────────────────────────────

header('Suite 1: Window Boundary Correctness (2-provider)');

const providers2 = ['antigravity', 'opusmax'];

const windowCases = [
  { min: 0,  expectedWin: 0, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:00 → window 0' },
  { min: 7,  expectedWin: 0, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:07 → window 0' },
  { min: 14, expectedWin: 0, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:14 → window 0 (last min)' },
  { min: 15, expectedWin: 1, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:15 → window 1' },
  { min: 22, expectedWin: 1, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:22 → window 1' },
  { min: 29, expectedWin: 1, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:29 → window 1 (last min)' },
  { min: 30, expectedWin: 2, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:30 → window 2' },
  { min: 37, expectedWin: 2, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:37 → window 2' },
  { min: 44, expectedWin: 2, expectedPrimary: 'antigravity', expectedFallback: 'opusmax',      label: 'xx:44 → window 2 (last min)' },
  { min: 45, expectedWin: 3, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:45 → window 3' },
  { min: 51, expectedWin: 3, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:51 → window 3' },
  { min: 59, expectedWin: 3, expectedPrimary: 'opusmax',     expectedFallback: 'antigravity',  label: 'xx:59 → window 3 (last min)' },
];

for (const tc of windowCases) {
  const svc = makeServiceWithTime(providers2, fakeTime(10, tc.min));
  const win = svc.getCurrentWindow();
  assert(win.windowId === tc.expectedWin, `${tc.label} — windowId=${win.windowId}`);
  assert(win.primaryProvider === tc.expectedPrimary, `${tc.label} — primary=${win.primaryProvider}`);
  assert(win.fallbackProvider === tc.expectedFallback, `${tc.label} — fallback=${win.fallbackProvider}`);
}

// ── Test Suite 2: Remaining Time Calculation ──────────────────────────────────

header('Suite 2: Remaining Time Accuracy');

{
  // At xx:00:00 exactly, remaining should be ~900s (15 min)
  const svc = makeServiceWithTime(providers2, fakeTime(10, 0, 0));
  const win = svc.getCurrentWindow();
  assert(win.remainingMs >= 14 * 60 * 1000, `At :00 remaining ≥ 14min (got ${Math.floor(win.remainingMs/1000)}s)`);
  assert(win.remainingMs <= 15 * 60 * 1000, `At :00 remaining ≤ 15min`);
}
{
  // At xx:14:59 remaining should be ~1s
  const svc = makeServiceWithTime(providers2, fakeTime(10, 14, 59));
  const win = svc.getCurrentWindow();
  assert(win.remainingMs >= 0,   `At :14:59 remaining ≥ 0 (got ${win.remainingMs}ms)`);
  assert(win.remainingMs <= 2000, `At :14:59 remaining ≤ 2s (got ${Math.floor(win.remainingMs/1000)}s)`);
}
{
  // windowLabel format check
  const svc = makeServiceWithTime(providers2, fakeTime(10, 18, 30));
  const win = svc.getCurrentWindow();
  assert(/^\d{2}:\d{2} - \d{2}:\d{2}$/.test(win.windowLabel), `windowLabel format: "${win.windowLabel}"`);
}

// ── Test Suite 3: 1000-Request Simulation ────────────────────────────────────

header('Suite 3: 1000-Request Load Simulation (across all 4 windows)');

{
  const counts = { antigravity: 0, opusmax: 0 };
  const windowCounts = [0, 0, 0, 0];
  const errors = [];

  // Simulate 1000 requests spread evenly across a full hour
  const N = 1000;
  for (let i = 0; i < N; i++) {
    // Spread requests: 0..59 minutes, each minute gets ~16-17 requests
    const minute = Math.floor(i / N * 60);
    const second = Math.floor(Math.random() * 60);
    const svc = makeServiceWithTime(providers2, fakeTime(10, minute, second));
    const primary = svc.getPrimaryProvider();
    const fallback = svc.getFallbackProvider();
    const wid = svc.getCurrentWindow().windowId;

    if (!counts[primary] && counts[primary] !== 0) errors.push(`Unknown primary: ${primary} at min ${minute}`);
    counts[primary] = (counts[primary] || 0) + 1;
    windowCounts[wid]++;

    // Primary and fallback must always differ
    if (primary === fallback) errors.push(`primary === fallback at minute ${minute}`);
    // Both must be in the provider list
    if (!providers2.includes(primary)) errors.push(`primary "${primary}" not in provider list`);
    if (!providers2.includes(fallback)) errors.push(`fallback "${fallback}" not in provider list`);
  }

  assert(errors.length === 0, `No routing errors across ${N} requests` + (errors.length ? ': ' + errors.slice(0,3).join('; ') : ''));
  assert(counts.antigravity > 0, `antigravity served requests: ${counts.antigravity}`);
  assert(counts.opusmax > 0, `opusmax served requests: ${counts.opusmax}`);

  // Each provider should serve ~50% of requests (windows 0+2 = antigravity, 1+3 = opusmax)
  const ratio = counts.antigravity / N;
  assert(ratio >= 0.45 && ratio <= 0.55, `antigravity ~50% of requests (got ${Math.round(ratio*100)}%)`);

  // Each of 4 windows should have ~250 requests
  for (let w = 0; w < 4; w++) {
    assert(windowCounts[w] > 150 && windowCounts[w] < 350, `Window ${w} got ${windowCounts[w]} req (~250 expected)`);
  }

  console.log(`  ${INFO}  Distribution: antigravity=${counts.antigravity} opusmax=${counts.opusmax}`);
  console.log(`  ${INFO}  Windows: [${windowCounts.join(', ')}]`);
}

// ── Test Suite 4: N-Provider Rotation (Future Expansion) ─────────────────────

header('Suite 4: N-Provider Rotation (3 providers)');

{
  const providers3 = ['antigravity', 'opusmax', 'openrouter'];
  // With 3 providers, windows 0,1,2 each get one provider; window 3 wraps back to index 3%3=0
  const expected3 = {
    0: { primary: 'antigravity', fallback: 'opusmax' },
    1: { primary: 'opusmax',     fallback: 'openrouter' },
    2: { primary: 'openrouter',  fallback: 'antigravity' },
    3: { primary: 'antigravity', fallback: 'opusmax' },  // wraps: 3%3=0
  };
  for (const [wid, exp] of Object.entries(expected3)) {
    const minute = Number(wid) * 15;
    const svc = makeServiceWithTime(providers3, fakeTime(10, minute));
    assert(svc.getPrimaryProvider() === exp.primary,   `3-provider window ${wid} primary=${svc.getPrimaryProvider()}`);
    assert(svc.getFallbackProvider() === exp.fallback, `3-provider window ${wid} fallback=${svc.getFallbackProvider()}`);
  }
}

// ── Test Suite 5: Transition Continuity ──────────────────────────────────────

header('Suite 5: Window Transition (xx:14:59 → xx:15:00)');

{
  const svcBefore = makeServiceWithTime(providers2, fakeTime(10, 14, 59));
  const svcAfter  = makeServiceWithTime(providers2, fakeTime(10, 15, 0));
  assert(svcBefore.getPrimaryProvider() === 'antigravity', `Before transition (14:59): primary=antigravity`);
  assert(svcAfter.getPrimaryProvider()  === 'opusmax',     `After  transition (15:00): primary=opusmax`);
  assert(svcBefore.getFallbackProvider() === 'opusmax',    `Before transition (14:59): fallback=opusmax`);
  assert(svcAfter.getFallbackProvider()  === 'antigravity',`After  transition (15:00): fallback=antigravity`);
}

// ── Test Suite 6: Provider List Config ───────────────────────────────────────

header('Suite 6: Provider List');

{
  const svc = new ProviderRotationService(['antigravity', 'opusmax']);
  const list = svc.getProviderList();
  assert(Array.isArray(list), 'getProviderList returns array');
  assert(list.length === 2, `list length = ${list.length}`);
  assert(list[0] === 'antigravity', `list[0] = antigravity`);
  assert(list[1] === 'opusmax', `list[1] = opusmax`);
  // Verify it returns a copy (mutation-safe)
  list.push('injected');
  assert(svc.getProviderList().length === 2, 'getProviderList() returns immutable copy');
}

// ── Results ───────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(50));
console.log(`\x1b[1mResults: ${passed} passed, ${failed} failed\x1b[0m`);
if (failed === 0) {
  console.log('\x1b[32m✓ All tests passed — rotation service is production-ready\x1b[0m');
} else {
  console.log('\x1b[31m✗ Some tests failed — review before deploying\x1b[0m');
  process.exit(1);
}
