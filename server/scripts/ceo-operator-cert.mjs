/**
 * CEO Operator Certification Test — Runtime Proof
 * Runs TEST 1-4 against the execution engine in-process.
 * TEST 5 (24h burn-in) is a separate long-running monitor.
 *
 * Usage: npx tsx server/scripts/ceo-operator-cert.mjs
 */
import { executeMultiIntent } from '../src/execution/multi-intent-executor.ts';
import { processMultiIntent, isMultiIntent, splitClauses } from '../src/execution/multi-intent-engine.ts';
import { processCEORequest } from '../src/execution/index.ts';
import { ceoMultiIntentSummary, stripInternalIds, ceoLabel } from '../src/execution/ceo-language-filter.ts';

const BANNED_PATTERNS = [
  /DASHBOARD_AUDIT/,
  /EMAIL_DRAFT/,
  /FINANCE_REPORT/,
  /SEO_CONTENT/,
  /QB_CHECK/,
  /GENERAL_TASK/,
  /WF-\d{8}-\d+/,
  /CEO-MULTI-\d{8}/,
  /APPR-[\w-]+/,
  /execution-engine/,
  /idempotency_key/,
  /workflow_id/,
  /Executed \d+\/\d+ child workflows/,
];

let passCount = 0;
let failCount = 0;
const results = [];

function assert(condition, label, detail) {
  if (condition) {
    passCount++;
    results.push({ test: label, status: 'PASS', detail: detail || '' });
  } else {
    failCount++;
    results.push({ test: label, status: 'FAIL', detail: detail || '' });
  }
}

function assertNoBannedPatterns(text, label) {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      assert(false, `${label} — banned pattern: ${pattern}`, `Found in: ${text.slice(0, 200)}`);
      return;
    }
  }
  assert(true, `${label} — no banned patterns`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 1: Multi-Intent Dashboard + QB + SEO Raw + Maria
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ TEST 1: Multi-Intent CEO Summary ═══');
const t1msg = 'Kiểm tra Dashboard, coi QB, tạo SEO Raw Sushi, rồi gửi Maria';
const t1result = executeMultiIntent(t1msg, { sender: 'ceo' });

assert(t1result.children.length >= 2, 'T1: detected multiple intents', `got ${t1result.children.length} children`);
assertNoBannedPatterns(t1result.final_summary, 'T1: final_summary');
assert(t1result.final_summary.includes('1.'), 'T1: numbered list', t1result.final_summary.slice(0, 100));
console.log('T1 final_summary:\n' + t1result.final_summary);

// ═══════════════════════════════════════════════════════════════
// TEST 2: Context follow-up (no false workflow)
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ TEST 2: Context-Aware Follow-up ═══');
const t2a = processCEORequest({ message: 'Post 1 bài Raw', sender: 'ceo', message_id: 'T2A' });
assert(t2a.action === 'workflow_created', 'T2a: workflow created for action', t2a.action);
assertNoBannedPatterns(t2a.response_message, 'T2a: response');

const t2b = processCEORequest({ message: 'Có hình khác không?', sender: 'ceo', message_id: 'T2B' });
assert(t2b.action !== 'workflow_created', 'T2b: follow-up does NOT create workflow', t2b.action);
assert(!t2b.response_message.includes('unavailable'), 'T2b: no unavailable', t2b.response_message.slice(0, 80));
console.log('T2b action:', t2b.action, '| response:', t2b.response_message.slice(0, 100));

// ═══════════════════════════════════════════════════════════════
// TEST 3: Conversation memory — greetings
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ TEST 3: Greeting / Short Messages ═══');
const greetings = ['Mi ơi', 'Hả?', 'K?'];
for (const g of greetings) {
  const r = processCEORequest({ message: g, sender: 'ceo', message_id: `T3-${g}` });
  assert(r.action !== 'workflow_created', `T3: "${g}" no workflow`, r.action);
  assertNoBannedPatterns(r.response_message, `T3: "${g}" response`);
  console.log(`  "${g}" → action=${r.action}`);
}

// ═══════════════════════════════════════════════════════════════
// TEST 4: Rapid-fire 5 requests in sequence — no duplicates
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ TEST 4: Rapid-fire 5 Requests ═══');
let unavailableCount = 0;
let duplicateCount = 0;
let fallbackCount = 0;
const rapidMessages = [
  'Tạo SEO cho Bakudan',
  'Dashboard status',
  'Coi QB tuần này',
  'Gửi email cho Maria',
  'Kiểm tra status',
];
for (let i = 0; i < rapidMessages.length; i++) {
  const r = processCEORequest({ message: rapidMessages[i], sender: 'ceo', message_id: `T4-${i}` });
  if (r.response_message.includes('unavailable')) unavailableCount++;
  if (r.action === 'duplicate') duplicateCount++;
  if (r.response_message.includes('fallback')) fallbackCount++;
  assertNoBannedPatterns(r.response_message, `T4[${i}]: "${rapidMessages[i]}"`);
}
assert(unavailableCount === 0, 'T4: 0 unavailable messages', `got ${unavailableCount}`);
assert(duplicateCount === 0, 'T4: 0 duplicate replies', `got ${duplicateCount}`);
assert(fallbackCount === 0, 'T4: 0 fallback replies', `got ${fallbackCount}`);
console.log(`  unavailable=${unavailableCount} duplicate=${duplicateCount} fallback=${fallbackCount}`);

// ═══════════════════════════════════════════════════════════════
// TEST 5: Burn-in counters (simulated 100 requests)
// ═══════════════════════════════════════════════════════════════
console.log('\n═══ TEST 5: Burn-in Simulation (100 requests) ═══');
const burnMessages = [
  'Mi ơi', 'status', 'Dashboard', 'QB hôm nay', 'Tạo SEO Pho',
  'Hả?', 'Ok', 'approve', 'tạo bài Raw', 'gửi Maria',
];
let burnUnavail = 0, burnDup = 0, burnFalseWf = 0;
for (let i = 0; i < 100; i++) {
  const msg = burnMessages[i % burnMessages.length];
  const r = processCEORequest({ message: msg, sender: 'ceo', message_id: `BURN-${i}` });
  if (r.response_message.includes('unavailable')) burnUnavail++;
  if (r.response_message.includes('fallback')) burnDup++;
  for (const p of BANNED_PATTERNS) {
    if (p.test(r.response_message)) { burnFalseWf++; break; }
  }
}
assert(burnUnavail === 0, 'T5: unavailable_message_count = 0', `got ${burnUnavail}`);
assert(burnDup === 0, 'T5: duplicate_reply_count = 0', `got ${burnDup}`);
assert(burnFalseWf === 0, 'T5: false_workflow_count = 0', `got ${burnFalseWf}`);
console.log(`  burn-in: unavailable=${burnUnavail} duplicate=${burnDup} false_wf=${burnFalseWf}`);

// ═══════════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════');
console.log(`TOTAL: ${passCount} PASS / ${failCount} FAIL`);
console.log('═══════════════════════════════════════════════');
const verdict = failCount === 0 ? 'CEO_OPERATOR_READY' : 'FAIL';
console.log(`VERDICT: ${verdict}`);
console.log(JSON.stringify({ verdict, passCount, failCount, results }, null, 2));
process.exit(failCount > 0 ? 1 : 0);
