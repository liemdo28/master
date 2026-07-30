/**
 * engines.js — Phase 55 Procurement AI building blocks.
 *
 *   • ReorderEngine — classic reorder-point planning:
 *       reorderPoint = demandPerDay × (leadTimeDays + safetyStockDays)
 *       needsReorder when onHand ≤ reorderPoint; suggests an order quantity to
 *       cover the review period + lead time, and flags stockout risk.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

export class ReorderEngine {
  /**
   * @param {object} item {
   *   sku, demandPerDay, leadTimeDays, safetyStockDays, onHand, reviewPeriodDays?
   * }
   */
  plan(item) {
    const reviewPeriodDays = item.reviewPeriodDays ?? 7;
    const reorderPoint = round2(item.demandPerDay * (item.leadTimeDays + item.safetyStockDays));
    const needsReorder = item.onHand <= reorderPoint;
    const targetLevel = round2(item.demandPerDay * (item.leadTimeDays + item.safetyStockDays + reviewPeriodDays));
    const suggestedQty = needsReorder ? round2(Math.max(0, targetLevel - item.onHand)) : 0;
    const daysOfCover = item.demandPerDay > 0 ? round2(item.onHand / item.demandPerDay) : Infinity;
    const stockoutRisk = daysOfCover < item.leadTimeDays ? 'HIGH' : daysOfCover < item.leadTimeDays + item.safetyStockDays ? 'MEDIUM' : 'LOW';
    return { sku: item.sku, reorderPoint, needsReorder, suggestedQty, daysOfCover, stockoutRisk };
  }
}
