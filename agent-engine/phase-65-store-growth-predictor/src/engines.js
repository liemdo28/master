/**
 * engines.js — Phase 65 Store Growth Predictor building blocks.
 *
 *   • GrowthForecastEngine — least-squares linear trend over a store's monthly
 *     revenue history, projected forward N months, with a normalized growth rate
 *     and a GROWING / FLAT / DECLINING classification.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class GrowthForecastEngine {
  /** @param {object} p { history: number[], months: number } */
  forecast({ history, months = 3 }) {
    const n = history.length;
    let slope = 0;
    let intercept = n ? history[n - 1] : 0;
    if (n >= 2) {
      const xs = history.map((_, i) => i);
      const meanX = xs.reduce((s, x) => s + x, 0) / n;
      const meanY = history.reduce((s, y) => s + y, 0) / n;
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (history[i] - meanY); den += (xs[i] - meanX) ** 2; }
      slope = den === 0 ? 0 : num / den;
      intercept = meanY - slope * meanX;
    }
    const projection = [];
    for (let i = 0; i < months; i++) projection.push(round2(Math.max(0, intercept + slope * (n + i))));
    const meanY = n ? history.reduce((s, y) => s + y, 0) / n : 0;
    const growthRate = meanY !== 0 ? round2((slope / meanY) * 100) : 0; // % of mean per month
    const classification = growthRate > 2 ? 'GROWING' : growthRate < -2 ? 'DECLINING' : 'FLAT';
    return { slope: round2(slope), projection, growthRate, classification };
  }
}
