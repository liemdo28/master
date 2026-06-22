/**
 * H1 — 24h WhatsApp Burn-In Monitor
 *
 * Runs real-world traffic simulation for 24 hours (or --hours N).
 * Tracks: messages, success, fallback, timeout, context-loss, graph-dump,
 *         English error, workflow created, approval requested.
 *
 * Usage:
 *   node tests/h1-burn-in-monitor.mjs           # 24h
 *   node tests/h1-burn-in-monitor.mjs --hours 1 # 1h smoke test
 *   node tests/h1-burn-in-monitor.mjs --count 200 # fixed count
 */

import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:4001/api/chat';
const REPORT_PATH = join(__dirname, '../reports/WHATSAPP_BURN_IN_REPORT.md');
const METRICS_PATH = join(__dirname, '../reports/burn-in-metrics.json');

// CLI args
const args = process.argv.slice(2);
const hoursArg = args.indexOf('--hours');
const countArg = args.indexOf('--count');
const HOURS = hoursArg >= 0 ? parseFloat(args[hoursArg + 1]) : 24;
const FIXED_COUNT = countArg >= 0 ? parseInt(args[countArg + 1]) : null;
const DURATION_MS = HOURS * 60 * 60 * 1000;
const MSG_INTERVAL_MS = FIXED_COUNT ? 0 : Math.floor(DURATION_MS / 500); // ~500 msgs over duration

// ── Message pool — realistic CEO traffic ─────────────────────────────────────

const REALISTIC_POOL = [
  // High frequency — 40%
  { msg: 'Dashboard hôm nay có gì?', weight: 5, type: 'dashboard' },
  { msg: 'Hôm nay anh có task gì?', weight: 5, type: 'task' },
  { msg: 'Mi ơi', weight: 4, type: 'greeting' },
  { msg: 'Có gì cần anh xử lý không?', weight: 4, type: 'dashboard' },
  { msg: 'Tình hình thế nào?', weight: 3, type: 'ambiguous' },
  // Medium frequency — 35%
  { msg: 'Doanh thu sao rồi?', weight: 3, type: 'finance' },
  { msg: 'Stone Oak hôm nay sao?', weight: 3, type: 'store' },
  { msg: 'Bakudan tình hình sao?', weight: 3, type: 'store' },
  { msg: 'QB sync sao rồi?', weight: 2, type: 'finance' },
  { msg: 'Có email quan trọng không?', weight: 2, type: 'gmail' },
  { msg: 'Kể thêm đi', weight: 3, type: 'followup' },
  { msg: 'Còn gì nữa?', weight: 2, type: 'followup' },
  { msg: 'Anh ngủ sao rồi?', weight: 2, type: 'health' },
  // Low frequency — 25%
  { msg: 'Raw Sushi tạo bài SEO', weight: 1, type: 'marketing' },
  { msg: 'Tạo flyer cho Bakudan', weight: 1, type: 'marketing' },
  { msg: 'Soạn email cho Maria', weight: 1, type: 'gmail' },
  { msg: 'Chuẩn bị report doanh thu', weight: 1, type: 'finance' },
  { msg: 'Có ai nghỉ không?', weight: 1, type: 'hr' },
  { msg: 'HRV tuần này sao?', weight: 1, type: 'health' },
  { msg: 'co gi khong', weight: 2, type: 'no_diacritic' },
  { msg: 'dashboard sao roi', weight: 2, type: 'no_diacritic' },
  { msg: 'mi check dashboard gium anh', weight: 1, type: 'mixed_lang' },
];

// Weighted random pick
const totalWeight = REALISTIC_POOL.reduce((a, m) => a + m.weight, 0);
function pickMsg() {
  let r = Math.random() * totalWeight;
  for (const m of REALISTIC_POOL) {
    r -= m.weight;
    if (r <= 0) return m;
  }
  return REALISTIC_POOL[0];
}

// ── Detection helpers ─────────────────────────────────────────────────────────

function isEnglishError(t = '') {
  return /mi-core is temporarily unavailable/i.test(t) ||
         /please try again later/i.test(t) ||
         /temporarily unavailable/i.test(t);
}

function isGraphDump(t = '') {
  return /knowledge graph\s*[—–-]\s*(dashboard|raw sushi|bakudan|stone oak)/i.test(t) ||
         /→\s*(depends_on|deployed_on|owned_by)\s*→/i.test(t) ||
         (t.includes('edges:') && t.includes('entities:'));
}

