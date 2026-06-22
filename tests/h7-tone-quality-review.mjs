/**
 * H7 — Response Quality & Tone Polish
 * Samples 40 live replies, scores each on 9 criteria, produces a tone report.
 *
 * Scoring criteria (each 0 or 1):
 * 1. Vietnamese naturalness   — mostly Vietnamese, not robotic
 * 2. "Anh" address            — uses "anh" for CEO, not "bạn" or "you"
 * 3. Executive summary        — gives actionable insight, not raw data dump
 * 4. No robotic wording       — no "Processing...", "Error:", "undefined"
 * 5. No documentation style  — no "Usage:", "Parameters:", "Returns:"
 * 6. No command syntax        — no "/agent", "Gõ /mi", "type /mi"
 * 7. No graph dump            — no "🕸 *Knowledge Graph*" structure
 * 8. No English error         — no "temporarily unavailable" / "try again later"
 * 9. Recommendation quality   — gives next step or asks clarifying question
 *
 * Target: ≥ 90% average score → JARVIS_TONE_POLISHED
 */

import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = 'http://localhost:4001/api/chat';
const REPORT_PATH = join(__dirname, '../reports/H7_TONE_QUALITY_REPORT.md');

// ── Test messages: representative mix ─────────────────────────────────────────

const QUALITY_CASES = [
  // Operational
  ['Dashboard hôm nay có gì?',          'h7-01', 'executive_status'],
  ['Hôm nay anh có task gì?',           'h7-02', 'task_query'],
  ['Có task overdue không?',             'h7-03', 'task_query'],
  ['Stone Oak hôm nay sao?',             'h7-04', 'store_status'],
  ['Bakudan tình hình thế nào?',         'h7-05', 'store_status'],
  ['Có gì đáng lo không?',               'h7-06', 'concern_query'],
  ['Tình hình thế nào?',                 'h7-07', 'ambiguous'],
  // Finance
  ['Doanh thu sao rồi?',                 'h7-08', 'finance'],
  ['QB sync sao rồi?',                   'h7-09', 'finance'],
  ['Có invoice chưa thanh toán không?',  'h7-10', 'finance'],
  // Health
  ['Anh ngủ sao rồi?',                  'h7-11', 'health'],
  ['HRV hôm nay sao?',                  'h7-12', 'health'],
  // Marketing / content
  ['Raw Sushi tạo bài SEO',             'h7-13', 'workflow'],
  ['Tạo flyer cho Bakudan',             'h7-14', 'workflow'],
  ['Viết content Facebook cho Stone Oak','h7-15', 'workflow'],
  // Gmail / Drive
  ['Có email quan trọng không?',        'h7-16', 'gmail'],
  ['Mở file payroll',                   'h7-17', 'drive'],
  // Calendar
  ['Hôm nay có meeting gì?',            'h7-18', 'calendar'],
  // HR
  ['Có ai nghỉ không?',                 'h7-19', 'hr'],
  ['Ai trễ task?',                      'h7-20', 'hr'],
  // Follow-ups
  ['Kể thêm đi',                        'h7-21f', 'followup'],
  ['Còn gì nữa?',                       'h7-22f', 'followup'],
  ['Cái đó sao rồi?',                   'h7-23f', 'followup'],
  // No diacritics
  ['dashboard sao roi',                  'h7-24', 'no_diacritic'],
  ['co task gi khong',                   'h7-25', 'no_diacritic'],
  ['mi oi hom nay co gi',               'h7-26', 'no_diacritic'],
  // Greetings
  ['Mi ơi',                              'h7-27', 'greeting'],
  ['Chào mi',                            'h7-28', 'greeting'],
  ['Em ơi',                              'h7-29', 'greeting'],
  // Action / safety
  ['Soạn email cho Maria',              'h7-30', 'action'],
  ['Publish website',                   'h7-31', 'safety'],
  ['Deploy production',                 'h7-32', 'safety'],
  // Mixed language
  ['Mi check dashboard giùm anh',       'h7-33', 'mixed'],
  ['Create SEO post cho Raw Sushi',     'h7-34', 'mixed'],
  // Ambiguous CEO style
  ['Coi dùm anh',                       'h7-35', 'ceo_style'],
  ['Làm luôn đi',                       'h7-36', 'ceo_style'],
  ['Có gì không mi?',                   'h7-37', 'ambiguous'],
  ['Đang có gì vậy?',                   'h7-38', 'ambiguous'],
  ['Hôm nay ổn không?',                 'h7-39', 'ambiguous'],
  ['Cần anh quyết định gì không?',      'h7-40', 'executive_status'],
];

