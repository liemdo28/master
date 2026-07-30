/**
 * orchestrator.js — Phase 98 Black Swan Detection OS.
 *
 * scan({ series, threshold }) runs z-score anomaly detection over a metric
 * series, flags tail events, derives a posture, persists a snapshot, and exposes
 * a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { AnomalyEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class BlackSwanDetectionOS {
  constructor(opts = {}) {
    this.engine = new AnomalyEngine();
    this.snapshots = new JsonStore('ph98-snap', opts);
  }

  /** @param {object} input { series: number[], threshold? } */
  scan(input) {
    const result = this.engine.scan(input.series || [], input.threshold ?? 3);
    const snapshot = { id: makeId('BSW'), timestamp: Date.now(), ...result };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 98, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 98,
      status: snap.posture,
      snapshots: this.snapshots.all().length,
      anomalies: snap.anomalies.length,
      maxAbsZ: snap.maxAbsZ,
    };
  }
}

export class BlackSwanDetectionOSOrchestrator { constructor(opts = {}) { this.os = new BlackSwanDetectionOS(opts); } scan(i) { return this.os.scan(i); } dashboard() { return this.os.dashboard(); } }
export default BlackSwanDetectionOSOrchestrator;
