/**
 * engines.js — Phase 76 Acquisition Evaluation building blocks.
 *
 *   • ValuationEngine — EBITDA-multiple valuation vs asking price, with a
 *     verdict (UNDERVALUED / FAIR / OVERVALUED) and a simple payback estimate.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class ValuationEngine {
  /**
   * @param {object} t {
   *   name, ebitda, multiple, askingPrice, annualProfit
   * }
   * @returns {object} { fairValue, askingPrice, gapPct, verdict, paybackYears }
   */
  evaluate(t) {
    const fairValue = round2(t.ebitda * t.multiple);
    const gapPct = t.askingPrice !== 0 ? round2(((fairValue - t.askingPrice) / t.askingPrice) * 100) : 0;
    const verdict = gapPct >= 10 ? 'UNDERVALUED' : gapPct <= -10 ? 'OVERVALUED' : 'FAIR';
    const paybackYears = t.annualProfit > 0 ? round2(t.askingPrice / t.annualProfit) : Infinity;
    return { name: t.name, fairValue, askingPrice: t.askingPrice, gapPct, verdict, paybackYears };
  }
}
