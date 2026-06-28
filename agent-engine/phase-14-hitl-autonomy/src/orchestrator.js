/**
 * orchestrator.js — Phase 14 Human-in-the-Loop Autonomy orchestrator.
 *
 * The single entry point: propose(action) routes a proposed action through the
 * risk/policy gate. The orchestrator never executes the side-effect itself; it
 * only models the gate, inbox, rollback-plan requirement, and audit trail so
 * that downstream safe-execution (Phase 15) has a fully audited decision to act on.
 */
import { ApprovalPolicy, RISK_TIERS } from './policy.js';
import {
  ActionDraftEngine,
  ApprovalInbox,
  RejectionLearning,
  RollbackPlanEngine,
  AuditTrail,
} from './engines.js';

export class HITLAutonomy {
  constructor(opts = {}) {
    this.policy = new ApprovalPolicy(opts);
    this.drafts = new ActionDraftEngine(opts);
    this.inbox = new ApprovalInbox(opts);
    this.rejections = new RejectionLearning(opts);
    this.rollback = new RollbackPlanEngine(opts);
    this.audit = new AuditTrail(opts);
  }

  /**
   * Propose an action. Returns the gate decision + the inbox item (if any).
   * @param {object} action { id?, type, summary, meta, proposedBy, source }
   */
  propose(action) {
    const draft = this.drafts.draft(action);
    this.audit.append({ draftId: draft.id, event: 'drafted', detail: { type: draft.type } });

    const policyResult = this.policy.evaluate({ ...action, id: draft.id }, this.rejections);
    this.audit.append({
      draftId: draft.id,
      event: 'gated',
      detail: { tier: policyResult.tierLabel, gate: policyResult.gate, why: policyResult.why },
    });

    if (policyResult.gate === 'auto') {
      this.drafts.setStatus(draft.id, 'applied', { gate: 'auto' });
      this.audit.append({ draftId: draft.id, event: 'applied', detail: { gate: 'auto' } });
      return { draft, policy: policyResult, inboxItem: null, autoApplied: true };
    }

    // approval required
    let rollbackPlan = null;
    if (policyResult.requiresRollbackPlan) {
      rollbackPlan = this.rollback.planFor(policyResult, action);
      this.audit.append({ draftId: draft.id, event: 'rollback-plan-required', detail: { planId: rollbackPlan.id } });
    }

    const inboxItem = this.inbox.enqueue({
      draftId: draft.id,
      gate: policyResult.gate,
      tier: policyResult.tier,
      requiresRollbackPlan: policyResult.requiresRollbackPlan,
      why: policyResult.why,
      summary: draft.summary,
    });

    this.audit.append({ draftId: draft.id, event: 'enqueued', detail: { approvalId: inboxItem.id } });

    return { draft, policy: policyResult, inboxItem, rollbackPlan, autoApplied: false };
  }

  /** Human approves a pending inbox item. */
  approve(approvalId, { approver, reason } = {}) {
    const item = this.inbox.decide(approvalId, 'approved', { approver, reason });
    if (!item) return null;

    // SEVERE: require a rollback plan before we mark applied.
    let rollbackPlan = null;
    if (item.requiresRollbackPlan) {
      const policyResult = {
        actionId: item.draftId,
        tier: item.tier,
        why: item.why || 'severe operation', // real risk reason captured at enqueue
        requiresRollbackPlan: true, // planFor gates on this flag
      };
      rollbackPlan = this.rollback.planFor(policyResult, {});
    }



    this.drafts.setStatus(item.draftId, 'approved-for-execution', { rollbackPlanId: rollbackPlan?.id || null });
    this.audit.append({
      draftId: item.draftId,
      event: 'approved',
      detail: { approver: item.decidedBy, reason: item.reason, rollbackPlanId: rollbackPlan?.id || null },
    });
    return { item, rollbackPlan };
  }

  /** Human rejects a pending inbox item -> rejection learning + suppression. */
  reject(approvalId, { approver, reason } = {}) {
    const item = this.inbox.decide(approvalId, 'rejected', { approver, reason });
    if (!item) return null;
    const draft = this.drafts.get(item.draftId);
    this.rejections.record({
      draftId: item.draftId,
      actionType: draft?.type,
      tier: item.tier,
      reason: reason || item.reason,
    });
    this.drafts.setStatus(item.draftId, 'suppressed', { reason });
    this.audit.append({ draftId: item.draftId, event: 'rejected', detail: { approver: item.decidedBy, reason } });
    return { item };
  }

  pending() {
    return this.inbox.pending();
  }
}

export default HITLAutonomy;
export { RISK_TIERS };
