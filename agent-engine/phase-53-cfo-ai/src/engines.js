/**
 * engines.js — Phase 53 CFO AI building blocks.
 *
 *   • RevenueForecastEngine — least-squares linear trend over historical monthly
 *                             revenue, projected forward N months.
 *   • CashFlowEngine        — month-by-month cash projection: opening + revenue
 *                             − fixed − variable; computes runway + solvency.
 *   • BudgetVarianceEngine  — actual vs budget per category, variance + flags.
 *   • ScenarioEngine        — best / base / worst by scaling the forecast and
 *                             re-running the cash projection.
 *   • CFOQuestionEngine     — deterministic answers to common CFO questions off
 *                             a computed financial context.
 *
 * Everything is pure arithmetic (no LLM). Forecasts are persisted via the
 * shared Phase 12 JsonStore so a snapshot survives restart.
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

const round2 = (n) => Number(n.toFixed(2));

/* ------------------------------------------------------------------ */
/* Revenue Forecast Engine                                             */
/* ------------------------------------------------------------------ */

export class RevenueForecastEngine {
  constructor(opts) {
    this.store = new JsonStore('cfo-forecast', opts);
  }

  /**
   * @param {object} p { history: number[], months: number }
   * Least-squares fit y = intercept + slope*x over x = 0..n-1, then project
   * x = n..n+months-1. Falls back to flat (last value) when history < 2 points.
   */
  forecast({ history, months }) {
    const n = history.length;
    let slope = 0;
    let intercept = n ? history[n - 1] : 0;

    if (n >= 2) {
      const xs = history.map((_, i) => i);
      const meanX = xs.reduce((s, x) => s + x, 0) / n;
      const meanY = history.reduce((s, y) => s + y, 0) / n;
      let num = 0;
      let den = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (history[i] - meanY);
        den += (xs[i] - meanX) ** 2;
      }
      slope = den === 0 ? 0 : num / den;
      intercept = meanY - slope * meanX;
    }

    const projection = [];
    for (let i = 0; i < months; i++) {
      const x = n + i;
      projection.push(round2(Math.max(0, intercept + slope * x)));
    }