function isWorkflowCreated(t = '') {
  return /work.*order|workflow.*created|wf-\d|work order #/i.test(t) ||
         /coo agent sẽ|em đã nhận.*yêu cầu|em bắt đầu/i.test(t);
}

function isApprovalRequested(t = '') {
  return /anh.*duyệt|cần.*duyệt|approval.*required|pending approval/i.test(t) ||
         /approve|⚠️.*không.*tự động|không.*chạy.*khi chưa.*duyệt/i.test(t);
}

// Context-loss detection: if follow-up returns generic greeting-like response
function isContextLost(type, reply) {
  if (type !== 'followup') return false;
  return /em đây anh|anh cần gì|em sẵn sàng|dạ anh/i.test(reply) &&
         !/hôm nay|dashboard|task|raw sushi|bakudan|stone oak|doanh thu/i.test(reply);
}

// ── Metrics ───────────────────────────────────────────────────────────────────

const metrics = {
  start: Date.now(),
  message_count: 0,
  success_count: 0,
  fallback_count: 0,
  timeout_count: 0,
  context_loss_count: 0,
  graph_dump_count: 0,
  english_error_count: 0,
  workflow_created_count: 0,
  approval_requested_count: 0,
  latencies: [],
  failures: [],
};

// Load existing metrics if resuming
if (existsSync(METRICS_PATH)) {
  try {
    const prev = JSON.parse(readFileSync(METRICS_PATH, 'utf-8'));
    Object.assign(metrics, prev);
    console.log(`Resuming from ${metrics.message_count} previous messages`);
  } catch {}
}

function saveMetrics() {
  writeFileSync(METRICS_PATH, JSON.stringify(metrics, null, 2));
}

function printProgress() {
  const elapsed = ((Date.now() - metrics.start) / 1000 / 60).toFixed(1);
  const ctxRetention = metrics.message_count > 0
    ? (100 - (metrics.context_loss_count / Math.max(1, metrics.message_count) * 100)).toFixed(1)
    : '100.0';
  console.log(
    `[${elapsed}m] msgs=${metrics.message_count} ok=${metrics.success_count} ` +
    `timeout=${metrics.timeout_count} graph=${metrics.graph_dump_count} ` +
    `eng_err=${metrics.english_error_count} ctx_loss=${metrics.context_loss_count} ` +
    `ctx_retention=${ctxRetention}%`
  );
}

// ── Send message ──────────────────────────────────────────────────────────────

const SENDERS = ['h1-burn-a', 'h1-burn-b', 'h1-burn-c'];

