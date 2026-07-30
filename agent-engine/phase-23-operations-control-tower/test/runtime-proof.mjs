/**
 * runtime-proof.mjs — Phase 23 Operations Control Tower.
 * Scenario: missing food-safety submission -> store risk -> manager alert -> evidence -> executive summary.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import OperationsControlTower from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase23-'));
const ops = new OperationsControlTower({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log(`  ✅ ${n}`); } catch (e) { failed++; console.error(`  ❌ ${n} — ${e.message}`); } };
console.log('PHASE 23 — OPERATIONS CONTROL TOWER :: RUNTIME PROOF\n');

// Store submitted opening only; food_safety is MISSING
ops.checklists.submit({ storeId: 'store-1', type: 'opening' });
const r = ops.inspectStore({ storeId: 'store-1', requiredStaff: 10, scheduledStaff: 5 });

check('food_safety detected missing', () => assert.ok(r.missing.includes('food_safety')));
check('food-safety risk = HIGH', () => assert.strictEqual(r.foodSafety.level, 'HIGH'));
check('store health computed', () => assert.ok(typeof r.health.score === 'number'));
check('store health AT_RISK/CRITICAL', () => assert.ok(['AT_RISK', 'CRITICAL'].includes(r.health.status)));
check('staffing risk HIGH (5/10)', () => assert.strictEqual(r.staffing.level, 'HIGH'));
check('incident routed to store-manager', () => assert.ok(r.incident && r.incident.owner === 'store-manager'));
check('high incident is approval-gated', () => assert.strictEqual(r.incident.approvalRequired, true));
check('incident carries evidence ref', () => assert.ok(/foodsafety/.test(r.incident.evidenceRef)));
const dash = ops.dashboard();
check('dashboard counts incidents', () => assert.ok(dash.incidents >= 1));
const ops2 = new OperationsControlTower({ dataDir: DATA_DIR });
check('store health persisted across restart', () => assert.ok(ops2.storeHealth.all().length >= 1));
console.log(`\n  RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
