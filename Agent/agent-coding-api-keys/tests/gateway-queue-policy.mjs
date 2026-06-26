/**
 * Gateway request queue policy tests.
 *
 * Run after npm run build:
 *   node tests/gateway-queue-policy.mjs
 */

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';

let failed = 0;
function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`${PASS} ${message}`);
  } else {
    failed++;
    console.error(`${FAIL} ${message}${detail ? `\n  ${detail}` : ''}`);
  }
}

const { gatewayRequestQueue } = await import('../dist/runtime/gateway-request-queue.js');

const release1 = await gatewayRequestQueue.acquire('q1', 'openai');
const abort = new AbortController();
const queued = gatewayRequestQueue.acquire('q2', 'openai', abort.signal).catch((error) => error);

assert(gatewayRequestQueue.snapshot().active_requests === 1, 'Queue allows one active request by default', JSON.stringify(gatewayRequestQueue.snapshot()));
assert(gatewayRequestQueue.snapshot().queued_requests === 1, 'Second request waits in queue', JSON.stringify(gatewayRequestQueue.snapshot()));

abort.abort();
const aborted = await queued;
assert(aborted instanceof Error && aborted.message.includes('client disconnected'), 'Disconnected queued request is removed', String(aborted));
assert(gatewayRequestQueue.snapshot().queued_requests === 0, 'Abort cleanup leaves no stale queued requests', JSON.stringify(gatewayRequestQueue.snapshot()));

const queuedBeforeDrain = gatewayRequestQueue.acquire('q3', 'openai');
gatewayRequestQueue.drain();
release1();
const release3 = await queuedBeforeDrain;
assert(gatewayRequestQueue.snapshot().active_requests === 1, 'Drain still lets existing queued request run', JSON.stringify(gatewayRequestQueue.snapshot()));

const rejected = await gatewayRequestQueue.acquire('q4', 'openai').catch((error) => error);
assert(rejected instanceof Error && rejected.message.includes('drain active'), 'Drain rejects new requests', String(rejected));

release3();
gatewayRequestQueue.resume();

if (failed > 0) {
  console.error(`\n${failed} gateway queue policy test(s) failed`);
  process.exit(1);
}

console.log('\nAll gateway queue policy tests passed');
