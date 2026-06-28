/**
 * runtime-proof.mjs — Phase 19 Executive Simulation Runtime Proof.
 *
 * Models an expansion decision: baseline / optimistic / pessimistic scenarios
 * for a 6-month revenue projection. Validates forecasting math, assumption
 * tracking, downside risk flagging, and decision ranking. Isolated temp dir.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import ExecutiveSimulation from '../src/orchestrator.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase19-'));
const sim = new ExecutiveSimulation({ dataDir: DATA_DIR });

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
console.log('  PHASE 19 — EXECUTIVE SIMULATION :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* Register assumptions -------------------------------------------- */
sim.assumptions.register({ id: 'asm-demand', name: 'Monthly demand', value: 1000, unit: 'orders', validated: true, source: 'last-6-months' });
sim.assumptions.register({ id: 'asm-churn', name: 'Customer churn', value: 0.05, unit: 'rate', validated: false, source: 'estimate' });
check('2 assumptions registered', () => assert.strictEqual(sim.assumptions.all().length, 2));

/* CASE 1: forecast math ------------------------------------------- */
console.log('\nCASE 1: forecast engine math');
const f = sim.forecast.project({ baseline: 1000, periods: 3, growthRate: 0.1 });
check('series has 3 periods', () => assert.strictEqual(f.series.length, 3));
check('first value equals baseline', () => assert.strictEqual(f.series[0], 1000));
check('second value grew 10%', () => assert.strictEqual(f.series[1], 1100));
check('total sums the series', () => assert.strictEqual(f.total, 1000 + 1100 + 1210));

/* CASE 2: scenarios ----------------------------------------------- */
console.log('\nCASE 2: define baseline / optimistic / pessimistic scenarios');
const base = sim.scenarios.define({ id: 'scn-base', name: 'Baseline', kind: 'baseline', baseline: 10000, periods: 6, growthRate: 0.03, assumptionIds: ['asm-demand'] });
const opt = sim.scenarios.define({ id: 'scn-opt', name: 'Optimistic', kind: 'optimistic', baseline: 10000, periods: 6, growthRate: 0.08, assumptionIds: ['asm-demand', 'asm-churn'] });
const pess = sim.scenarios.define({ id: 'scn-pess', name: 'Pessimistic', kind: 'pessimistic', baseline: 10000, periods: 6, growthRate: -0.15, assumptionIds: ['asm-demand'] });
check('3 scenarios defined', () => assert.strictEqual(sim.scenarios.all().length, 3));
check('optimistic total > baseline total', () => assert.ok(opt.projection.total > base.projection.total));
check('pessimistic total < baseline total', () => assert.ok(pess.projection.total < base.projection.total));

/* CASE 3: simulation risk ----------------------------------------- */
console.log('\nCASE 3: simulation risk flags downside + unvalidated assumptions');
const rOpt = sim.risk.evaluate('scn-opt');
const rPess = sim.risk.evaluate('scn-pess');
check('optimistic is at-risk (unvalidated churn assumption)', () => assert.strictEqual(rOpt.status, 'at-risk'));
check('optimistic flagged for unvalidated churn assumption', () =>
  assert.ok(rOpt.alerts.some((a) => a.key === 'unvalidated-assumptions'))
);
check('pessimistic has severe-downside alert', () =>
  assert.ok(rPess.alerts.some((a) => a.key === 'severe-downside'))
);


/* CASE 4: assumption validation flips risk ----------------------- */
console.log('\nCASE 4: validating an assumption clears its risk flag');
sim.validateAssumption('asm-churn');
const rOpt2 = sim.risk.evaluate('scn-opt');
check('after validation optimistic risk is healthy with no alerts', () =>
  assert.strictEqual(rOpt2.status, 'healthy') && assert.strictEqual(rOpt2.alerts.length, 0)
);

/* CASE 5: decision comparison ------------------------------------- */
console.log('\nCASE 5: decision comparison ranks by expected value');
const { comparison } = sim.runDecision();
check('comparison produced a ranking of 3', () => assert.strictEqual(comparison.ranking.length, 3));
check('comparison winner is the optimistic scenario (highest EV)', () =>
  assert.strictEqual(comparison.winner, 'scn-opt')
);
check('pessimistic ranked last (penalized for downside)', () =>
  assert.strictEqual(comparison.ranking[comparison.ranking.length - 1].scenarioId, 'scn-pess')
);

/* Persistence ----------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const sim2 = new ExecutiveSimulation({ dataDir: DATA_DIR });
check('assumptions persisted across restart', () => assert.strictEqual(sim2.assumptions.all().length, 2));
check('scenarios persisted across restart', () => assert.strictEqual(sim2.scenarios.all().length, 3));
check('forecasts persisted across restart', () => assert.ok(sim2.forecast.all().length >= 3));

/* Result ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
