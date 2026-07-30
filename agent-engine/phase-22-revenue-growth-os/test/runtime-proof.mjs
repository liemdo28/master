/**
 * runtime-proof.mjs — Phase 22 Revenue Growth OS.
 * Scenario: revenue objective -> channel analysis -> DoorDash/SEO/website tasks -> approval-gated plan.
 */
import { mkdtempSync } from 'fs'; import { tmpdir } from 'os'; import { join } from 'path'; import assert from 'assert';
import RevenueGrowthOS from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase22-'));
const rev = new RevenueGrowthOS({ dataDir: DATA_DIR });
let passed = 0, failed = 0;
const check = (n, f) => { try { f(); passed++; console.log(`  ✅ ${n}`); } catch (e) { failed++; console.error(`  ❌ ${n} — ${e.message}`); } };
console.log('PHASE 22 — REVENUE GROWTH OS :: RUNTIME PROOF\n');

const channels = [
  { channel: 'doordash', revenue: 1200, spend: 200, potential: 2000 },
  { channel: 'website', revenue: 400, spend: 50, potential: 900 },
  { channel: 'seo', revenue: 300, spend: 0, potential: 800 },
];
const offer = { name: '15% off online', baseMargin: 25, discountPct: 15 };
const r = rev.growthCycle(channels, offer);

check('channels analyzed with ROI', () => assert.ok(r.analyzed.every((c) => 'roi' in c)));
check('opportunities ranked by score', () => assert.ok(r.opportunities[0].score >= r.opportunities[1].score));
check('top opportunity has headroom', () => assert.ok(r.topOpportunity.headroom > 0));
check('offer risk evaluated (margin 25-15=10 -> HIGH)', () => assert.strictEqual(r.offerRisk.level, 'HIGH'));
check('risky offer requires approval', () => assert.strictEqual(r.offerRisk.approvalRequired, true));
check('promotion plan pending approval', () => assert.strictEqual(r.promotion.status, 'pending_approval'));
check('sales tasks routed to divisions', () => assert.ok(r.tasks.length >= 1 && r.tasks.every((t) => t.division)));
check('doordash routed to operations', () => assert.ok(r.tasks.find((t) => t.channel === 'doordash')?.division === 'operations'));
const dash = rev.dashboard();
check('dashboard reports pending approvals', () => assert.ok(dash.pendingApproval >= 1));
const rev2 = new RevenueGrowthOS({ dataDir: DATA_DIR });
check('opportunities persisted across restart', () => assert.ok(rev2.opportunities.all().length >= 1));
console.log(`\n  RESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
