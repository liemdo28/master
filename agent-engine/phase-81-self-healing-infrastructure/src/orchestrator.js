/**
 * orchestrator.js — Phase 81 Self-Healing Infrastructure OS.
 *
 * handle(incident) routes each incident through the healing decision engine:
 * non-critical incidents with a known remediation auto-heal (and record an MTTR);
 * critical / unremediable ones escalate for human approval. Tracks the auto-heal
 * rate and mean time to recovery. Pure arithmetic, no LLM.
 *
 * OSS: governed per mi-core/server/src/oss-runtime/oss-worker-registry.ts
 */
import { HealingDecisionEngine, MTTREngine, DEFAULT_MTTR_MS } from './engines.js';
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

export class SelfHealingInfrastructureOS {
  constructor(opts = {}) {
    this.decision = new HealingDecisionEngine();
    this.mttr = new MTTREngine();
    this.incidents = new JsonStore('ph81-inc', opts);
  }

  /** @param {object} incident { service, severity, knownRemediation, mttrMs? } */
  handle(incident) {
    const decision = this.decision.decide(incident);
    const rec = {
      id: makeId('INC'),
      timestamp: Date.now(),
      service: incident.service,
      severity: incident.severity,
      action: decision.action,
      requiresApproval: decision.requiresApproval,
      status: decision.action === 'auto-heal' ? 'resolved' : 'escalated',
      mttrMs: decision.action === 'auto-heal' ? (incident.mttrMs ?? DEFAULT_MTTR_MS[incident.severity] ?? 5000) : null,
      reason: decision.reason || null,
    };
    this.incidents.insert(rec);
    return rec;
  }

  dashboard() {
    const all = this.incidents.all();
    if (!all.length) return { phase: 81, status: 'NO_DATA', incidents: 0 };
    const autoHealed = all.filter((i) => i.action === 'auto-heal');
    const escalated = all.filter((i) => i.action === 'escalate');
    const autoHealRate = Number((autoHealed.length / all.length).toFixed(2));
    const { avgMTTRms } = this.mttr.rollup(autoHealed);
    const status = escalated.length > all.length / 2 ? 'DEGRADED' : escalated.length > 0 ? 'RECOVERING' : 'STABLE';
    return { phase: 81, status, incidents: all.length, autoHealed: autoHealed.length, escalated: escalated.length, autoHealRate, avgMTTRms };
  }
}

export class SelfHealingInfrastructureOSOrchestrator { constructor(opts = {}) { this.os = new SelfHealingInfrastructureOS(opts); } handle(i) { return this.os.handle(i); } dashboard() { return this.os.dashboard(); } }
export default SelfHealingInfrastructureOSOrchestrator;
