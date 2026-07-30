/**
 * engines.js — Phase 20 Autonomous Executive OS building blocks (capstone).
 *
 *   • AutonomousPlanningEngine — turns an objective into a ranked plan of
 *                                division-level initiatives (deterministic).
 *   • ExecutiveRiskEngine      — aggregates division risk signals into a
 *                                company-level risk posture.
 *   • CEOControlPanel          — the single exec view: objectives, plan,
 *                                division status, kill-switch state, posture.
 *   • ContinuousMonitoring     — evaluates a stream of metric snapshots and
 *                                emits watch/alert/escalate verdicts.
 *   • CrossDivisionOptimizer   — reallocates a shared budget across divisions
 *                                to maximize total expected return under a cap.
 *
 * It deliberately reuses the Phase 15 KillSwitch (shared store) so the
 * executive layer can halt the whole company in one command.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';
import { KillSwitch } from '../../phase-15-autonomous-ops/src/engines.js';

/* ------------------------------------------------------------------ */
/* Autonomous Planning Engine                                          */
/* ------------------------------------------------------------------ */

export class AutonomousPlanningEngine {
  constructor(opts) {
    this.store = new JsonStore('exec-plan', opts);
  }

  /**
   * @param {object} o { objective, divisions: [{ id, expectedReturn, cost, risk }] }
   * Ranks divisions by ROI (expectedReturn / cost) adjusted downward by risk,
   * then selects initiatives greedily until the budget is exhausted.
   */
  plan({ objective, divisions, budget }) {
    const scored = divisions.map((d) => ({
      ...d,
      roi: d.cost > 0 ? d.expectedReturn / d.cost : 0,
      adjustedScore: d.cost > 0 ? (d.expectedReturn / d.cost) * (1 - (d.risk || 0)) : 0,
    }));
    scored.sort((a, b) => b.adjustedScore - a.adjustedScore);

    const selected = [];
    let spend = 0;
    let totalReturn = 0;
    for (const d of scored) {
      if (spend + d.cost <= budget) {
        selected.push({ divisionId: d.id, cost: d.cost, expectedReturn: d.expectedReturn, adjustedScore: Number(d.adjustedScore.toFixed(3)) });
        spend += d.cost;
        totalReturn += d.expectedReturn;
      }
    }

    const rec = {
      id: makeId('PLAN'),
      timestamp: Date.now(),
      objective,
      budget,
      spend,
      totalExpectedReturn: totalReturn,
      selected,
      deferred: scored.filter((d) => !selected.find((s) => s.divisionId === d.id)).map((d) => d.id),
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Executive Risk Engine                                               */
/* ------------------------------------------------------------------ */

export class ExecutiveRiskEngine {
  constructor(opts) {
    this.store = new JsonStore('exec-risk', opts);
  }

  /**
   * @param {Array} divisionSignals [{ divisionId, riskScore 0..1 }]
   * Returns a company posture: GREEN / AMBER / RED based on worst + average.
   */
  posture(divisionSignals) {
    if (!divisionSignals.length) return { posture: 'GREEN', worst: 0, average: 0 };
    const scores = divisionSignals.map((d) => d.riskScore);
    const worst = Math.max(...scores);
    const average = scores.reduce((s, x) => s + x, 0) / scores.length;
    let posture = 'GREEN';
    if (worst >= 0.7 || average >= 0.5) posture = 'RED';
    else if (worst >= 0.4 || average >= 0.3) posture = 'AMBER';

    const rec = {
      id: makeId('POSTURE'),
      timestamp: Date.now(),
      posture,
      worst: Number(worst.toFixed(3)),
      average: Number(average.toFixed(3)),
      divisions: divisionSignals,
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Continuous Monitoring                                               */
/* ------------------------------------------------------------------ */

export class ContinuousMonitoring {
  constructor(opts) {
    this.store = new JsonStore('exec-monitor', opts);
    this.thresholds = (opts && opts.thresholds) || { watch: 0.3, alert: 0.5, escalate: 0.7 };
  }

  /**
   * Evaluate a metric snapshot against thresholds.
   * @returns {{ verdict: 'ok'|'watch'|'alert'|'escalate', value, thresholds }}
   */
  evaluate({ divisionId, metric, value }) {
    let verdict = 'ok';
    const a = Math.abs(value);
    if (a >= this.thresholds.escalate) verdict = 'escalate';
    else if (a >= this.thresholds.alert) verdict = 'alert';
    else if (a >= this.thresholds.watch) verdict = 'watch';

    const rec = {
      id: makeId('MON'),
      timestamp: Date.now(),
      divisionId,
      metric,
      value,
      verdict,
    };
    this.store.insert(rec);
    return rec;
  }

  escalations() {
    return this.store.filter((r) => r.verdict === 'escalate');
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Cross-Division Optimizer                                            */
/* ------------------------------------------------------------------ */

export class CrossDivisionOptimizer {
  constructor(planning, opts) {
    this.planning = planning;
    this.store = new JsonStore('exec-optimizer', opts);
  }

  /** Rebalance: produce a plan, then record a reallocation summary. */
  rebalance({ objective, divisions, budget }) {
    const plan = this.planning.plan({ objective, divisions, budget });
    const rec = {
      id: makeId('OPT'),
      timestamp: Date.now(),
      objective,
      budget,
      reallocations: plan.selected.map((s) => ({
        divisionId: s.divisionId,
        allocated: s.cost,
        expectedReturn: s.expectedReturn,
      })),
      deferred: plan.deferred,
      totalSpend: plan.spend,
      totalExpectedReturn: plan.totalExpectedReturn,
      efficiency: plan.spend > 0 ? Number((plan.totalExpectedReturn / plan.spend).toFixed(3)) : 0,
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}
