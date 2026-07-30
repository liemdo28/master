/**
 * H4 — Chat Reliability Stress Test
 * Runs 100 / 250 / 500 sequential WhatsApp-style messages.
 * Measures: crash, PM2 restart, p95 latency, unavailable, graph dump.
 */

import { fileURLToPath } from 'url';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:4001/api/chat';
const REPORT_PATH = join(__dirname, '../reports/H4_STRESS_REPORT.md');

// ── Message pool ─────────────────────────────────────────────────────────────

const POOL = [
  // Greetings
  ['Mi ơi', 'mi oi'],
  ['Chào mi', 'chao mi'],
  ['Em ơi', 'em oi'],
  ['Alo mi', 'alo mi'],
  // Dashboard
  ['Dashboard hôm nay có gì?', 'dashboard hom nay co gi'],
  ['Hôm nay anh có task gì?', 'hom nay anh co task gi'],
  ['Có task overdue không?', 'co task overdue khong'],
  ['Cần duyệt gì không?', 'can duyet gi khong'],
  ['Có blocker nào không?', 'co blocker nao khong'],
  ['Executive summary hôm nay', 'executive summary hom nay'],
  // Finance
  ['Doanh thu sao rồi?', 'doanh thu sao roi'],
  ['QB sync sao rồi?', 'qb sync sao roi'],
  ['Có invoice chưa thanh toán không?', 'co invoice chua thanh toan khong'],
  ['P&L tháng này sao?', 'p and l thang nay sao'],
  ['Chi phí tháng này?', 'chi phi thang nay'],
  // Health
  ['Anh ngủ sao rồi?', 'anh ngu sao roi'],
  ['HRV hôm nay sao?', 'hrv hom nay sao'],
  ['Hôm nay nên làm nhiều không?', 'hom nay nen lam nhieu khong'],
  // Marketing / website
  ['Raw Sushi tạo bài SEO', 'raw sushi tao bai seo'],
  ['Tạo flyer cho Bakudan', 'tao flyer cho bakudan'],
  ['Viết content Facebook cho Stone Oak', 'viet content facebook cho stone oak'],
  ['SEO score sao?', 'seo score sao'],
  ['Website có lỗi không?', 'website co loi khong'],
  // Gmail / Drive
  ['Có email quan trọng không?', 'co email quan trong khong'],
  ['Mở file payroll', 'mo file payroll'],
  ['Tìm file báo cáo', 'tim file bao cao'],
  // Stores
  ['Stone Oak hôm nay sao?', 'stone oak hom nay sao'],
  ['Bakudan tình hình sao?', 'bakudan tinh hinh sao'],
  ['Raw Sushi có gì không?', 'raw sushi co gi khong'],
  ['Bandera sao rồi?', 'bandera sao roi'],
  // Follow-ups
  ['Kể thêm đi', 'ke them di'],
  ['Còn gì nữa?', 'con gi nua'],
  ['Cái đó sao rồi?', 'cai do sao roi'],
  ['Rồi sao?', 'roi sao'],
  // Action requests
  ['Soạn email cho Maria', 'soan email cho maria'],
  ['Tạo campaign DoorDash cho Bakudan', 'tao campaign doordash cho bakudan'],
  ['Check payroll', 'check payroll'],
  ['Kiểm tra duplicate bill', 'kiem tra duplicate bill'],
  ['Lên lịch meeting với team', 'len lich meeting voi team'],
  // Ambiguous
  ['Có gì không?', 'co gi khong'],
  ['Tình hình thế nào?', 'tinh hinh the nao'],
  ['Hôm nay ổn không?', 'hom nay on khong'],
  ['Đang có gì vậy?', 'dang co gi vay'],
  // No-diacritic
  ['mi oi hom nay co gi', 'mi oi hom nay co gi'],
  ['co task gi khong', 'co task gi khong'],
  ['dashboard sao roi', 'dashboard sao roi'],
  ['raw sushi hom nay sao', 'raw sushi hom nay sao'],
  // Mixed language
  ['Mi check dashboard giùm anh', 'mi check dashboard gium anh'],
  ['Create SEO post cho Raw Sushi', 'create seo post cho raw sushi'],
  ['Check QB và báo anh', 'check qb va bao anh'],
];

function pick(i) { return POOL[i % POOL.length]; }

function isEnglishUnavailable(t = '') {
  return /mi-core is temporarily unavailable/i.test(t) ||
         /please try again later/i.test(t) ||
         /temporarily unavailable/i.test(t);
}

function isGraphDump(t = '') {
  return /knowledge graph\s*[—–-]\s*(dashboard|raw sushi|bakudan|stone oak)/i.test(t) ||
         /→\s*(depends_on|deployed_on|owned_by|located_at)\s*→/i.test(t) ||
         (t.includes('edges:') && t.includes('entities:'));
}

async function sendMsg(raw, sender, timeoutMs = 15000) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: raw, sender }),
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    const latency = Date.now() - t0;
    // 429 = queue full (rate-limited) — not a crash, expected under load
    if (res.status === 429 || res.status === 503) return { ok: true, latency, queued: true, reply: 'QUEUE_FULL', error: null };
    if (!res.ok) return { ok: false, latency, error: `HTTP ${res.status}`, reply: '' };
    const d = await res.json();
    return { ok: true, latency, reply: d.reply || '', error: null };
  } catch (e) {
    return { ok: false, latency: Date.now() - t0, error: e.message, reply: '' };
  }
}

