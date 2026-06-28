/**
 * orchestrator.js — Phase 54 Vendor Intelligence OS.
 *
 * assess({ vendors }) scores each vendor (on-time/quality/price/reliability),
 * ranks them, assigns tiers, persists a snapshot, and exposes a dashboard.
 * Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { VendorScorecardEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class VendorIntelligenceOS {
  constructor(opts = {}) {
    this.engine = new VendorScorecardEngine();
    this.snapshots = new JsonStore('ph54-snap', opts);
  }

  /** @param {object} input { vendors: [{ name, onTimeRate, qualityRate, priceIndex, reliabilityRate }] } */
  assess(input) {
    const vendors = (input.vendors || [])
      .map((v) => ({ name: v.name, ...this.engine.score(v) }))
      .sort((a, b) => b.score - a.score);
    const preferred = vendors.filter((v) => v.tier === 'PREFERRED').length;
    const probation = vendors.filter((v) => v.tier === 'PROBATION').length;
    const snapshot = { id: makeId('VEN'), timestamp: Date.now(), vendors, count: vendors.length, preferred, probation, topVendor: vendors[0]?.name ?? null };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 54, status: 'NO_DATA', snapshots: 0 };
    const status = snap.probation > 0 ? 'WATCH' : snap.count ? 'HEALTHY' : 'NO_DATA';
    return { phase: 54, status, snapshots: this.snapshots.all().length, vendors: snap.count, preferred: snap.preferred, probation: snap.probation, topVendor: snap.topVendor };
  }
}

export class VendorIntelligenceOSOrchestrator { constructor(opts = {}) { this.os = new VendorIntelligenceOS(opts); } assess(i) { return this.os.assess(i); } dashboard() { return this.os.dashboard(); } }
export default VendorIntelligenceOSOrchestrator;
