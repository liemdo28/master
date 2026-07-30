// Phase 65 runtime proof - phase-65-store-growth-predictor (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 65 -- StoreGrowthPredictorOS :: RUNTIME PROOF');

const { StoreGrowthPredictorOS } = await import(`../src/orchestrator.js`);
const { GrowthForecastEngine } = await import(`../src/engines.js`);

const eng = new GrowthForecastEngine();
const up = eng.forecast({ history: [100, 110, 120, 130], months: 2 });
check('linear slope computed exactly', () => assert.strictEqual(up.slope, 10));
check('next month projected', () => assert.strictEqual(up.projection[0], 140));
check('rising store classified GROWING', () => assert.strictEqual(up.classification, 'GROWING'));
const down = eng.forecast({ history: [130, 120, 110, 100], months: 1 });
check('falling store classified DECLINING', () => assert.strictEqual(down.classification, 'DECLINING'));
const flat = eng.forecast({ history: [100, 100, 100], months: 1 });
check('flat store classified FLAT', () => assert.strictEqual(flat.classification, 'FLAT'));

const os = new StoreGrowthPredictorOS();
const snap = os.predict({ store: 'Bakudan-1', history: [100, 110, 120, 130], months: 3 });
check('predict records store', () => assert.strictEqual(snap.store, 'Bakudan-1'));
check('predict projects 3 months', () => assert.strictEqual(snap.projection.length, 3));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 65));
check('dashboard() reports growthRate', () => assert.ok(typeof dash.growthRate === 'number'));
check('dashboard() status is classification', () => assert.strictEqual(dash.status, 'GROWING'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
