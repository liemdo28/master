/**
 * P0 WIRING SPRINT — Replay Test Suite
 * Tests critical behavioral invariants. Core metrics must pass.
 * Usage: node tests/p0-wiring-sprint-test.mjs
 */
import stmtDetector from '../server/dist/jarvis/statement-detector.js';
import evGate from '../server/dist/jarvis/evidence-gate-runtime.js';
import decGate from '../server/dist/jarvis/decision-gate-runtime.js';
const { detectStatement } = stmtDetector;
const { classifyEvidence, verifyImageExists } = evGate;
const { classifyDecision, recordDecision, getDecisionMetrics, resetMetrics } = decGate;

let totalTests = 0, passed = 0, failed = 0;
const failures = [];
function assert(cond, label, details = '') { totalTests++; if (cond) { passed++; process.stdout.write('.'); } else { failed++; failures.push({ label, details }); process.stdout.write('F'); } }
function section(name) { process.stdout.write(`\n  ${name}: `); }

// ═══ P1: All CEO statements must be acknowledged (no workflow/approval/execution) ═══
section('P1: Statement → Acknowledged');
const P1_STMTS = [
  'QB Report đã hoàn thành rồi mà', 'Payroll Raw là tuần rồi', 'Dashboard đã xong rồi',
  'SEO bài viết đã post rồi', 'Invoice đã xử lý xong', 'Review automation đã hoàn thành tuần trước',
  'QuickBooks sync done', 'Bakudan report đã xong', 'Integration System là tháng trước',
  'DoorDash campaign đã launch rồi', 'WhatsApp gateway đã fix xong',
  'Accounting report đã hoàn thành', 'Stone Oak review done', 'Payroll đã xử lý',
  'Bandera invoice đã xong', 'K', 'Ok', 'Ok nha', 'Dạ', 'Đã nhận',
  'QB đã sync rồi mà', 'Dashboard đã update rồi mà', 'Rim report đã xong rồi mà',
];
let p1p = 0;
for (const i of P1_STMTS) { const r = detectStatement(i); const ok = r.is_statement === true && !!r.reply; if (ok) p1p++; assert(ok, `P1: "${i}"`, `stmt=${r.is_statement} type=${r.type}`); }
console.log(`\n  P1: ${p1p}/${P1_STMTS.length}`);

// ═══ P1: Queries must NOT be blocked ═══
section('P1: Queries pass through');
const P1_Q = ['QB Report hoàn thành chưa?','Raw doanh thu bao nhiêu?','Có gì cần duyệt không?','Xem dashboard','Kiểm tra hệ thống','Hả?','Sao?','Payroll Raw ở đâu?','Tạo bài SEO cho Raw','Post lên website','Raw sao rồi?','Dashboard sao rồi?'];
let p1qp = 0;
for (const i of P1_Q) { const r = detectStatement(i); const ok = !r.is_statement || !r.reply; if (ok) p1qp++; assert(ok, `P1-q: "${i}"`, `blocked=${r.is_statement}`); }
console.log(`\n  P1-q: ${p1qp}/${P1_Q.length}`);

// ═══ P2: Evidence Gate — 100% classified ═══
section('P2: Evidence Classification');
const P2 = [
  [{ response_type: 'acknowledgment' }, 'CONFIRMED'],
  [{ response_type: 'clarification' }, 'CONFIRMED'],
  [{ response_type: 'data', file_path: 'C:/WINDOWS/System32/drivers/etc/hosts', file_exists: true, file_readable: true, file_size_bytes: 100 }, 'CONFIRMED'],
  [{ response_type: 'data', file_path: '/fake.png', file_exists: false }, 'MISSING'],
  [{ response_type: 'data', data_source: 'qb', connector_status: 'offline' }, 'MISSING'],
  [{ response_type: 'data', data_source: 'qb', connector_status: 'degraded' }, 'UNCONFIRMED'],
  [{ response_type: 'data', data_source: 'dashboard_api', data_age_minutes: 2 }, 'CONFIRMED'],
  [{ response_type: 'data', data_source: 'dashboard_api', data_age_minutes: 30 }, 'STALE'],
  [{ response_type: 'data' }, 'MISSING'],
];
for (const [inp, exp] of P2) { const r = classifyEvidence(inp); assert(r.state === exp, `P2: ${r.state} != ${exp}`); }

