/**
 * R4 — Chat Layer Stress Test
 * Tests: 50 / 100 / 200 concurrent+sequential questions
 * Measures: latency, failures, retries, server restarts
 *
 * Run: node tests/stress-chat.mjs [--count=50]
 */
const BASE = 'http://localhost:4001';
const arg = process.argv.find(a => a.startsWith('--count='));
const COUNT = arg ? parseInt(arg.split('=')[1]) : 50;
const CONCURRENCY = 5; // send N at a time

const QUESTIONS = [
  'Hôm nay anh có gì?', 'Có gì cần duyệt không?', 'Có gì đáng lo không?',
  'Doanh thu sao rồi?', 'Sức khỏe hôm nay thế nào?', 'Task nào quá hạn?',
  'Có email quan trọng không?', 'Lịch hôm nay có gì?', 'Project nào rủi ro?',
  'Review automation có lỗi gì?',
];

async function singleChat(idx) {
  const msg = QUESTIONS[idx % QUESTIONS.length];
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, session_id: `stress-${idx}` }),
      signal: AbortSignal.timeout(95_000),
    });
    const latency = Date.now() - t0;
    const body = await r.json();
    if (r.status === 503 && body.code === 'QUEUE_FULL') return { ok: false, code: 'QUEUE_FULL', latency };
    if (r.status === 503 && body.code === 'TIMEOUT')   return { ok: false, code: 'TIMEOUT', latency };
    if (!r.ok) return { ok: false, code: `HTTP_${r.status}`, latency };
    if (body.reply || body.response) return { ok: true, latency };
    return { ok: false, code: 'NO_REPLY', latency };
  } catch (e) {
    return { ok: false, code: e.name === 'TimeoutError' ? 'CLIENT_TIMEOUT' : 'FETCH_FAILED', latency: Date.now() - t0 };
  }
}

async function getRestarts() {
  try {
    const r = await fetch(`${BASE}/api/metrics/chat`, { signal: AbortSignal.timeout(5000) });
    return (await r.json());
  } catch { return null; }
}

async function runBatch(label, count) {
  console.log(`\n${'─'.repeat(58)}`);
  console.log(`  ${label}: ${count} requests (${CONCURRENCY} concurrent)`);
  console.log(`${'─'.repeat(58)}`);

  const before = await getRestarts();
  const t0 = Date.now();
  const results = [];

  for (let i = 0; i < count; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, count); j++) batch.push(singleChat(j));
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    const done = results.length;
    const pct = Math.round(done / count * 100);
    process.stdout.write(`\r  Progress: ${done}/${count} (${pct}%) — ok:${results.filter(r=>r.ok).length} fail:${results.filter(r=>!r.ok).length}   `);
  }
  console.log('');

  const after = await getRestarts();
  const elapsed = Date.now() - t0;

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const latencies = ok.map(r => r.latency).sort((a, b) => a - b);
  const avg = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0;
  const p95 = latencies.length ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  const p99 = latencies.length ? latencies[Math.floor(latencies.length * 0.99)] : 0;

  const failCodes = {};
  for (const r of fail) failCodes[r.code] = (failCodes[r.code] || 0) + 1;

  const serverRestarts = (after?.restarts_total ?? 0) - (before?.restarts_total ?? 0);

  console.log(`  Elapsed:    ${(elapsed/1000).toFixed(1)}s`);
  console.log(`  Success:    ${ok.length}/${count} (${Math.round(ok.length/count*100)}%)`);
  console.log(`  Failed:     ${fail.length} — ${JSON.stringify(failCodes)}`);
  console.log(`  Latency:    avg=${avg}ms  p95=${p95}ms  p99=${p99}ms`);
  console.log(`  Restarts:   ${serverRestarts} (from metrics)`);
  if (after) {
    console.log(`  CB trips:   ${after.circuit_breaker_trips ?? 0}`);
    console.log(`  Timeouts:   ${after.requests_timeout ?? 0}`);
    console.log(`  Queue rej:  ${after.requests_queued_rejected ?? 0}`);
    console.log(`  CB open:    ${after.circuit_breaker_open ?? false}`);
  }

  return { ok: ok.length, fail: fail.length, failCodes, avg, p95, elapsed };
}

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║        CHAT LAYER STRESS TEST — R4                  ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  Target: ${BASE}`);
console.log(`  Total questions: ${COUNT}`);

// Verify server up
try {
  const r = await fetch(`${BASE}/api/metrics/chat`, { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Metrics endpoint: ${r.status}`);
  console.log(`  Server: ✅ online`);
} catch (e) {
  console.error(`  Server: ❌ ${e.message}`);
  process.exit(1);
}

const results = [];

// Phase 1: 50 questions
if (COUNT >= 50) results.push(await runBatch('Phase 1 — 50 questions', 50));
// Phase 2: 100 questions (only if COUNT >= 100)
if (COUNT >= 100) results.push(await runBatch('Phase 2 — 100 questions', 100));
// Phase 3: 200 questions (only if COUNT >= 200)
if (COUNT >= 200) results.push(await runBatch('Phase 3 — 200 questions', 200));

// Final metrics
const final = await getRestarts();
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  STRESS TEST SUMMARY                                 ║');
console.log('╚══════════════════════════════════════════════════════╝');
if (final) {
  console.log(`  Total requests:   ${final.requests_total}`);
  console.log(`  Success rate:     ${Math.round(final.requests_success / Math.max(1, final.requests_total) * 100)}%`);
  console.log(`  Timeout count:    ${final.requests_timeout}`);
  console.log(`  Queue rejected:   ${final.requests_queued_rejected}`);
  console.log(`  CB trips:         ${final.circuit_breaker_trips}`);
  console.log(`  Avg latency:      ${final.avg_latency_ms}ms`);
  console.log(`  P95 latency:      ${final.p95_latency_ms}ms`);
  console.log(`  Server uptime:    ${final.uptime_s}s`);
}

// PM2 restart check
try {
  const pm2out = await fetch(`${BASE}/api/metrics/chat`, { signal: AbortSignal.timeout(3000) });
  if (pm2out.ok) console.log(`  Server health:    ✅ still responding`);
} catch {
  console.log(`  Server health:    ❌ NOT RESPONDING (crashed?)`);
}

const totalOk = results.reduce((s, r) => s + r.ok, 0);
const totalFail = results.reduce((s, r) => s + r.fail, 0);
const totalReq = totalOk + totalFail;
const crashFree = final?.circuit_breaker_trips === 0 || (final?.requests_timeout ?? 0) < (totalReq * 0.1);

console.log(`\n  Verdict: ${crashFree ? '✅ CHAT_LAYER_HARDENED' : '⚠️  NEEDS_TUNING'}`);
console.log(`  (${totalOk}/${totalReq} success, ${totalFail} failures)\n`);
