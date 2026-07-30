/**
 * engines.js — Phase 77 Investment Evaluation building blocks.
 *
 *   • NPVEngine — discounted-cash-flow appraisal: NPV at a discount rate, simple
 *     ROI, and fractional payback period, yielding an INVEST / REVIEW / REJECT
 *     decision.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class NPVEngine {
  /**
   * @param {object} p { initial, cashflows: number[], discountRate (e.g. 0.1), maxPaybackYears? }
   * @returns {object} { npv, roi, paybackPeriod, decision }
   */
  evaluate({ initial, cashflows, discountRate = 0.1, maxPaybackYears = 5 }) {
    let npv = -initial;
    cashflows.forEach((cf, i) => { npv += cf / Math.pow(1 + discountRate, i + 1); });
    npv = round2(npv);

    const totalReturn = cashflows.reduce((s, x) => s + x, 0);
    const roi = initial !== 0 ? round2(((totalReturn - initial) / initial) * 100) : 0;

    // Fractional payback period.
    let cumulative = 0;
    let paybackPeriod = Infinity;
    for (let i = 0; i < cashflows.length; i++) {
      const prev = cumulative;
      cumulative += cashflows[i];
      if (cumulative >= initial) {
        const need = initial - prev;
        paybackPeriod = round2(i + need / cashflows[i]);
        break;
      }
    }

    let decision = 'REJECT';
    if (npv > 0 && paybackPeriod <= maxPaybackYears) decision = 'INVEST';
    else if (npv > 0) decision = 'REVIEW';
    return { npv, roi, paybackPeriod, decision };
  }
}