async function sendOne() {
  const m = pickMsg();
  const sender = SENDERS[Math.floor(Math.random() * SENDERS.length)];
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: m.msg, sender }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    const lat = Date.now() - t0;
    metrics.latencies.push(lat);

    if (!res.ok) {
      metrics.fallback_count++;
      metrics.failures.push({ msg: m.msg, error: `HTTP ${res.status}`, lat, ts: Date.now() });
      return;
    }

    const d = await res.json();
    const reply = d.reply || '';
    metrics.message_count++;

    if (isEnglishError(reply)) {
      metrics.english_error_count++;
      metrics.failures.push({ msg: m.msg, type: 'english_error', reply: reply.slice(0, 100), ts: Date.now() });
    } else if (isGraphDump(reply)) {
      metrics.graph_dump_count++;
      metrics.failures.push({ msg: m.msg, type: 'graph_dump', reply: reply.slice(0, 100), ts: Date.now() });
    } else if (isContextLost(m.type, reply)) {
      metrics.context_loss_count++;
      metrics.failures.push({ msg: m.msg, type: 'context_loss', reply: reply.slice(0, 100), ts: Date.now() });
    } else {
      metrics.success_count++;
    }

    if (isWorkflowCreated(reply)) metrics.workflow_created_count++;
    if (isApprovalRequested(reply)) metrics.approval_requested_count++;

  } catch (e) {
    const lat = Date.now() - t0;
    if (e.name === 'AbortError' || e.message?.includes('abort')) {
      metrics.timeout_count++;
      metrics.failures.push({ msg: m.msg, type: 'timeout', lat, ts: Date.now() });
    } else {
      metrics.fallback_count++;
      metrics.failures.push({ msg: m.msg, type: 'network_error', error: e.message, lat, ts: Date.now() });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

function writeReport(final = false) {
  const lats = [...metrics.latencies].sort((a, b) => a - b);
  const p50 = lats[Math.floor(lats.length * 0.50)] || 0;
  const p95 = lats[Math.floor(lats.length * 0.95)] || 0;
  const p99 = lats[Math.floor(lats.length * 0.99)] || 0;
  const avg = lats.length ? Math.round(lats.reduce((a, b) => a + b, 0) / lats.length) : 0;

  const elapsed_h = ((Date.now() - metrics.start) / 1000 / 3600).toFixed(2);
  const ctxRetention = metrics.message_count > 0
    ? (100 - (metrics.context_loss_count / metrics.message_count * 100)).toFixed(1)
    : '100.0';

  const passAll = metrics.english_error_count === 0 &&
                  metrics.graph_dump_count === 0 &&
                  parseFloat(ctxRetention) >= 95;

  const verdict = final
    ? (passAll ? 'WHATSAPP_24H_BURN_IN_READY' : 'WHATSAPP_24H_BURN_IN_FAIL')
    : 'IN_PROGRESS';

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const recentFails = metrics.failures.slice(-20).map(f =>
    `- [${new Date(f.ts).toISOString().slice(11,19)}] "${f.msg}" → ${f.type || f.error} ${f.reply ? '— ' + f.reply.slice(0,60) : ''}`
  ).join('\n') || 'None';

  const content = `# H1 — 24h WhatsApp Burn-In Report
**Generated:** ${now}
**Elapsed:** ${elapsed_h}h
**Verdict:** ${verdict}

## Metrics

| Metric | Count |
|--------|-------|
| Total messages | ${metrics.message_count} |
| Success | ${metrics.success_count} |
| Fallback (HTTP error) | ${metrics.fallback_count} |
| Timeout (>15s) | ${metrics.timeout_count} |
| Context loss | ${metrics.context_loss_count} |
| Graph dumps | ${metrics.graph_dump_count} |
| English errors | ${metrics.english_error_count} |
| Workflow created | ${metrics.workflow_created_count} |
| Approval requested | ${metrics.approval_requested_count} |

## Acceptance Criteria

| Criterion | Value | Status |
|-----------|-------|--------|
| 0 English "Mi-Core unavailable" | ${metrics.english_error_count} | ${metrics.english_error_count === 0 ? '✅ PASS' : '❌ FAIL'} |
| 0 English gateway error | ${metrics.english_error_count} | ${metrics.english_error_count === 0 ? '✅ PASS' : '❌ FAIL'} |
| 0 graph dump for operational | ${metrics.graph_dump_count} | ${metrics.graph_dump_count === 0 ? '✅ PASS' : '❌ FAIL'} |
| Context retention ≥ 95% | ${ctxRetention}% | ${parseFloat(ctxRetention) >= 95 ? '✅ PASS' : '❌ FAIL'} |

## Latency

| p50 | p95 | p99 | avg |
|-----|-----|-----|-----|
| ${p50}ms | ${p95}ms | ${p99}ms | ${avg}ms |

## Recent Failures (last 20)

${recentFails}
`;

  writeFileSync(REPORT_PATH, content);
}

// ── Main loop ─────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════');
console.log(`H1 — 24h Burn-In Monitor`);
if (FIXED_COUNT) console.log(`Mode: fixed ${FIXED_COUNT} messages`);
else console.log(`Duration: ${HOURS}h (${DURATION_MS / 1000 / 60}min)`);
console.log(`API: ${API}`);
console.log('════════════════════════════════════════════════');

const endTime = FIXED_COUNT ? null : Date.now() + DURATION_MS;
let count = 0;
const TARGET = FIXED_COUNT || Infinity;

// Progress print every 25 messages
let printAt = 25;

while (true) {
  await sendOne();
  count++;

  if (count >= printAt) {
    printProgress();
    saveMetrics();
    writeReport(false);
    printAt += 25;
  }

  if (FIXED_COUNT && count >= TARGET) break;
  if (!FIXED_COUNT && Date.now() >= endTime) break;

  // Realistic pacing: 200ms between messages (5 msg/s)
  if (!FIXED_COUNT) await new Promise(r => setTimeout(r, 200));
}

printProgress();
saveMetrics();
writeReport(true);

const ctxRetention = metrics.message_count > 0
  ? (100 - (metrics.context_loss_count / metrics.message_count * 100)).toFixed(1)
  : '100.0';
const passAll = metrics.english_error_count === 0 &&
                metrics.graph_dump_count === 0 &&
                parseFloat(ctxRetention) >= 95;

const verdict = passAll ? 'WHATSAPP_24H_BURN_IN_READY' : 'WHATSAPP_24H_BURN_IN_FAIL';
console.log(`\n▶ ${verdict}`);
console.log(`📄 ${REPORT_PATH}`);
process.exit(passAll ? 0 : 1);
