/**
 * engines.js — Phase 81 Self-Healing Infrastructure building blocks.
 *
 *   • HealingDecisionEngine — given an incident, decides auto-heal vs escalate:
 *       auto-heal when a known remediation exists AND severity is below critical;
 *       critical incidents (or those with no known remediation) escalate and
 *       require human approval before any destructive recovery.
 *   • MTTREngine            — mean-time-to-recovery rollup over resolved incidents.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
const round2 = (n) => Number(n.toFixed(2));

const DEFAULT_MTTR_MS = { low: 1000, high: 5000, critical: 15000 };

export class HealingDecisionEngine {
  /** @param {object} incident { service, severity: low|high|critical, knownRemediation: bool } */
  decide(incident) {
    const critical = incident.severity === 'critical';
    const canAuto = !!incident.knownRemediation && !critical;
    if (canAuto) return { action: 'auto-heal', requiresApproval: false, remediation: incident.knownRemediation };
    return {
      action: 'escalate',
      requiresApproval: true,
      reason: critical ? 'critical severity requires human approval' : 'no known remediation',
    };
  }
}

export class MTTREngine {
  /** @param {Array<{mttrMs:number}>} resolved */
  rollup(resolved) {
    const n = resolved.length;
    if (!n) return { count: 0, avgMTTRms: 0 };
    return { count: n, avgMTTRms: round2(resolved.reduce((s, r) => s + r.mttrMs, 0) / n) };
  }
}

export { DEFAULT_MTTR_MS };
