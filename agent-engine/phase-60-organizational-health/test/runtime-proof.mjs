// Phase 60 runtime proof - phase-60-organizational-health (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 60 -- OrganizationalHealthOS :: RUNTIME PROOF');

const { OrganizationalHealthOS } = await import(`../src/orchestrator.js`);
const { HealthIndexEngine } = await import(`../src/engines.js`);

const eng = new HealthIndexEngine();
const all100 = eng.compute({ team: 100, project: 100, finance: 100, ops: 100 });
check('all-100 yields index 100', () => assert.strictEqual(all100.index, 100));
check('all-100 is HEALTHY', () => assert.strictEqual(all100.band, 'HEALTHY'));

const mixed = eng.compute({ team: 80, project: 60, finance: 40, ops: 90 });
// 80*.3 + 60*.25 + 40*.3 + 90*.15 = 24 + 15 + 12 + 13.5 = 64.5
check('weighted index computed exactly', () => assert.strictEqual(mixed.index, 64.5));
check('weakest domain identified', () => assert.strictEqual(mixed.weakest, 'finance'));
check('mid index is WATCH', () => assert.strictEqual(mixed.band, 'WATCH'));

const poor = eng.compute({ team: 30, project: 40, finance: 20, ops: 50 });
check('low index is CRITICAL', () => assert.strictEqual(poor.band, 'CRITICAL'));

const os = new OrganizationalHealthOS();
const snap = os.assess({ team: 80, project: 60, finance: 40, ops: 90 });
check('assess persists index', () => assert.strictEqual(snap.index, 64.5));
check('assess flags weakest domain', () => assert.ok(snap.warnings.some((w) => w.includes('finance'))));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 60));
check('dashboard() reports index', () => assert.strictEqual(dash.index, 64.5));
check('dashboard() reports weakest', () => assert.strictEqual(dash.weakest, 'finance'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
