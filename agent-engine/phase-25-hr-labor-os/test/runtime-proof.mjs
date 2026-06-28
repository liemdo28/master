/**
 * runtime-proof.mjs — Phase 25 HR / Staffing / Labor OS.
 * Scenario: labor cost high -> schedule risk -> manager task -> approval recommendation.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import HRLaborOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase25-'));
const hr = new HRLaborOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log(`  ✅ ${n}`); } catch (e) { failed++; console.error(`  ❌ ${n} — ${e.message}`); } };
console.log('PHASE 25 — HR / STAFFING / LABOR OS :: RUNTIME PROOF\n');

// Onboard staff
hr.employees.onboard({ employeeId: 'e1', name: 'Alex Chen', role: 'cook', storeId: 'store-1', hourlyRate: 18 });
hr.employees.onboard({ employeeId: 'e2', name: 'Maria Lopez', role: 'server', storeId: 'store-1', hourlyRate: 15 });
check('employees onboarded', () => assert.strictEqual(hr.employees.active().length, 2));

// HIGH scenario: labor $580 over $500 budget, understaffed 5/10, attendance issue for e2
const r = hr.assessStoreShift({
  store: { storeId: 'store-1', scheduledStaff: 5, requiredStaff: 6 },
  laborSpend: 580, laborBudget: 500,
  attendanceByEmployee: ['e1', 'e2'],
});
check('labor cost OVER_BUDGET detected', () => assert.strictEqual(r.labor.level, 'OVER_BUDGET'));
check('schedule risk HIGH (5/6)', () => assert.strictEqual(r.schedule.level, 'HIGH'));
check('schedule HIGH -> approval required', () => assert.strictEqual(r.schedule.approvalRequired, true));
check('material risk -> manager task created', () => assert.ok(r.task !== null));
check('task is approval-gated', () => assert.strictEqual(r.task.approvalRequired, true));
check('task captures multiple reasons', () => assert.ok(Array.isArray(r.task.reasons) && r.task.reasons.length >= 2));
check('task routed to operations/store-manager', () => assert.ok(r.task.division === 'operations' && r.task.owner === 'store-manager'));

// Training compliance: e1 missing required course -> no task (training only, not labor risk)
hr.training.assign('e1', 'food-safety-cert');
const missing = hr.training.missing('e1', ['food-safety-cert', 'harassment-training']);
check('missing training courses detected', () => assert.ok(missing.length >= 1));
hr.training.complete('e1', 'food-safety-cert');
check('training completion tracked', () => assert.ok(hr.training.missing('e1', ['food-safety-cert']).length === 0));

// Performance: score below threshold -> BELOW rating
const perf = hr.performance.record('e2', 42);
check('performance BELOW threshold for score 42', () => assert.strictEqual(perf.level, 'BELOW'));
check('performance EXCEEDS for score 90', () => assert.strictEqual(hr.performance.record('e1', 90).level, 'EXCEEDS'));

const dash = hr.dashboard();
check('dashboard reports AT_RISK (over-budget labor)', () => assert.strictEqual(dash.status, 'AT_RISK'));
check('dashboard counts active employees', () => assert.ok(dash.employees >= 2));
check('dashboard counts over-budget stores', () => assert.ok(dash.overBudgetStores >= 1));

const hr2 = new HRLaborOS({ dataDir: DATA_DIR });
check('employees persisted across restart', () => assert.ok(hr2.employees.active().length >= 2));
check('labor records persisted across restart', () => assert.ok(hr2.labor.all().length >= 1));

console.log(`\n  RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
