// Phase 77 runtime proof - phase-77-investment-evaluation (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 77 -- InvestmentEvaluationOS :: RUNTIME PROOF');

const { InvestmentEvaluationOS } = await import(`../src/orchestrator.js`);
const { NPVEngine } = await import(`../src/engines.js`);

const eng = new NPVEngine();
const good = eng.evaluate({ initial: 1000, cashflows: [400, 400, 400, 400], discountRate: 0.1 });
check('NPV computed (positive)', () => assert.strictEqual(good.npv, 267.95));
check('ROI computed', () => assert.strictEqual(good.roi, 60)); // (1600-1000)/1000*100
check('fractional payback computed', () => assert.strictEqual(good.paybackPeriod, 2.5)); // 800 after 2y, +200/400
check('positive NPV + fast payback -> INVEST', () => assert.strictEqual(good.decision, 'INVEST'));

const bad = eng.evaluate({ initial: 1000, cashflows: [100, 100, 100], discountRate: 0.1 });
check('negative NPV -> REJECT', () => assert.strictEqual(bad.decision, 'REJECT'));
check('never-recovered payback is Infinity', () => assert.strictEqual(bad.paybackPeriod, Infinity));

const slow = eng.evaluate({ initial: 1000, cashflows: [200, 200, 200, 200, 200, 300], discountRate: 0.05, maxPaybackYears: 4 });
check('positive NPV but slow payback -> REVIEW', () => assert.strictEqual(slow.decision, 'REVIEW'));

const os = new InvestmentEvaluationOS();
const snap = os.evaluate({ name: 'Project-X', initial: 1000, cashflows: [400, 400, 400, 400], discountRate: 0.1 });
check('evaluate records name', () => assert.strictEqual(snap.name, 'Project-X'));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 77));
check('dashboard() reports npv', () => assert.ok(typeof dash.npv === 'number'));
check('dashboard() status is decision', () => assert.strictEqual(dash.status, 'INVEST'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
