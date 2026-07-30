/**
 * orchestrator.js — Phase 53 CFO AI.
 *
 * CFOAI is the single CFO entry point. From one `analyze()` call it produces a
 * full financial picture — revenue forecast, cash-flow projection + runway,
 * budget variance, and best/base/worst scenarios — persists a snapshot, and can
 * then answer CFO questions against that snapshot. Pure arithmetic, no LLM.
 */
import {
  RevenueForecastEngine,
  CashFlowEngine,
  BudgetVarianceEngine,
  ScenarioEngine,
  CFOQuestionEngine,
} from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CFOAI {
  constructor(opts = {}) {
    this.revenue = new RevenueForecastEngine(opts);
    this.cashFlow = new CashFlowEngine();
    this.budget = new BudgetVarianceEngine();
    this.scenarios = new ScenarioEngine(this.cashFlow);
    this.questions = new CFOQuestionEngine();
    this.snapshots = new JsonStore('cfo-snapshot', opts);
  }

  /**
   * End-to-end CFO analysis.
   * @param {object} input {
   *   history: number[], months: number,
   *   openingCash, fixedMonthlyCost, variableCostRate,
   *   budgetItems?: [{category, budget, actual}],
   *   growth?: { best, base, worst }
   * }
   */
  analyze(input) {
    const forecast = this.revenue.forecast({ history: input.history, months: input.months });
    const cashFlow = this.cashFlow.project({
      openingCash: input.openingCash,
      revenueForecast: forecast.projection,
      fixedMonthlyCost: input.fixedMonthlyCost,
      variableCostRate: input.variableCostRate,
    });
    const budget = input.budgetItems ? this.budget.analyze({ items: input.budgetItems }) : null;
    const scenarios = this.scenarios.run({
      baseForecast: forecast.projection,
      openingCash: input.openingCash,
      fixedMonthlyCost: input.fixedMonthlyCost,
      variableCostRate: input.variableCostRate,
      growth: input.growth || { best: 0.15, base: 0, worst: -0.15 },
    });

    const snapshot = {
      id: makeId('CFO'),
      timestamp: Date.now(),
      forecast,
      cashFlow,
      budget,
      scenarios,
      health: this._health(cashFlow, scenarios, budget),
    };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  /** Answer a CFO question against the latest snapshot. */
  ask(question) {
    const snap = this.snapshots.all()[0];
    if (!snap) return { question, answer: 'No analysis yet — run analyze() first.', confidence: 0, basis: 'none', noFakeMetrics: true };
    return this.questions.answer(question, { forecast: snap.forecast, cashFlow: snap.cashFlow, scenarios: snap.scenarios });
  }

  /** Unified CFO dashboard view from the latest snapshot. */
  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { status: 'NO_DATA', snapshots: 0 };
    return {
      status: snap.health.status,
      snapshots: this.snapshots.all().length,
      trend: snap.forecast.trend,
      nextMonthRevenue: snap.forecast.projection[0],
      endingCash: snap.cashFlow.endingCash,
      runwayMonths: snap.cashFlow.runwayMonths,
      solvent: snap.cashFlow.solvent,
      scenarioSpread: snap.scenarios.spread,
      budgetFlagged: snap.budget ? snap.budget.flaggedCount : null,
      warnings: snap.health.warnings,
    };
  }

  _health(cashFlow, scenarios, budget) {
    const warnings = [];
    if (!cashFlow.solvent) warnings.push(`Projected insolvency in month ${cashFlow.firstNegativeMonth}.`);
    if (!scenarios.allSolvent) warnings.push('At least one scenario (likely worst-case) goes insolvent.');
    if (budget && budget.flaggedCount > 0) warnings.push(`${budget.flaggedCount} budget line(s) off by >=10%.`);
    let status = 'HEALTHY';
    if (!cashFlow.solvent) status = 'CRITICAL';
    else if (!scenarios.allSolvent || (budget && budget.flaggedCount > 0)) status = 'WATCH';
    return { status, warnings };
  }
}

export default CFOAI;
