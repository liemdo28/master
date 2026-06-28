/**
 * engines.js — Phase 54 Vendor Intelligence building blocks.
 *
 *   • VendorScorecardEngine — weighted 0–100 composite from on-time delivery,
 *     quality, price competitiveness, and reliability, mapped to a vendor tier.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const WEIGHTS = { onTime: 0.3, quality: 0.3, price: 0.2, reliability: 0.2 };

export class VendorScorecardEngine {
  /**
   * @param {object} v {
   *   onTimeRate (0..1), qualityRate (0..1),
   *   priceIndex (1 = at market, <1 cheaper, >1 dearer), reliabilityRate (0..1)
   * }
   * @returns {object} { score (0..100), tier, breakdown }
   */
  score(v) {
    // Price competitiveness: index 0.8 -> 100, 1.0 -> 80, 1.2 -> 60 (linear, clamped).
    const pricePart = clamp(100 - (v.priceIndex - 0.8) * 100, 0, 100);
    const breakdown = {
      onTime: round2(clamp(v.onTimeRate, 0, 1) * 100),
      quality: round2(clamp(v.qualityRate, 0, 1) * 100),
      price: round2(pricePart),
      reliability: round2(clamp(v.reliabilityRate, 0, 1) * 100),
    };
    const score = round2(
      breakdown.onTime * WEIGHTS.onTime +
      breakdown.quality * WEIGHTS.quality +
      breakdown.price * WEIGHTS.price +
      breakdown.reliability * WEIGHTS.reliability,
    );
    const tier = score >= 80 ? 'PREFERRED' : score >= 60 ? 'APPROVED' : score >= 40 ? 'WATCH' : 'PROBATION';
    return { score, tier, breakdown };
  }
}
