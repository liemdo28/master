/**
 * orchestrator.js — Phase 55 Procurement AI OS.
 *
 * plan({ items }) runs reorder-point planning over an inventory list, producing
 * per-SKU reorder suggestions and stockout-risk flags, persists a snapshot, and
 * exposes a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { ReorderEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class ProcurementAIOS {
  constructor(opts = {}) {
    this.engine = new ReorderEngine();
    this.snapshots = new JsonStore('ph55-snap', opts);
  }

  /** @param {object} input { items: [{ sku, demandPerDay, leadTimeDays, safetyStockDays, onHand, reviewPeriodDays? }] } */
  plan(input) {
    const items = (input.items || []).map((it) => this.engine.plan(it));
    const reorderCount = items.filter((i) => i.needsReorder).length;
    const highRisk = items.filter((i) => i.stockoutRisk === 'HIGH').length;
    const snapshot = { id: makeId('PROC'), timestamp: Date.now(), items, count: items.length, reorderCount, highRisk };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 55, status: 'NO_DATA', snapshots: 0 };
    const status = snap.highRisk > 0 ? 'CRITICAL' : snap.reorderCount > 0 ? 'ACTION_NEEDED' : 'STABLE';
    return { phase: 55, status, snapshots: this.snapshots.all().length, items: snap.count, reorderCount: snap.reorderCount, highRisk: snap.highRisk };
  }
}

export class ProcurementAIOSOrchestrator { constructor(opts = {}) { this.os = new ProcurementAIOS(opts); } plan(i) { return this.os.plan(i); } dashboard() { return this.os.dashboard(); } }
export default ProcurementAIOSOrchestrator;
