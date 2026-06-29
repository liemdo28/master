/**
 * engines.js — Phase 82 Self-Healing Projects building blocks.
 *
 *   • ProjectRecoveryEngine — for a project issue (blocked / overdue / at-risk),
 *     decides auto-reschedule (when slack exists, an owner is assigned, and it is
 *     not critical) vs escalate.
 *
 * Pure arithmetic, no LLM. Deterministic and unit-testable.
 */
export class ProjectRecoveryEngine {
  /**
   * @param {object} p { status: 'on-track'|'at-risk'|'blocked'|'overdue', slackDays, severity: 'low'|'high'|'critical', hasOwner }
   */
  decide(p) {
    if (p.status === 'on-track') return { action: 'none', requiresApproval: false };
    const reschedulable = p.status !== 'on-track' && p.slackDays > 0 && p.severity !== 'critical' && !!p.hasOwner;
    if (reschedulable) return { action: 'auto-reschedule', requiresApproval: false, absorbDays: Math.min(p.slackDays, 5) };
    return {
      action: 'escalate',
      requiresApproval: true,
      reason: p.severity === 'critical' ? 'critical project risk' : p.slackDays <= 0 ? 'no schedule slack' : 'no owner assigned',
    };
  }
}
