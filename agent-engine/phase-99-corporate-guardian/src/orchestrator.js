/**
 * orchestrator.js — Phase 99 Corporate Guardian OS.
 *
 * guard({ threats }) aggregates threats across the four protected pillars
 * (data / revenue / reputation / operations), computes per-pillar protection and
 * an overall guardian posture, persists a snapshot, and exposes a dashboard.
 * Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { GuardianEngine, PILLARS } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class CorporateGuardianOS {
  constructor(opts = {}) {
    this.engine = new GuardianEngine();
    this.snapshots = new JsonStore('ph99-snap', opts);
  }

  /** @param {object} input { threats: [{ pillar, severity }] } */
  guard(input) {
    const result = this.engine.assess(input.threats || []);
    const snapshot = { id: makeId('GRD'), timestamp: Date.now(), ...result };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 99, status: 'NO_DATA', snapshots: 0, pillars: PILLARS };
    return {
      phase: 99,
      status: snap.posture,
      snapshots: this.snapshots.all().length,
      overall: snap.overall,
      weakest: snap.weakest,
      anyCritical: snap.anyCritical,
      protection: Object.fromEntries(snap.pillars.map((p) => [p.pillar, p.protection])),
    };
  }
}

export class CorporateGuardianOSOrchestrator { constructor(opts = {}) { this.os = new CorporateGuardianOS(opts); } guard(i) { return this.os.guard(i); } dashboard() { return this.os.dashboard(); } }
export default CorporateGuardianOSOrchestrator;
