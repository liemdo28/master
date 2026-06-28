/**
 * runtime-proof.mjs — Phase 20 Autonomous Executive OS (capstone) Runtime Proof.
 *
 * Sets a growth objective with 4 divisions, runs the autonomous planner
 * (greedy budget allocation by risk-adjusted ROI), computes company risk
 * posture, exercises continuous monitoring verdicts, cross-division
 * rebalancing, and the global halt/resume kill switch. Isolated temp dir.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import CEOControlPanel from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase20-'));
const ceo = new CEOControlPanel({ dataDir: DATA_DIR });

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ ${name} — ${err.message}`);
  }
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('  PHASE 20 — AUTONOMOUS EXECUTIVE OS :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* CASE 1: autonomous planning ------------------------------------- */
console.log('CASE 1: autonomous planning (greedy risk-adjusted ROI)');
// Div A: cost 100, return 400, risk 0.1 -> adj 3.6 (best)
// Div B: cost 200, return 700, risk 0.2 -> adj 2.8
// Div C: cost 150, return 300, risk 0.5 -> adj 1.0
// Div D: cost 300, return 900, risk 0.4 -> adj 1.8
const obj = ceo.setObjective({
  title: 'Q3 Growth',
  budget: 350,
  divisions: [
    { id: 'div-a', expectedReturn: 400, cost: 100, risk: 0.1 },
    { id: 'div-b', expectedReturn: 700, cost: 200, risk: 0.2 },
    { id: 'div-c', expectedReturn: 300, cost: 150, risk: 0.5 },
    { id: 'div-d', expectedReturn: 900, cost: 300, risk: 0.4 },
  ],
});
const cycle = ceo.runCycle([{ divisionId: 'div-a', riskScore: 0.1 }, { divisionId: 'div-b', riskScore: 0.15 }]);
check('plan selected within budget', () => assert.ok(cycle.plan.spend <= 350));
check('plan picked div-a first (highest risk-adjusted ROI)', () =>
  assert.strictEqual(cycle.plan.selected[0].divisionId, 'div-a')
);
check('plan then picked div-b (next best, fits remaining budget)', () =>
  assert.ok(cycle.plan.selected.find((s) => s.divisionId === 'div-b'))
);
check('plan deferred lower-ROI divisions', () => assert.ok(cycle.plan.deferred.length >= 1));

/* CASE 2: executive risk posture ---------------------------------- */
console.log('\nCASE 2: executive risk posture');
check('low division signals -> GREEN posture', () => assert.strictEqual(cycle.posture.posture, 'GREEN'));
const redCycle = ceo.risk.posture([{ divisionId: 'div-c', riskScore: 0.8 }]);
check('a division at 0.8 risk -> RED posture', () => assert.strictEqual(redCycle.posture, 'RED'));
const amberCycle = ceo.risk.posture([{ divisionId: 'div-a', riskScore: 0.45 }]);
check('a division at 0.45 risk -> AMBER posture', () => assert.strictEqual(amberCycle.posture, 'AMBER'));

/* CASE 3: continuous monitoring ----------------------------------- */
console.log('\nCASE 3: continuous monitoring verdicts');
const m1 = ceo.monitoring.evaluate({ divisionId: 'div-a', metric: 'latency-delta', value: 0.2 });
check('value 0.2 -> ok', () => assert.strictEqual(m1.verdict, 'ok'));
const m2 = ceo.monitoring.evaluate({ divisionId: 'div-a', metric: 'latency-delta', value: 0.35 });
check('value 0.35 -> watch', () => assert.strictEqual(m2.verdict, 'watch'));
const m3 = ceo.monitoring.evaluate({ divisionId: 'div-b', metric: 'error-rate', value: 0.55 });
check('value 0.55 -> alert', () => assert.strictEqual(m3.verdict, 'alert'));
const m4 = ceo.monitoring.evaluate({ divisionId: 'div-c', metric: 'error-rate', value: 0.85 });
check('value 0.85 -> escalate', () => assert.strictEqual(m4.verdict, 'escalate'));
check('escalations are queryable', () => assert.ok(ceo.monitoring.escalations().length >= 1));

/* CASE 4: cross-division optimizer -------------------------------- */
console.log('\nCASE 4: cross-division optimizer rebalance');
const reb = ceo.optimizer.rebalance({
  objective: 'Q3 Growth',
  budget: 350,
  divisions: [
    { id: 'div-a', expectedReturn: 400, cost: 100, risk: 0.1 },
    { id: 'div-b', expectedReturn: 700, cost: 200, risk: 0.2 },
    { id: 'div-c', expectedReturn: 300, cost: 150, risk: 0.5 },
  ],
});
check('rebalance stays within budget', () => assert.ok(reb.totalSpend <= 350));
check('rebalance efficiency = expectedReturn / spend', () =>
  assert.ok(reb.efficiency > 0)
);
check('rebalance deferred at least one low-ROI division', () => assert.ok(reb.deferred.length >= 1));

/* CASE 5: global kill switch (halt/resume company) ---------------- */
console.log('\nCASE 5: global kill switch (halt/resume the company)');
check('kill switch initially not tripped', () => assert.strictEqual(ceo.killSwitch.isTripped(), false));
ceo.haltCompany('executive emergency: cash-flow breach');
check('after halt, kill switch is tripped', () => assert.strictEqual(ceo.killSwitch.isTripped(), true));
const dash = ceo.dashboard([{ divisionId: 'div-a', riskScore: 0.1 }]);
check('dashboard reflects tripped kill switch', () => assert.strictEqual(dash.killSwitchTripped, true));
ceo.resumeCompany();
check('after resume, kill switch cleared', () => assert.strictEqual(ceo.killSwitch.isTripped(), false));

/* CASE 6: dashboard shape ----------------------------------------- */
console.log('\nCASE 6: CEO dashboard unified view');
const final = ceo.dashboard([{ divisionId: 'div-a', riskScore: 0.1 }]);
check('dashboard has objective/plans counts', () =>
  assert.ok(typeof final.objectives === 'number' && typeof final.plans === 'number')
);
check('dashboard has a posture', () => assert.ok(['GREEN', 'AMBER', 'RED'].includes(final.posture)));

/* Persistence ----------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const ceo2 = new CEOControlPanel({ dataDir: DATA_DIR });
check('objectives persisted across restart', () => assert.ok(ceo2.objectives.all().length >= 1));
check('plans persisted across restart', () => assert.ok(ceo2.planning.all().length >= 1));
check('monitoring persisted across restart', () => assert.ok(ceo2.monitoring.all().length >= 1));
check('kill switch persisted as cleared across restart', () =>
  assert.strictEqual(ceo2.killSwitch.isTripped(), false)
);

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
