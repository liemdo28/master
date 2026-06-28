/**
 * engines.js — Phase 62 Market Intelligence building blocks.
 *
 *   • DemandTrendEngine    — least-squares slope over a demand history series,
 *                            classified up / flat / down with a normalized rate.
 *   • OpportunityEngine    — 0–100 opportunity score blending demand trend,
 *                            market growth, and the competitor gap.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export class DemandTrendEngine {
  /** @param {number[]} history @returns {object} { slope, trend, normRate } */
  analyze(history) {
    const n = history.length;
    if (n < 2) return { slope: 0, trend: 'flat', normRate: 0 };
    const xs = history.map((_, i) => i);
    const meanX = xs.reduce((s, x) => s + x, 0) / n;
    const meanY = history.reduce((s, y) => s + y, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (history[i] - meanY); den += (xs[i] - meanX) ** 2; }
    const slope = den === 0 ? 0 : num / den;
    const normRate = meanY !== 0 ? round2((slope / meanY) * 100) : 0; // % of mean per period
    return { slope: round2(slope), trend: slope > 0 ? 'up' : slope < 0 ? 'down' : 'flat', normRate };
  }
}

export class OpportunityEngine {
  /**
   * @param {object} p {
   *   demandTrendRate (% per period), marketGrowth (% YoY), competitorGap (0..1; share we don't hold)
   * }
   * @returns {object} { score (0..100), band }
   */
  score({ demandTrendRate = 0, marketGrowth = 0, competitorGap = 0 }) {
    // Normalize each driver to 0..100 then weight.
    const demandPart = clamp(50 + demandTrendRate * 5, 0, 100);   // +10%/period -> 100
    const growthPart = clamp(marketGrowth * 5, 0, 100);           // 20% YoY -> 100
    const gapPart = clamp(competitorGap * 100, 0, 100);           // gap fraction -> %
    const raw = demandPart * 0.4 + growthPart * 0.35 + gapPart * 0.25;
    const score = round2(clamp(raw, 0, 100));
    const band = score >= 66 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';
    return { score, band };
  }
}