    const rec = {
      id: makeId('FCAST'),
      timestamp: Date.now(),
      history,
      months,
      slope: round2(slope),
      intercept: round2(intercept),
      trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat',
      projection,
    };
    this.store.insert(rec);
    return rec;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Cash Flow Engine                                                    */
/* ------------------------------------------------------------------ */

export class CashFlowEngine {
  /**
   * @param {object} p {
   *   openingCash, revenueForecast: number[], fixedMonthlyCost, variableCostRate (0..1)
   * }
   */
  project({ openingCash, revenueForecast, fixedMonthlyCost, variableCostRate = 0 }) {
    const rows = [];
    let cash = openingCash;
    let lowestCash = openingCash;
    let firstNegativeMonth = null;

    revenueForecast.forEach((revenue, idx) => {
      const variableCost = round2(revenue * variableCostRate);
      const net = round2(revenue - fixedMonthlyCost - variableCost);
      cash = round2(cash + net);
      if (cash < lowestCash) lowestCash = cash;
      if (cash < 0 && firstNegativeMonth === null) firstNegativeMonth = idx + 1; // 1-based month
      rows.push({ month: idx + 1, revenue, fixedCost: fixedMonthlyCost, variableCost, net, endingCash: cash });
    });

    return {
      openingCash,
      rows,
      endingCash: cash,
      lowestCash,
      firstNegativeMonth,
      runwayMonths: firstNegativeMonth === null ? revenueForecast.length : firstNegativeMonth - 1,
      solvent: firstNegativeMonth === null,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Budget Variance Engine                                              */
/* ------------------------------------------------------------------ */

export class BudgetVarianceEngine {
  /**
   * @param {object} p { items: [{ category, budget, actual }] }
   * Flags any line whose absolute variance is >= 10% of budget.
   */
  analyze({ items }) {
    const analyzed = items.map((it) => {
      const variance = round2(it.actual - it.budget);
      const pct = it.budget !== 0 ? round2((variance / it.budget) * 100) : 0;
      const flagged = Math.abs(pct) >= 10;
      return { ...it, variance, pct, flagged, direction: variance > 0 ? 'over' : variance < 0 ? 'under' : 'on_track' };
    });
    const totalBudget = round2(analyzed.reduce((s, x) => s + x.budget, 0));
    const totalActual = round2(analyzed.reduce((s, x) => s + x.actual, 0));
    return {
      items: analyzed,
      totalBudget,
      totalActual,
      totalVariance: round2(totalActual - totalBudget),
      flaggedCount: analyzed.filter((x) => x.flagged).length,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Scenario Engine                                                     */
/* ------------------------------------------------------------------ */

export class ScenarioEngine {
  constructor(cashFlow) {
    this.cashFlow = cashFlow || new CashFlowEngine();
  }

  /**
   * @param {object} p {
   *   baseForecast: number[], openingCash, fixedMonthlyCost, variableCostRate,
   *   growth: { best, base, worst }   // fractional deltas applied to each month
   * }
   */
  run({ baseForecast, openingCash, fixedMonthlyCost, variableCostRate = 0, growth }) {
    const scenarios = Object.entries(growth).map(([name, rate]) => {
      const scaled = baseForecast.map((r) => round2(r * (1 + rate)));
      const proj = this.cashFlow.project({ openingCash, revenueForecast: scaled, fixedMonthlyCost, variableCostRate });
      return { name, growthRate: rate, endingCash: proj.endingCash, lowestCash: proj.lowestCash, solvent: proj.solvent };
    });
    const ending = scenarios.map((s) => s.endingCash);
    return {
      scenarios,
      spread: round2(Math.max(...ending) - Math.min(...ending)),
      allSolvent: scenarios.every((s) => s.solvent),
    };
  }
}

/* ------------------------------------------------------------------ */
/* CFO Question Engine                                                 */
/* ------------------------------------------------------------------ */

export class CFOQuestionEngine {
  /**
   * @param {string} question
   * @param {object} ctx { forecast, cashFlow, scenarios }
   */
  answer(question, ctx) {
    const q = question.toLowerCase();
    let answer;
    let confidence = 70;
    let basis;

    if (/runway|how long|out of cash|run out/.test(q)) {
      const cf = ctx.cashFlow;
      answer = cf.solvent
        ? `Solvent across the full ${cf.rows.length}-month horizon; lowest projected cash is ${cf.lowestCash}.`
        : `Cash goes negative in month ${cf.firstNegativeMonth}. Runway is ${cf.runwayMonths} month(s).`;
      basis = 'cash-flow projection';
      confidence = 85;
    } else if (/solvent|safe|survive|risk/.test(q)) {
      answer = ctx.cashFlow.solvent ? 'Yes — projected solvent over the horizon.' : 'No — projected to run out of cash.';
      basis = 'cash-flow projection';
      confidence = 85;
    } else if (/revenue|forecast|next month|grow/.test(q)) {
      const f = ctx.forecast;
      answer = `Revenue trend is ${f.trend}; next month projected at ${f.projection[0]} (slope ${f.slope}/mo).`;
      basis = 'least-squares revenue forecast';
      confidence = 75;
    } else if (/scenario|worst|best|downside|upside/.test(q)) {
      const s = ctx.scenarios;
      answer = s.allSolvent
        ? `All scenarios stay solvent; ending-cash spread best→worst is ${s.spread}.`
        : `Not all scenarios are solvent; ending-cash spread best→worst is ${s.spread}.`;
      basis = 'scenario engine';
      confidence = 80;
    } else {
      answer = 'CFO AI can answer on revenue forecast, cash runway, solvency, budget variance, and scenarios. Please be more specific.';
      basis = 'none';
      confidence = 40;
    }

    return { question, answer, confidence, basis, noFakeMetrics: true };
  }
}
