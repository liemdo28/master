// Phase 55 runtime proof - phase-55-procurement-ai (real domain logic)
import * as assert from 'assert';
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log('  PASS: ' + n); } catch (e) { failed++; console.error('  FAIL: ' + n + ' -- ' + e.message); } };
console.log('PHASE 55 -- ProcurementAIOS :: RUNTIME PROOF');

const { ProcurementAIOS } = await import(`../src/orchestrator.js`);
const { ReorderEngine } = await import(`../src/engines.js`);

const eng = new ReorderEngine();
// demand 10/day, lead 5, safety 2 -> reorderPoint = 10*7 = 70
const low = eng.plan({ sku: 'A', demandPerDay: 10, leadTimeDays: 5, safetyStockDays: 2, onHand: 30, reviewPeriodDays: 7 });
check('reorder point computed', () => assert.strictEqual(low.reorderPoint, 70));
check('low stock needs reorder', () => assert.strictEqual(low.needsReorder, true));
// target = 10*(5+2+7)=140; suggested = 140-30 = 110
check('suggested qty computed', () => assert.strictEqual(low.suggestedQty, 110));
check('days of cover computed', () => assert.strictEqual(low.daysOfCover, 3));
check('stockout risk HIGH when cover < lead time', () => assert.strictEqual(low.stockoutRisk, 'HIGH'));

const ok = eng.plan({ sku: 'B', demandPerDay: 10, leadTimeDays: 5, safetyStockDays: 2, onHand: 200 });
check('well-stocked needs no reorder', () => assert.strictEqual(ok.needsReorder, false));
check('well-stocked suggested qty is 0', () => assert.strictEqual(ok.suggestedQty, 0));
check('well-stocked risk is LOW', () => assert.strictEqual(ok.stockoutRisk, 'LOW'));

const os = new ProcurementAIOS();
const snap = os.plan({ items: [
  { sku: 'A', demandPerDay: 10, leadTimeDays: 5, safetyStockDays: 2, onHand: 30 },
  { sku: 'B', demandPerDay: 10, leadTimeDays: 5, safetyStockDays: 2, onHand: 200 },
] });
check('reorder count correct', () => assert.strictEqual(snap.reorderCount, 1));
check('high-risk count correct', () => assert.strictEqual(snap.highRisk, 1));

const dash = os.dashboard();
check('dashboard() phase correct', () => assert.strictEqual(dash.phase, 55));
check('dashboard() status CRITICAL on high risk', () => assert.strictEqual(dash.status, 'CRITICAL'));
check('dashboard() has status string', () => assert.ok(typeof dash.status === 'string'));

console.log('\n  RESULT: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
