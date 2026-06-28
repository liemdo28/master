/**
 * engines.js — Phase 74 Corporate Risk Forecasting building blocks.
 *
 *   • RiskRegisterEngine — exposure = probability × impact per risk, with a
 *                          severity band, plus a portfolio rollup (total/max/top).
 *   • RiskForecastEngine — projects each risk's probability forward by its trend
 *                          (up/flat/down) and recomputes projected exposure.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const band = (exposure) =>
  exposure >= 60 ? 'CRITICAL' : exposure >= 30 ? 'HIGH' : exposure >= 15 ? 'MEDIUM' : 'LOW';

export class RiskRegisterEngine {
  /** @param {Array<{name,category,probability,impact}>} risks */
  assess(risks) {
    const rows = risks.map((r) => {
      const exposure = round2(clamp(r.probability, 0, 1) * clamp(r.impact, 0, 100));
      return { name: r.name, category: r.category, probability: r.probability, impact: r.impact, exposure, severity: band(exposure) };
    });
    const totalExposure = round2(rows.reduce((s, x) => s + x.exposure, 0));
    const sorted = [...rows].sort((a, b) => b.exposure - a.exposure);
    return {
      rows,
      totalExposure,
      maxExposure: sorted.length ? sorted[0].exposure : 0,
      topRisk: sorted.length ? sorted[0].name : null,
      criticalCount: rows.filter((r) => r.severity === 'CRITICAL').length,
      highCount: rows.filter((r) => r.severity === 'HIGH').length,
    };
  }
}

export class RiskForecastEngine {
  /**
   * @param {Array<{name,category,probability,impact,trend}>} risks  trend: up|flat|down
   * @returns {object} projected next-period probabilities + exposures
   */
  project(risks) {
    const factor = { up: 1.2, flat: 1, down: 0.8 };
    const rows = risks.map((r) => {
      const p = round2(clamp(r.probability * (factor[r.trend] ?? 1), 0, 1));
      const exposure = round2(p * clamp(r.impact, 0, 100));
      return { name: r.name, projectedProbability: p, projectedExposure: exposure, severity: band(exposure) };
    });
    return { rows, projectedTotalExposure: round2(rows.reduce((s, x) => s + x.projectedExposure, 0)) };
  }
}
