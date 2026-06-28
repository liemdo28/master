/**
 * orchestrator.js — Phase 65 Store Growth Predictor OS.
 *
 * predict({ store, history, months }) fits a revenue trend, projects forward,
 * classifies growth, persists a snapshot, and exposes a dashboard. Pure
 * arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { GrowthForecastEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class StoreGrowthPredictorOS {
  constructor(opts = {}) {
    this.engine = new GrowthForecastEngine();
    this.snapshots = new JsonStore('ph65-snap', opts);
  }

  /** @param {object} input { store, history: number[], months? } */
  predict(input) {
    const result = this.engine.forecast({ history: input.history || [], months: input.months });
    const snapshot = { id: makeId('STG'), timestamp: Date.now(), store: input.store ?? null, ...result };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 65, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 65,
      status: snap.classification,
      snapshots: this.snapshots.all().length,
      store: snap.store,
      growthRate: snap.growthRate,
      nextMonth: snap.projection[0] ?? null,
    };
  }
}

export class StoreGrowthPredictorOSOrchestrator { constructor(opts = {}) { this.os = new StoreGrowthPredictorOS(opts); } predict(i) { return this.os.predict(i); } dashboard() { return this.os.dashboard(); } }
export default StoreGrowthPredictorOSOrchestrator;