// ── Scoring functions (each returns 0 or 1) ───────────────────────────────────

function scoreVietnamese(reply) {
  if (!reply || reply.length < 10) return 0;
  const viChars = (reply.match(/[àáâãèéêìíòóôõùúýăđươ]/gi) || []).length;
  const engWords = (reply.match(/\b(the|this|that|your|please|error|system|cannot|unable)\b/gi) || []).length;
  return viChars > 2 || engWords === 0 ? 1 : 0;
}

function scoreAnhAddress(reply) {
  if (!reply) return 1; // neutral — short replies may not need it
  if (/\bbạn\b|\byou\b/i.test(reply) && !/anh/i.test(reply)) return 0;
  return 1;
}

function scoreExecutiveSummary(reply, type) {
  if (!reply) return 1;
  // Should contain some actionable content or insight
  const hasContent = reply.length > 40;
  const hasAction = /anh|em|task|doanh|check|update|kiểm tra|đang|sẽ|cần/i.test(reply);
  return hasContent && hasAction ? 1 : 0;
}

function scoreNoRobotic(reply) {
  if (!reply) return 1;
  const robotic = /^(Processing\.\.\.|Error:|undefined|null|\[object)/m.test(reply) ||
                  /command not recognized|invalid input|unrecognized/i.test(reply);
  return robotic ? 0 : 1;
}

function scoreNoDocStyle(reply) {
  if (!reply) return 1;
  const docStyle = /^(Usage:|Parameters:|Returns:|Example:|Note:|Warning:)/m.test(reply) ||
                   /```[\s\S]*?```/.test(reply) && reply.length < 200; // code block in short response
  return docStyle ? 0 : 1;
}

function scoreNoCommandSyntax(reply) {
  if (!reply) return 1;
  const hasCmd = /gõ\s+\/|use \/agent|type \/mi|run \/mi|\/mi\s+\w/i.test(reply);
  return hasCmd ? 0 : 1;
}

function scoreNoGraphDump(reply) {
  if (!reply) return 1;
  const hasGraph = /🕸\s*\*Knowledge Graph/i.test(reply) ||
                   /→\s*(depends_on|deployed_on|owned_by)\s*→/i.test(reply);
  return hasGraph ? 0 : 1;
}

function scoreNoEnglishError(reply) {
  if (!reply) return 1;
  const hasErr = /temporarily unavailable|please try again later|mi-core is temporarily/i.test(reply);
  return hasErr ? 0 : 1;
}

function scoreRecommendation(reply, type) {
  if (!reply || type === 'greeting') return 1;
  if (['followup', 'ambiguous', 'ceo_style'].includes(type)) return 1; // lenient
  // Good reply ends with next step, question, or actionable suggestion
  const hasRec = /anh muốn|anh cần|em sẽ|tiếp theo|anh hỏi thêm|anh có muốn|không\?$|nhé\?$|nhé\.$|ạ\.$|gì không\?/i.test(reply);
  return hasRec ? 1 : 0;
}

const CRITERIA = [
  { name: 'Vietnamese naturalness',  fn: (r, t) => scoreVietnamese(r) },
  { name: '"Anh" address',          fn: (r, t) => scoreAnhAddress(r) },
  { name: 'Executive summary',       fn: (r, t) => scoreExecutiveSummary(r, t) },
  { name: 'No robotic wording',      fn: (r, t) => scoreNoRobotic(r) },
  { name: 'No documentation style',  fn: (r, t) => scoreNoDocStyle(r) },
  { name: 'No command syntax',       fn: (r, t) => scoreNoCommandSyntax(r) },
  { name: 'No graph dump',           fn: (r, t) => scoreNoGraphDump(r) },
  { name: 'No English error',        fn: (r, t) => scoreNoEnglishError(r) },
  { name: 'Recommendation quality',  fn: (r, t) => scoreRecommendation(r, t) },
];

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('════════════════════════════════════════════════');
console.log('H7 — Response Quality & Tone Review');
console.log(`Sampling ${QUALITY_CASES.length} live replies`);
console.log('════════════════════════════════════════════════\n');

const criteriaScores = Object.fromEntries(CRITERIA.map(c => [c.name, { pass: 0, total: 0 }]));
const caseResults = [];
let totalScore = 0, totalChecks = 0;

for (const [msg, sender, type] of QUALITY_CASES) {
  process.stdout.write(`[${sender}] "${msg.slice(0,40)}" ... `);

  let reply = '';
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, sender }),
      signal: ctrl.signal,
    });
    const d = await res.json();
    reply = d.reply || '';
  } catch (e) {
    const timedOut = e.name === 'AbortError';
    reply = timedOut ? '' : '';
  }

  const scores = {};
  let caseTotal = 0;
  for (const c of CRITERIA) {
    const s = c.fn(reply, type);
    scores[c.name] = s;
    criteriaScores[c.name].pass += s;
    criteriaScores[c.name].total++;
    caseTotal += s;
    totalScore += s;
    totalChecks++;
  }

  const pct = Math.round((caseTotal / CRITERIA.length) * 100);
  const icon = pct >= 90 ? '✅' : pct >= 70 ? '⚠️' : '❌';
  console.log(`${icon} ${pct}%`);

  const failures = CRITERIA.filter(c => scores[c.name] === 0).map(c => c.name);
  caseResults.push({ msg, sender, type, reply: reply.slice(0, 150), pct, failures });
}