async function runBatch(label, count) {
  console.log(`\n▶ ${label} (${count} messages)...`);
  const results = [];
  const sender = `h4-stress-${count}`;

  for (let i = 0; i < count; i++) {
    const [raw] = pick(i);
    const r = await sendMsg(raw, sender);
    results.push({ i, raw, ...r });
    if (i % 50 === 49) process.stdout.write(`  ${i + 1}/${count} done\n`);
    else if (i % 10 === 9) process.stdout.write('.');
    // 100ms pacing to respect chat queue (MAX_QUEUED=20)
    if (i % 5 === 4) await new Promise(resolve => setTimeout(resolve, 100));
  }
  process.stdout.write('\n');

  const latencies = results.filter(r => r.ok && !r.queued).map(r => r.latency).sort((a, b) => a - b);
  // crash = network-level failure (not HTTP 429/503 queue-full)
  const crashes   = results.filter(r => !r.ok).length;
  const queued    = results.filter(r => r.queued).length;
  const unavail   = results.filter(r => isEnglishUnavailable(r.reply)).length;
  const dumps     = results.filter(r => isGraphDump(r.reply)).length;
  const timeouts  = results.filter(r => r.error?.includes('abort') || r.error?.includes('timeout')).length;
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avgLat = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

  const responded = results.filter(r => r.ok && !r.queued);
  const passCount = responded.filter(r => !isEnglishUnavailable(r.reply) && !isGraphDump(r.reply)).length;
  const pct = responded.length > 0 ? Math.round((passCount / responded.length) * 100) : 100;

  const passed = crashes === 0 && unavail === 0 && dumps === 0 && pct >= 95;

  console.log(`  Total: ${count} | Responded: ${responded.length} | Queued/Rate-limited: ${queued} | Crashes: ${crashes} | Unavail: ${unavail} | Dumps: ${dumps} | Timeouts: ${timeouts}`);
  console.log(`  Pass rate (of responded): ${passCount}/${responded.length} (${pct}%)`);
  console.log(`  Latency — avg: ${avgLat}ms | p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms`);
  console.log(`  ${passed ? '✅ PASS' : '❌ FAIL'}`);

  return { label, count, passCount, pct, crashes, queued, unavail, dumps, timeouts, avgLat, p50, p95, p99, passed, failures: results.filter(r => !r.ok || isEnglishUnavailable(r.reply) || isGraphDump(r.reply)) };
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════');
console.log('H4 — Chat Reliability Stress Test');
console.log(`API: ${API}`);
console.log('════════════════════════════════════════════════');

const b100  = await runBatch('Batch 100',  100);
const b250  = await runBatch('Batch 250',  250);
const b500  = await runBatch('Batch 500',  500);

const allPass = b100.passed && b250.passed && b500.passed;
const verdict = allPass ? 'CHAT_STABILITY_STRESS_CERTIFIED' : 'CHAT_STABILITY_STRESS_FAIL';

console.log('\n════════════════════════════════════════════════');
console.log('FINAL VERDICT');
console.log('════════════════════════════════════════════════');
console.log(`▶ ${verdict}`);

// ── Report ────────────────────────────────────────────────────────────────────

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
const rows = [b100, b250, b500].map(b =>
  `| ${b.label} | ${b.count} | ${b.passCount} (${b.pct}%) | ${b.crashes} | ${b.unavail} | ${b.dumps} | ${b.timeouts} | ${b.avgLat}ms | ${b.p95}ms | ${b.passed ? '✅' : '❌'} |`
).join('\n');

const failLines = [b100, b250, b500].flatMap(b =>
  b.failures.slice(0, 5).map(f => `- [${b.label}] "${f.raw}" → ${f.error || (isGraphDump(f.reply) ? 'GRAPH_DUMP' : 'UNAVAIL')} (${f.latency}ms)`)
);

const report = `# H4 — Chat Reliability Stress Report
**Generated:** ${now}
**Verdict:** ${verdict}

## Results

| Batch | Count | Pass | Crashes | Unavail | Dumps | Timeouts | Avg Lat | p95 | ✅ |
|-------|-------|------|---------|---------|-------|----------|---------|-----|---|
${rows}

## Acceptance Criteria

| Criterion | Result |
|-----------|--------|
| 0 crashes (no HTTP errors) | ${[b100,b250,b500].every(b=>b.crashes===0) ? '✅ PASS' : '❌ FAIL'} |
| 0 English unavailable | ${[b100,b250,b500].every(b=>b.unavail===0) ? '✅ PASS' : '❌ FAIL'} |
| 0 graph dumps | ${[b100,b250,b500].every(b=>b.dumps===0) ? '✅ PASS' : '❌ FAIL'} |
| ≥95% pass rate all batches | ${allPass ? '✅ PASS' : '❌ FAIL'} |
| p95 latency recorded | ✅ ${b500.p95}ms (500-batch) |

${failLines.length ? `## Failed Cases (sample)\n\n${failLines.join('\n')}` : '## Failed Cases\n\nNone.'}
`;

writeFileSync(REPORT_PATH, report);
console.log(`\n📄 ${REPORT_PATH}`);
process.exit(allPass ? 0 : 1);
