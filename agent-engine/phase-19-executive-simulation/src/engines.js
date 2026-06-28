/**
 * engines.js — Phase 19 Executive Simulation building blocks.
 *
 *   • AssumptionRegistry — named assumptions each scenario depends on (so every
 *                          forecast is auditable: which assumptions drove it).
 *   • ForecastEngine     — deterministic projection of a baseline metric over N
 *                          periods given growth/decay rates (per scenario).
 *   • ScenarioEngine     — a named what-if (baseline / optimistic / pessimistic)
 *                          that applies a set of assumption deltas + forecast.
 *   • SimulationRisk     — flags scenarios whose downside breaches a floor or
 *                          whose assumptions are unvalidated.
 *   • DecisionComparison — ranks multiple scenarios by an objective function
 *                          (e.g. expected value with a downside penalty).
 *
 * Everything is deterministic + auditable: no random numbers, no LLM guesses.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Assumption Registry                                                 */
/* ------------------------------------------------------------------ */

export class AssumptionRegistry {
  constructor(opts) {
    this.store = new JsonStore('sim-assumption', opts);
  }

  register(a) {
    const rec = {
      id: a.id || makeId('ASM'),
      name: a.name,
      value: a.value, // the assumed numeric value
      unit: a.unit || null,
      validated: a.validated === true,
      source: a.source || 'estimate',
      note: a.note || null,
    };
    this.store.insert(rec);
    return rec;
  }

  get(id) {
    return this.store.find((a) => a.id === id);
  }

  all() {
    return this.store.all();
  }

  /** A scenario's assumption set is "validated" only if every assumption is. */
  allValidated(ids) {
    if (!ids.length) return false;
    return ids.every((id) => {
      const a = this.get(id);
      return a && a.validated;
    });
  }
}

/* ------------------------------------------------------------------ */
/* Forecast Engine                                                     */
/* ------------------------------------------------------------------ */

export class ForecastEngine {
  constructor(opts) {
    this.store = new JsonStore('sim-forecast', opts);
  }

  /**
   * Project `baseline` over `periods` with a per-period growth rate.
   * @returns {{ id, baseline, periods, growthRate, series: number[], total, cagr }}
   */
  project({ baseline, periods, growthRate, assumptionIds = [] }) {
    const series = [];
    let v = baseline;
    for (let i = 0; i < periods; i++) {
      series.push(Number(v.toFixed(2)));
      v = v * (1 + growthRate);
    }
    const total = Number(series.reduce((s, x) => s + x, 0).toFixed(2));
    const cagr = periods > 0 ? Math.pow(series[series.length - 1] / baseline, 1 / periods) - 1 : 0;
    const rec = {
      id: makeId('FCST'),
      timestamp: Date.now(),
      baseline,
      periods,
      growthRate,
      assumptionIds,
      series,
      total,
      cagr: Number(cagr.toFixed(4)),
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Scenario Engine                                                     */
/* ------------------------------------------------------------------ */

export class ScenarioEngine {
  constructor(forecast, assumptions, opts) {
    this.forecast = forecast;
    this.assumptions = assumptions;
    this.store = new JsonStore('sim-scenario', opts);
  }

  /**
   * @param {object} s { id?, name, kind, baseline, periods, growthRate, assumptionIds?, floor? }
   * kind: 'baseline' | 'optimistic' | 'pessimistic'
   */
  define(s) {
    const projection = this.forecast.project({
      baseline: s.baseline,
      periods: s.periods,
      growthRate: s.growthRate,
      assumptionIds: s.assumptionIds || [],
    });
    const rec = {
      id: s.id || makeId('SCN'),
      timestamp: Date.now(),
      name: s.name,
      kind: s.kind,
      baseline: s.baseline,
      periods: s.periods,
      growthRate: s.growthRate,
      assumptionIds: s.assumptionIds || [],
      floor: typeof s.floor === 'number' ? s.floor : null,
      projection, // { series, total, cagr }
    };
    this.store.insert(rec);
    return rec;
  }

  get(id) {
    return this.store.find((s) => s.id === id);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Simulation Risk Engine                                              */
/* ------------------------------------------------------------------ */

export class SimulationRiskEngine {
  constructor(scenarios, assumptions, opts) {
    this.scenarios = scenarios;
    this.assumptions = assumptions;
    this.store = new JsonStore('sim-risk', opts);
  }

  /** Evaluate a scenario for downside + assumption risk. */
  evaluate(scenarioId) {
    const s = this.scenarios.get(scenarioId);
    if (!s) return null;
    const series = s.projection.series;
    const min = series.length ? Math.min(...series) : s.baseline;
    const alerts = [];

    if (s.floor != null && min < s.floor) {
      alerts.push({ key: 'below-floor', value: min, floor: s.floor });
    }
    if (s.kind === 'pessimistic' && min < s.baseline * 0.5) {
      alerts.push({ key: 'severe-downside', value: min, threshold: s.baseline * 0.5 });
    }
    const assumptionsValidated = this.assumptions.allValidated(s.assumptionIds);
    if (s.assumptionIds.length && !assumptionsValidated) {
      alerts.push({ key: 'unvalidated-assumptions' });
    }

    const rec = {
      id: makeId('SIMRISK'),
      timestamp: Date.now(),
      scenarioId,
      kind: s.kind,
      min,
      assumptionsValidated,
      alerts,
      status: alerts.length ? 'at-risk' : 'healthy',
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Decision Comparison Engine                                          */
/* ------------------------------------------------------------------ */

export class DecisionComparisonEngine {
  constructor(opts) {
    this.store = new JsonStore('sim-decision', opts);
  }

  /**
   * Rank scenarios by expected value with a downside penalty.
   * EV = projection.total - downsidePenalty (if a risk evaluation flagged below-floor).
   * @param {Array} scenarios  array of scenario records
   * @param {Array} risks      array of simulation-risk records (keyed by scenarioId)
   * @returns {{ id, ranking: [{scenarioId, ev, total, atRisk}], winner }}
   */
  compare(scenarios, risks, { downsidePenalty = 0.2 } = {}) {
    const riskByScenario = new Map(risks.map((r) => [r.scenarioId, r]));
    const ranking = scenarios.map((s) => {
      const risk = riskByScenario.get(s.id);
      const total = s.projection.total;
      let ev = total;
      let atRisk = false;
      if (risk && risk.status === 'at-risk') {
        atRisk = true;
        ev = total * (1 - downsidePenalty);
      }
      return { scenarioId: s.id, name: s.name, kind: s.kind, ev: Number(ev.toFixed(2)), total, atRisk };
    });
    ranking.sort((a, b) => b.ev - a.ev);

    const rec = {
      id: makeId('CMP'),
      timestamp: Date.now(),
      ranking,
      winner: ranking.length ? ranking[0].scenarioId : null,
      basis: 'expected-value minus downside penalty',
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}
