/**
 * runtime-proof.mjs — Phase 53 CFO AI Runtime Proof.
 *
 * Exercises revenue forecasting (least-squares), cash-flow projection + runway,
 * budget variance, best/base/worst scenarios, the CFO question engine, the
 * end-to-end analyze()/dashboard()/ask() facade, and persistence. Deterministic
 * arithmetic with hand-computed expected values. Isolated temp data dir.
 */
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert';
import CFOAI from '../src/orchestrator.js';
import { CashFlowEngine, BudgetVarianceEngine, ScenarioEngine } from '../src/engines.js';

const DATA_DIR = mkdtempSync(join(tmpdir(), 'mi-phase53-'));
const cfo = new CFOAI({ dataDir: DATA_DIR });

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
console.log('  PHASE 53 — CFO AI :: RUNTIME PROOF');
console.log(`  data dir: ${DATA_DIR}`);
console.log('═══════════════════════════════════════════════════════════════\n');

/* CASE 1: revenue forecast (perfect linear trend) ----------------- */
console.log('CASE 1: revenue forecast (least-squares linear trend)');
const fc = cfo.revenue.forecast({ history: [1000, 1100, 1200, 1300], months: 3 });
check('slope = 100/mo', () => assert.strictEqual(fc.slope, 100));
check('intercept = 1000', () => assert.strictEqual(fc.intercept, 1000));
check('trend = up', () => assert.strictEqual(fc.trend, 'up'));
check('next month projected = 1400', () => assert.strictEqual(fc.projection[0], 1400));
check('3rd projected month = 1600', () => assert.strictEqual(fc.projection[2], 1600));

/* CASE 2: cash flow — insolvency + runway ------------------------- */
console.log('\nCASE 2: cash-flow projection — insolvency + runway');
const cfEngine = new CashFlowEngine();
const broke = cfEngine.project({ openingCash: 5000, revenueForecast: [0, 0, 0, 0], fixedMonthlyCost: 2000, variableCostRate: 0 });
check('insolvent (not solvent)', () => assert.strictEqual(broke.solvent, false));
check('cash goes negative in month 3', () => assert.strictEqual(broke.firstNegativeMonth, 3));
check('runway = 2 months', () => assert.strictEqual(broke.runwayMonths, 2));
check('lowest cash = -3000', () => assert.strictEqual(broke.lowestCash, -3000));

/* CASE 3: cash flow — solvent with variable costs ----------------- */
console.log('\nCASE 3: cash-flow projection — solvent (with variable costs)');
const ok = cfEngine.project({ openingCash: 10000, revenueForecast: [4000, 4000, 4000], fixedMonthlyCost: 2000, variableCostRate: 0.25 });
check('net = 1000/mo (4000 − 2000 − 1000)', () => assert.strictEqual(ok.rows[0].net, 1000));
check('ending cash = 13000', () => assert.strictEqual(ok.endingCash, 13000));
check('solvent', () => assert.strictEqual(ok.solvent, true));

/* CASE 4: budget variance ----------------------------------------- */
console.log('\nCASE 4: budget variance analysis');
const bv = new BudgetVarianceEngine().analyze({
  items: [
    { category: 'rent', budget: 2000, actual: 2000 },
    { category: 'marketing', budget: 1000, actual: 1500 },
    { category: 'food_cost', budget: 3000, actual: 2700 },
  ],
});
check('2 lines flagged (>=10% off)', () => assert.strictEqual(bv.flaggedCount, 2));
check('rent on track (not flagged)', () => assert.strictEqual(bv.items.find((i) => i.category === 'rent').flagged, false));
check('marketing +50% over', () => {
  const m = bv.items.find((i) => i.category === 'marketing');
  assert.strictEqual(m.pct, 50);
  assert.strictEqual(m.direction, 'over');
});
check('total variance = +200', () => assert.strictEqual(bv.totalVariance, 200));

/* CASE 5: scenarios (best/base/worst) ----------------------------- */
console.log('\nCASE 5: best/base/worst scenarios');
const sc = new ScenarioEngine().run({
  baseForecast: [4000, 4000, 4000],
  openingCash: 3000,
  fixedMonthlyCost: 2000,
  variableCostRate: 0.25,
  growth: { best: 0.25, base: 0, worst: -0.9 },
});
check('three scenarios produced', () => assert.strictEqual(sc.scenarios.length, 3));
check('best ending cash = 8250', () => assert.strictEqual(sc.scenarios.find((s) => s.name === 'best').endingCash, 8250));
check('worst is insolvent', () => assert.strictEqual(sc.scenarios.find((s) => s.name === 'worst').solvent, false));
check('not all scenarios solvent', () => assert.strictEqual(sc.allSolvent, false));
check('spread best→worst = 10350', () => assert.strictEqual(sc.spread, 10350));

/* CASE 6: end-to-end analyze + dashboard + ask -------------------- */
console.log('\nCASE 6: end-to-end CFOAI.analyze() + dashboard() + ask()');
const snap = cfo.analyze({
  history: [3000, 3200, 3400, 3600],
  months: 3,
  openingCash: 5000,
  fixedMonthlyCost: 4000,
  variableCostRate: 0.2,
  budgetItems: [
    { category: 'rent', budget: 2000, actual: 2200 },
    { category: 'labor', budget: 5000, actual: 5000 },
  ],
  growth: { best: 0.1, base: 0, worst: -0.2 },
});
check('snapshot has forecast/cashFlow/scenarios', () =>
  assert.ok(snap.forecast && snap.cashFlow && snap.scenarios)
);
check('forecast trend = up (revenue growing)', () => assert.strictEqual(snap.forecast.trend, 'up'));
check('next month revenue = 3800', () => assert.strictEqual(snap.forecast.projection[0], 3800));
const dash = cfo.dashboard();
check('dashboard status is HEALTHY/WATCH/CRITICAL', () => assert.ok(['HEALTHY', 'WATCH', 'CRITICAL'].includes(dash.status)));
check('dashboard exposes runway + solvency', () =>
  assert.ok(typeof dash.runwayMonths === 'number' && typeof dash.solvent === 'boolean')
);
const aRunway = cfo.ask('what is our cash runway?');
check('ask(runway) answers from cash-flow projection', () => assert.strictEqual(aRunway.basis, 'cash-flow projection'));
const aRev = cfo.ask('how is revenue forecast trending?');
check('ask(revenue) cites the forecast and trend', () => assert.ok(/up/.test(aRev.answer)));
check('answers never fabricate metrics', () => assert.strictEqual(aRunway.noFakeMetrics, true));

/* PERSISTENCE ----------------------------------------------------- */
console.log('\nPERSISTENCE: re-instantiating from disk...');
const cfo2 = new CFOAI({ dataDir: DATA_DIR });
check('snapshots persisted across restart', () => assert.ok(cfo2.snapshots.all().length >= 1));
check('forecasts persisted across restart', () => assert.ok(cfo2.revenue.all().length >= 1));
check('dashboard works after restart', () => assert.ok(['HEALTHY', 'WATCH', 'CRITICAL'].includes(cfo2.dashboard().status)));

/* RESULT ---------------------------------------------------------- */
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');
process.exit(failed === 0 ? 0 : 1);
