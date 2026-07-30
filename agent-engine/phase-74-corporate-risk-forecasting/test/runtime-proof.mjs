// Phase 74 runtime proof - phase-74-corporate-risk-forecasting (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 74 -- CorporateRiskForecastingOS :: RUNTIME PROOF');

const { CorporateRiskForecastingOS } = await import(`../src/orchestrator.js`);
const { RiskRegisterEngine, RiskForecastEngine } = await import(`../src/engines.js`);

const reg = new RiskRegisterEngine();
const a = reg.assess([
  { name: 'data-breach', category: 'security', probability: 0.8, impact: 90 },
  { name: 'staff-churn', category: 'people', probability: 0.3, impact: 40 },
]);
check('exposure = probability*impact', () => assert.strictEqual(a.rows[0].exposure, 72));
check('high exposure -> CRITICAL severity', () => assert.strictEqual(a.rows[0].severity, 'CRITICAL'));
check('top risk identified', () => assert.strictEqual(a.topRisk, 'data-breach'));
check('total exposure summed', () => assert.strictEqual(a.totalExposure, 84));
check('critical count correct', () => assert.strictEqual(a.criticalCount, 1));

const fc = new RiskForecastEngine();
const p = fc.project([{ name: 'data-breach', probability: 0.5, impact: 80, trend: 'up' }]);
check('rising trend increases probability', () => assert.strictEqual(p.rows[0].projectedProbability, 0.6));
check('projected exposure recomputed', () => assert.strictEqual(p.rows[0].projectedExposure, 48));
const pd = fc.project([{ name: 'x', probability: 0.5, impact: 80, trend: 'down' }]);
check('falling trend decreases probability', () => assert.strictEqual(pd.rows[0].projectedProbability, 0.4));

const os = new CorporateRiskForecastingOS();
const snap = os.analyze({ risks: [{ name: 'data-breach', category: 'security', probability: 0.8, impact: 90, trend: 'up' }] });
check('analyze flags CRITICAL posture', () => assert.strictEqual(snap.posture, 'CRITICAL'));
check('analyze detects rising exposure', () => assert.strictEqual(snap.rising, true));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 74));
check('dashboard() reports totalExposure', () => assert.ok(typeof dash.totalExposure === 'number'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
