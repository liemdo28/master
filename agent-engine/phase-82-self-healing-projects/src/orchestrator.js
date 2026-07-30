/**
 * orchestrator.js — Phase 82 Self-Healing Projects OS.
 *
 * handle({ projects }) routes each at-risk/blocked/overdue project through the
 * recovery engine: reschedulable slips auto-heal; critical/owner-less/no-slack
 * ones escalate. Tracks recovery rate. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { ProjectRecoveryEngine } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class SelfHealingProjectsOS {
  constructor(opts = {}) {
    this.engine = new ProjectRecoveryEngine();
    this.snapshots = new JsonStore('ph82-snap', opts);
  }

  /** @param {object} input { projects: [{ name, status, slackDays, severity, hasOwner }] } */
  handle(input) {
    const projects = (input.projects || []).map((p) => ({ name: p.name, status: p.status, ...this.engine.decide(p) }));
    const actionable = projects.filter((p) => p.action !== 'none');
    const autoRecovered = projects.filter((p) => p.action === 'auto-reschedule').length;
    const escalated = projects.filter((p) => p.action === 'escalate').length;
    const recoveryRate = actionable.length ? Number((autoRecovered / actionable.length).toFixed(2)) : 1;
    const snapshot = { id: makeId('PRJ'), timestamp: Date.now(), projects, total: projects.length, autoRecovered, escalated, recoveryRate };
    this.snapshots.insert(snapshot);
    return snapshot;
  }

  dashboard() {
    const snap = this.snapshots.all()[0];
    if (!snap) return { phase: 82, status: 'NO_DATA', snapshots: 0 };
    const status = snap.escalated > snap.autoRecovered ? 'DEGRADED' : snap.escalated > 0 ? 'RECOVERING' : 'STABLE';
    return { phase: 82, status, snapshots: this.snapshots.all().length, projects: snap.total, autoRecovered: snap.autoRecovered, escalated: snap.escalated, recoveryRate: snap.recoveryRate };
  }
}

export class SelfHealingProjectsOSOrchestrator { constructor(opts = {}) { this.os = new SelfHealingProjectsOS(opts); } handle(i) { return this.os.handle(i); } dashboard() { return this.os.dashboard(); } }
export default SelfHealingProjectsOSOrchestrator;
