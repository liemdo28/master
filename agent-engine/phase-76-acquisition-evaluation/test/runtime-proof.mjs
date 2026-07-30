// Phase 76 runtime proof - phase-76-acquisition-evaluation (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 76 -- AcquisitionEvaluationOS :: RUNTIME PROOF');

const { AcquisitionEvaluationOS } = await import(`../src/orchestrator.js`);
const { ValuationEngine } = await import(`../src/engines.js`);

const eng = new ValuationEngine();
// fairValue = 100*5 = 500, asking 400 -> gap +25% -> UNDERVALUED
const under = eng.evaluate({ name: 'T1', ebitda: 100, multiple: 5, askingPrice: 400, annualProfit: 100 });
check('fair value computed', () => assert.strictEqual(under.fairValue, 500));
check('gap pct computed', () => assert.strictEqual(under.gapPct, 25));
check('undervalued verdict', () => assert.strictEqual(under.verdict, 'UNDERVALUED'));
check('payback years computed', () => assert.strictEqual(under.paybackYears, 4));
// fairValue 500, asking 600 -> gap -16.67% -> OVERVALUED
const over = eng.evaluate({ name: 'T2', ebitda: 100, multiple: 5, askingPrice: 600, annualProfit: 50 });
check('overvalued verdict', () => assert.strictEqual(over.verdict, 'OVERVALUED'));

const os = new AcquisitionEvaluationOS();
const snap = os.evaluate({ target: { name: 'T1', ebitda: 100, multiple: 5, askingPrice: 400, annualProfit: 100 } });
check('good deal -> PURSUE', () => assert.strictEqual(snap.recommendation, 'PURSUE'));
const snap2 = os.evaluate({ target: { name: 'T2', ebitda: 100, multiple: 5, askingPrice: 600, annualProfit: 50 } });
check('overvalued -> PASS', () => assert.strictEqual(snap2.recommendation, 'PASS'));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 76));
check('dashboard() reports verdict', () => assert.ok(typeof dash.verdict === 'string'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
