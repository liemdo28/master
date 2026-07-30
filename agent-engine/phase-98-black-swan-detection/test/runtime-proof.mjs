// Phase 98 runtime proof - phase-98-black-swan-detection (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 98 -- BlackSwanDetectionOS :: RUNTIME PROOF');

const { BlackSwanDetectionOS } = await import(`../src/orchestrator.js`);
const { AnomalyEngine } = await import(`../src/engines.js`);

const eng = new AnomalyEngine();
// nine 10s and one 40: mean 13, std 9, z(40)=3 -> exactly one anomaly at threshold 3
const out = eng.scan([10, 10, 10, 10, 10, 10, 10, 10, 10, 40], 3);
check('mean computed', () => assert.strictEqual(out.mean, 13));
check('std computed', () => assert.strictEqual(out.std, 9));
check('exactly one anomaly detected', () => assert.strictEqual(out.anomalies.length, 1));
check('anomaly is the outlier value', () => assert.strictEqual(out.anomalies[0].value, 40));
check('anomaly z-score is 3', () => assert.strictEqual(out.anomalies[0].z, 3));
check('posture is ALERT', () => assert.strictEqual(out.posture, 'ALERT'));

const calm = eng.scan([10, 11, 9, 10, 10, 11, 9, 10], 3);
check('stable series has no anomalies', () => assert.strictEqual(calm.anomalies.length, 0));
check('stable series posture CALM', () => assert.strictEqual(calm.posture, 'CALM'));

const single = eng.scan([5], 3);
check('single point is CALM (insufficient data)', () => assert.strictEqual(single.posture, 'CALM'));

const os = new BlackSwanDetectionOS();
os.scan({ series: [10, 10, 10, 10, 10, 10, 10, 10, 10, 40], threshold: 3 });
const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 98));
check('dashboard() reports anomaly count', () => assert.strictEqual(dash.anomalies, 1));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