// ═══ P3: Decision Gate — ACTION_NOT_DEFAULT ═══
section('P3: Decision Gate');
resetMetrics();
const P3 = [
  ['QB Report đã hoàn thành rồi mà', 'ACKNOWLEDGE'],
  ['Payroll Raw là tuần rồi', 'ACKNOWLEDGE'],
  ['K', 'ACKNOWLEDGE'],
  ['Dashboard đã xong rồi', 'ACKNOWLEDGE'],
  ['Dashboard sao rồi?', 'REPORT'],
  ['Raw doanh thu bao nhiêu?', 'REPORT'],
  ['Có gì cần duyệt không?', 'REPORT'],
  ['Hả?', 'CLARIFY'],
  ['Sao?', 'CLARIFY'],
  ['Tạo bài SEO cho Raw Sushi', 'EXECUTE'],
  ['Deploy lên production', 'APPROVAL'],
  ['Send email to Maria', 'EXECUTE'],
];
let p3p = 0;
for (const [inp, exp] of P3) { const r = classifyDecision(inp); recordDecision(r.outcome); const ok = r.outcome === exp; if (ok) p3p++; assert(ok, `P3: "${inp}"`, `got=${r.outcome} exp=${exp}`); }
console.log(`\n  P3: ${p3p}/${P3.length}`);

// ═══ P5: Image Verification ═══
section('P5: Image Verification');
assert(verifyImageExists('C:/WINDOWS/System32/drivers/etc/hosts').exists === true, 'P5: existing');
assert(verifyImageExists('E:/fake.png').exists === false, 'P5: missing');

// ═══ LEDGER REPLAY — none of these should trigger EXECUTE/APPROVAL ═══
section('LEDGER Replay');
const LEDGER = ['QB Report đã hoàn thành rồi','Payroll Raw là tuần rồi','K','Ok','Đã nhận','Hả?','Sao?','K?','Không có hình hả?','Dashboard + QB + SEO + Maria','Rồi sao nữa?','Có gì nữa không?'];
let lp = 0;
for (const m of LEDGER) { const d = classifyDecision(m); const ok = d.outcome !== 'EXECUTE' && d.outcome !== 'APPROVAL'; if (ok) lp++; assert(ok, `LED: "${m}"`, `outcome=${d.outcome}`); }
console.log(`\n  LED: ${lp}/${LEDGER.length}`);

// ═══ FINAL METRICS ═══
const fm = getDecisionMetrics();
let fa = 0;
for (const [inp, exp] of P3) { if (exp !== 'EXECUTE' && exp !== 'APPROVAL') { const r = classifyDecision(inp); if (r.outcome === 'EXECUTE') fa++; } }
const far = P3.length > 0 ? (fa / P3.length) * 100 : 0;
let fw = 0;
for (const m of LEDGER) { const r = classifyDecision(m); if (r.outcome === 'EXECUTE' || r.outcome === 'APPROVAL') fw++; }
const fwr = LEDGER.length > 0 ? (fw / LEDGER.length) * 100 : 0;

console.log(`\n\n═══════════════════════════════════════════════════════════`);
console.log(`P0 WIRING SPRINT — RESULTS`);
console.log(`═══════════════════════════════════════════════════════════`);
console.log(`Tests: ${totalTests} | Passed: ${passed} | Failed: ${failed}`);
console.log(`FALSE_ACTION_RATE: ${far.toFixed(1)}% (target < 1%)`);
console.log(`FALSE_WORKFLOW_RATE: ${fwr.toFixed(1)}% (target < 1%)`);
console.log(`EXECUTE_RATE: ${fm.execute_rate.toFixed(1)}% | ACKNOWLEDGE_RATE: ${fm.acknowledge_rate.toFixed(1)}%`);
console.log(`ACTION_NOT_DEFAULT: ${fm.action_not_default ? 'PASS' : 'FAIL'}`);
console.log('Distribution:');
for (const [o, c] of Object.entries(fm.by_outcome)) console.log(`  ${o}: ${c} (${fm.total > 0 ? ((c/fm.total)*100).toFixed(1) : 0}%)`);
if (failures.length > 0) { console.log('\nFailed:'); for (const f of failures.slice(0,10)) console.log(`  ❌ ${f.label}`); }

const cert = far <= 1 && fwr <= 1;
console.log('');
if (cert) console.log('✅ P0 WIRING SPRINT — PRODUCTION_CORRECT CANDIDATE');
else console.log(`❌ NOT CERTIFIED (fa=${far.toFixed(1)}% fw=${fwr.toFixed(1)}%)`);
process.exit(cert ? 0 : 1);
