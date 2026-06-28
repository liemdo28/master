// Phase 99 runtime proof - phase-99-corporate-guardian (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 99 -- CorporateGuardianOS :: RUNTIME PROOF');

const { CorporateGuardianOS } = await import(`../src/orchestrator.js`);
const { GuardianEngine, PILLARS } = await import(`../src/engines.js`);

check('four protected pillars defined', () => assert.deepStrictEqual(PILLARS, ['data', 'revenue', 'reputation', 'operations']));

const eng = new GuardianEngine();
const clean = eng.assess([]);
check('no threats -> overall protection 100', () => assert.strictEqual(clean.overall, 100));
check('no threats -> SECURE posture', () => assert.strictEqual(clean.posture, 'SECURE'));

const mixed = eng.assess([
  { pillar: 'data', severity: 'high' },     // load 50 -> protection 50
  { pillar: 'revenue', severity: 'medium' }, // load 25 -> protection 75
]);
check('per-pillar protection computed', () => assert.strictEqual(mixed.pillars.find((p) => p.pillar === 'data').protection, 50));
// overall = (50 + 75 + 100 + 100) / 4 = 81.25
check('overall protection averaged', () => assert.strictEqual(mixed.overall, 81.25));
check('weakest pillar identified', () => assert.strictEqual(mixed.weakest, 'data'));

const crit = eng.assess([{ pillar: 'operations', severity: 'critical' }]);
check('critical threat -> DEFCON_CRITICAL', () => assert.strictEqual(crit.posture, 'DEFCON_CRITICAL'));
check('critical threat flagged', () => assert.strictEqual(crit.anyCritical, true));

const os = new CorporateGuardianOS();
const snap = os.guard({ threats: [{ pillar: 'data', severity: 'high' }, { pillar: 'revenue', severity: 'medium' }] });
check('guard persists overall', () => assert.strictEqual(snap.overall, 81.25));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 99));
check('dashboard() reports overall', () => assert.strictEqual(dash.overall, 81.25));
check('dashboard() reports per-pillar protection', () => assert.strictEqual(dash.protection.data, 50));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
