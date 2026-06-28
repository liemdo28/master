/**
 * runtime-proof.mjs — Phase 24 Procurement & Inventory Intelligence.
 * Scenario: ingredient cost increase -> COGS risk -> vendor task -> CFO alert.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import ProcurementInventoryOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase24-'));
const proc = new ProcurementInventoryOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log(`  ✅ ${n}`); } catch (e) { failed++; console.error(`  ❌ ${n} — ${e.message}`); } };
console.log('PHASE 24 — PROCUREMENT & INVENTORY INTELLIGENCE :: RUNTIME PROOF\n');

// Register alternative vendors for salmon so a re-source task has options.
proc.vendors.register({ name: 'Primary Seafood Co', ingredient: 'salmon', reliability: 0.9 });
proc.vendors.register({ name: 'Bay Fisheries', ingredient: 'salmon', reliability: 0.85 });

// Salmon cost jumped from $9.00 to $12.50 (+38.9%); salmon weighs 12% of COGS.
const r = proc.assessIngredient({ ingredient: 'salmon', unitCost: 12.5, prevCost: 9.0, weightInCogs: 12 });

check('cost delta computed (+38.9%)', () => assert.ok(r.costDeltaPct > 38 && r.costDeltaPct < 40));
check('COGS impact computed', () => assert.ok(typeof r.cogs.cogsImpactPct === 'number' && r.cogs.cogsImpactPct > 0));
check('COGS risk = HIGH (impact >= 2%)', () => assert.strictEqual(r.cogs.level, 'HIGH'));
check('CFO alert raised on material COGS risk', () => assert.strictEqual(r.cfoAlert, true));
check('vendor re-source task created', () => assert.ok(r.vendorTask && /salmon/.test(r.vendorTask.title)));
check('re-source task is approval-gated', () => assert.strictEqual(r.vendorTask.approvalRequired, true));
check('task reports alternative vendor count', () => assert.ok(r.vendorTask.altVendors >= 2));
check('task routed to finance/procurement', () => assert.ok(r.vendorTask.division === 'finance' && r.vendorTask.owner === 'procurement'));

// A LOW-risk ingredient should NOT trigger a task or alert.
const low = proc.assessIngredient({ ingredient: 'rice', unitCost: 1.0, prevCost: 0.99, weightInCogs: 4 });
check('low-cost ingredient -> LOW COGS risk', () => assert.strictEqual(low.cogs.level, 'LOW'));
check('low-risk ingredient has no vendor task', () => assert.strictEqual(low.vendorTask, null));
check('low-risk ingredient has no CFO alert', () => assert.strictEqual(low.cfoAlert, false));

const dash = proc.dashboard();
check('dashboard status AT_RISK (high COGS present)', () => assert.strictEqual(dash.status, 'AT_RISK'));
check('dashboard counts COGS assessments', () => assert.ok(dash.cogsAssessments >= 2));

const proc2 = new ProcurementInventoryOS({ dataDir: DATA_DIR });
check('COGS assessments persisted across restart', () => assert.ok(proc2.cogs.all().length >= 2));

console.log(`\n  RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
