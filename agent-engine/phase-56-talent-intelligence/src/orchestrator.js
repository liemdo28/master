/**
 * orchestrator.js — Phase 56 Talent Intelligence OS.
 *
 * From one assess({ people }) call it computes per-person utilization and
 * retention risk, rolls them up to a team view, persists a snapshot, and exposes
 * a dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { CapacityEngine, RetentionRiskEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

const round2 = (n) => Number(n.toFixed(2));

export class TalentIntelligenceOS {
  constructor(opts = {}) {
    this.capacity = new CapacityEngine();
    this.retention = new RetentionRiskEngine();
    this.snapshots = new JsonStore('ph56-snap', opts);
  }

  /** @param {object} input { people: [{ id?, name, role, performance, capacityHrs, allocatedHrs, tenureMonths, lastReviewDays }] } */
  assess(input) {
    const people = (input.people || []).map((p) => {
      const cap = this.capacity.utilization(p);
      const risk = this.retention.score(p);
      return { name: p.name, role: p.role, ...cap, retention: risk };
    });

    const headcount = people.length;
    const overloaded = people.filter((p) => p.status === 'OVERLOADED').length;
    const underutilized = people.filter((p) => p.status === 'UNDERUTILIZED').length;
    const atRisk = people.filter((p) => p.retention.band !== 'LOW').length;
    const highRisk = people.filter((p) => p.retention.band === 'HIGH').length;
    const avgUtilization = headcount ? round2(people.reduce((s, p) => s + p.utilization, 0) / headcount) : 0;

    const status = highRisk > 0 || overloaded > headcount / 2 ? 'CRITICAL' : atRisk > 0 || overloaded > 0 ? 'WATCH' : 'HEALTHY';

    const snapshot = { id: makeId('TAL'), timestamp: Date.now(), people, headcount, overloaded, underutilized, atRisk, highRisk, avgUtilization, status };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 56, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 56,
      status: snap.status,
      snapshots: this.snapshots.all().length,
      headcount: snap.headcount,
      overloaded: snap.overloaded,
      underutilized: snap.underutilized,
      atRisk: snap.atRisk,
      highRisk: snap.highRisk,
      avgUtilization: snap.avgUtilization,
    };
  }
}

export class TalentIntelligenceOSOrchestrator { constructor(opts = {}) { this.os = new TalentIntelligenceOS(opts); } assess(i) { return this.os.assess(i); } dashboard() { return this.os.dashboard(); } }
export default TalentIntelligenceOSOrchestrator;