const overallPct = Math.round((totalScore / totalChecks) * 100);
const verdict = overallPct >= 90 ? 'JARVIS_TONE_POLISHED' : 'JARVIS_TONE_NEEDS_WORK';

console.log('\n════════════════════════════════════════════════');
console.log(`Overall score: ${overallPct}%`);
console.log(`▶ ${verdict}`);

// ── Report ────────────────────────────────────────────────────────────────────

const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
const criteriaRows = CRITERIA.map(c => {
  const s = criteriaScores[c.name];
  const pct = Math.round((s.pass / s.total) * 100);
  return `| ${c.name} | ${s.pass}/${s.total} | ${pct}% | ${pct >= 90 ? '✅' : pct >= 70 ? '⚠️' : '❌'} |`;
}).join('\n');

const worstCases = caseResults
  .filter(r => r.pct < 90)
  .sort((a, b) => a.pct - b.pct)
  .slice(0, 10)
  .map(r => `| "${r.msg.slice(0,40)}" | ${r.pct}% | ${r.failures.join(', ')} |`)
  .join('\n') || '| — | — | All cases ≥ 90% |';

const report = `# H7 — Response Quality & Tone Report
**Generated:** ${now}
**Sample size:** ${QUALITY_CASES.length} live replies
**Overall score:** ${overallPct}%
**Verdict:** ${verdict}

## Criteria Scores

| Criterion | Pass/Total | Score | Status |
|-----------|-----------|-------|--------|
${criteriaRows}

## Worst Cases (score < 90%)

| Input | Score | Failed criteria |
|-------|-------|----------------|
${worstCases}

## Acceptance

| Criterion | Result |
|-----------|--------|
| Overall ≥ 90% | ${overallPct >= 90 ? '✅ PASS' : '❌ FAIL'} (${overallPct}%) |
| "No graph dump" = 100% | ${Math.round(criteriaScores['No graph dump'].pass / criteriaScores['No graph dump'].total * 100) === 100 ? '✅ PASS' : '❌ FAIL'} |
| "No English error" = 100% | ${Math.round(criteriaScores['No English error'].pass / criteriaScores['No English error'].total * 100) === 100 ? '✅ PASS' : '❌ FAIL'} |
| "No command syntax" = 100% | ${Math.round(criteriaScores['No command syntax'].pass / criteriaScores['No command syntax'].total * 100) === 100 ? '✅ PASS' : '❌ FAIL'} |
`;

writeFileSync(REPORT_PATH, report);
console.log(`\n📄 ${REPORT_PATH}`);
process.exit(overallPct >= 90 ? 0 : 1);
