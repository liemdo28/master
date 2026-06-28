/**
 * orchestrator.js — Phase 60 Organizational Health OS.
 *
 * Computes a weighted org-health index from team / project / finance / ops
 * domain scores, flags the weakest domain, persists a snapshot, and exposes a
 * dashboard. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { HealthIndexEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class OrganizationalHealthOS {
  constructor(opts = {}) {
    this.engine = new HealthIndexEngine();
    this.snapshots = new JsonStore('ph60-snap', opts);
  }

  /** @param {object} input { team, project, finance, ops, weights? } */
  assess(input) {
    const result = this.engine.compute(
      { team: input.team, project: input.project, finance: input.finance, ops: input.ops },
      input.weights,
    );
    const warnings = [];
    if (result.band !== 'HEALTHY') warnings.push(`Org health is ${result.band} (index ${result.index}).`);
    if (result.weakest) warnings.push(`Weakest domain: ${result.weakest}.`);
    const snapshot = { id: makeId('ORG'), timestamp: Date.now(), ...result, warnings };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 60, status: 'NO_DATA', snapshots: 0 };
    return {
      phase: 60,
      status: snap.band,
      snapshots: this.snapshots.all().length,
      index: snap.index,
      weakest: snap.weakest,
      warnings: snap.warnings,
    };
  }
}

export class OrganizationalHealthOSOrchestrator { constructor(opts = {}) { this.os = new OrganizationalHealthOS(opts); } assess(i) { return this.os.assess(i); } dashboard() { return this.os.dashboard(); } }
export default OrganizationalHealthOSOrchestrator;
