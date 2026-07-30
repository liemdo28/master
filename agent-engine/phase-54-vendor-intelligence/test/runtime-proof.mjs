// Phase 54 runtime proof - phase-54-vendor-intelligence (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 54 -- VendorIntelligenceOS :: RUNTIME PROOF');

const { VendorIntelligenceOS } = await import(`../src/orchestrator.js`);
const { VendorScorecardEngine } = await import(`../src/engines.js`);

const eng = new VendorScorecardEngine();
const top = eng.score({ onTimeRate: 1, qualityRate: 1, priceIndex: 0.8, reliabilityRate: 1 });
check('excellent vendor scores 100', () => assert.strictEqual(top.score, 100));
check('excellent vendor is PREFERRED', () => assert.strictEqual(top.tier, 'PREFERRED'));
const mid = eng.score({ onTimeRate: 0.7, qualityRate: 0.7, priceIndex: 1.0, reliabilityRate: 0.7 });
// onTime70*.3 + q70*.3 + price80*.2 + rel70*.2 = 21+21+16+14 = 72
check('mid vendor score computed exactly', () => assert.strictEqual(mid.score, 72));
check('mid vendor is APPROVED', () => assert.strictEqual(mid.tier, 'APPROVED'));
const poor = eng.score({ onTimeRate: 0.3, qualityRate: 0.3, priceIndex: 1.2, reliabilityRate: 0.3 });
check('poor vendor is PROBATION', () => assert.strictEqual(poor.tier, 'PROBATION'));

const os = new VendorIntelligenceOS();
const snap = os.assess({ vendors: [
  { name: 'Alpha', onTimeRate: 1, qualityRate: 1, priceIndex: 0.8, reliabilityRate: 1 },
  { name: 'Beta', onTimeRate: 0.7, qualityRate: 0.7, priceIndex: 1.0, reliabilityRate: 0.7 },
  { name: 'Gamma', onTimeRate: 0.3, qualityRate: 0.3, priceIndex: 1.2, reliabilityRate: 0.3 },
] });
check('vendors ranked by score', () => assert.strictEqual(snap.vendors[0].name, 'Alpha'));
check('top vendor recorded', () => assert.strictEqual(snap.topVendor, 'Alpha'));
check('probation count correct', () => assert.strictEqual(snap.probation, 1));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 54));
check('dashboard() reports vendor count', () => assert.strictEqual(dash.vendors, 3));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
