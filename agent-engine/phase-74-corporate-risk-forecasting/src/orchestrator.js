/**
 * orchestrator.js — Phase 74 Corporate Risk Forecasting OS.
 *
 * From a risk register (probability/impact/trend per risk) it computes current
 * exposure, projects next-period exposure by trend, derives an overall posture,
 * persists a snapshot, and exposes a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { RiskRegisterEngine, RiskForecastEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CorporateRiskForecastingOS {
  constructor(opts = {}) {
    this.register = new RiskRegisterEngine();
    this.forecast = new RiskForecastEngine();
    this.snapshots = new JsonStore('ph74-snap', opts);
  }

  /** @param {object} input { risks: [{ name, category, probability, impact, trend }] } */
  analyze(input) {
    const risks = input.risks || [];
    const current = this.register.assess(risks);
    const projected = this.forecast.project(risks);
    const rising = projected.projectedTotalExposure > current.totalExposure;

    let posture = 'STABLE';
    if (current.criticalCount > 0) posture = 'CRITICAL';
    else if (current.highCount > 0 || rising) posture = 'ELEVATED';

    const snapshot = { id: makeId('RSK'), timestamp: Date.now(), current, projected, rising, posture };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 74, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 74,
      status: snap.posture,
      snapshots: this.snapshots.all().length,
      totalExposure: snap.current.totalExposure,
      projectedExposure: snap.projected.projectedTotalExposure,
      rising: snap.rising,
      topRisk: snap.current.topRisk,
      criticalCount: snap.current.criticalCount,
    };
  }
}

export class CorporateRiskForecastingOSOrchestrator { constructor(opts = {}) { this.os = new CorporateRiskForecastingOS(opts); } analyze(i) { return this.os.analyze(i); } dashboard() { return this.os.dashboard(); } }
export default CorporateRiskForecastingOSOrchestrator;
