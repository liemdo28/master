/**
 * orchestrator.js — Phase 77 Investment Evaluation OS.
 *
 * evaluate({ initial, cashflows, discountRate }) runs a DCF appraisal (NPV / ROI
 * / payback) into an INVEST / REVIEW / REJECT decision, persists a snapshot, and
 * exposes a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { NPVEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class InvestmentEvaluationOS {
  constructor(opts = {}) {
    this.engine = new NPVEngine();
    this.snapshots = new JsonStore('ph77-snap', opts);
  }

  /** @param {object} input { name?, initial, cashflows: number[], discountRate?, maxPaybackYears? } */
  evaluate(input) {
    const result = this.engine.evaluate(input);
    const snapshot = { id: makeId('INV'), timestamp: Date.now(), name: input.name ?? null, ...result };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 77, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 77,
      status: snap.decision,
      snapshots: this.snapshots.all().length,
      name: snap.name,
      npv: snap.npv,
      roi: snap.roi,
      paybackPeriod: snap.paybackPeriod,
    };
  }
}

export class InvestmentEvaluationOSOrchestrator { constructor(opts = {}) { this.os = new InvestmentEvaluationOS(opts); } evaluate(i) { return this.os.evaluate(i); } dashboard() { return this.os.dashboard(); } }
export default InvestmentEvaluationOSOrchestrator;
