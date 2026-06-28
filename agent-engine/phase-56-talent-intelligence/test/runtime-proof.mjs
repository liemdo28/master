// Phase 56 runtime proof - phase-56-talent-intelligence (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 56 -- TalentIntelligenceOS :: RUNTIME PROOF');

const { TalentIntelligenceOS } = await import(`../src/orchestrator.js`);
const { CapacityEngine, RetentionRiskEngine } = await import(`../src/engines.js`);

const cap = new CapacityEngine();
check('utilization computed correctly', () => assert.strictEqual(cap.utilization({ capacityHrs: 40, allocatedHrs: 50 }).utilization, 1.25));
check('overload classified', () => assert.strictEqual(cap.utilization({ capacityHrs: 40, allocatedHrs: 50 }).status, 'OVERLOADED'));
check('underutilized classified', () => assert.strictEqual(cap.utilization({ capacityHrs: 40, allocatedHrs: 10 }).status, 'UNDERUTILIZED'));
check('balanced classified', () => assert.strictEqual(cap.utilization({ capacityHrs: 40, allocatedHrs: 30 }).status, 'BALANCED'));

const ret = new RetentionRiskEngine();
const high = ret.score({ performance: 45, capacityHrs: 40, allocatedHrs: 60, tenureMonths: 18, lastReviewDays: 240 });
check('high-risk person scores HIGH band', () => assert.strictEqual(high.band, 'HIGH'));
check('risk score is 0..100', () => assert.ok(high.score >= 0 && high.score <= 100));
check('risk drivers are explained', () => assert.ok(high.drivers.length >= 3));
const low = ret.score({ performance: 90, capacityHrs: 40, allocatedHrs: 28, tenureMonths: 48, lastReviewDays: 30 });
check('healthy person scores LOW band', () => assert.strictEqual(low.band, 'LOW'));

const os = new TalentIntelligenceOS();
const snap = os.assess({ people: [
  { name: 'A', role: 'dev', performance: 45, capacityHrs: 40, allocatedHrs: 60, tenureMonths: 18, lastReviewDays: 240 },
  { name: 'B', role: 'dev', performance: 92, capacityHrs: 40, allocatedHrs: 30, tenureMonths: 50, lastReviewDays: 20 },
  { name: 'C', role: 'ops', performance: 70, capacityHrs: 40, allocatedHrs: 8, tenureMonths: 6, lastReviewDays: 60 },
] });
check('assess returns per-person rows', () => assert.strictEqual(snap.people.length, 3));
check('headcount correct', () => assert.strictEqual(snap.headcount, 3));
check('overloaded count correct', () => assert.strictEqual(snap.overloaded, 1));
check('underutilized count correct', () => assert.strictEqual(snap.underutilized, 1));
check('at-least-one at risk', () => assert.ok(snap.atRisk >= 1));
check('status is CRITICAL with a HIGH-risk person', () => assert.strictEqual(snap.status, 'CRITICAL'));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 56));
check('dashboard() reports headcount', () => assert.strictEqual(dash.headcount, 3));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
