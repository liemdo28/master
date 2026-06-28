/**
 * engines.js — Approval Inbox, Action Draft, Rejection Learning,
 *             Rollback Plan, and Audit Trail engines.
 *
 * These are the HITL building blocks. The orchestrator wires them with the
 * ApprovalPolicy so that a proposed action flows:
 *
 *   draft(action)
 *     -> policy.evaluate -> gate
 *        - auto          -> mark applied (no human)
 *        - approval      -> enqueue to inbox -> human decides
 *           - approved   -> require rollback plan if SEVERE -> applied
 *           - rejected   -> rejection learning records why -> suppressed
 *     -> every transition appended to the audit trail
 */
import { JsonStore, makeId } from '../../phase-12-self-improving-intelligence/src/store.js';

/* ------------------------------------------------------------------ */
/* Action Draft Engine                                                 */
/* ------------------------------------------------------------------ */

export class ActionDraftEngine {
  constructor(opts) {
    this.store = new JsonStore('action-draft', opts);
  }

  /**
   * @param {object} a { id?, type, summary, meta, proposedBy, source }
   */
  draft(a) {
    const rec = {
      id: a.id || makeId('DRAFT'),
      timestamp: Date.now(),
      type: a.type,
      summary: a.summary || '',
      meta: a.meta || {},
      proposedBy: a.proposedBy || 'system',
      source: a.source || null, // e.g. a Phase 12 recommendation id
      status: 'draft',
    };
    this.store.insert(rec);
    return rec;
  }

  setStatus(id, status, extra = {}) {
    return this.store.update(id, { status, ...extra });
  }

  get(id) {
    return this.store.find((d) => d.id === id);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Approval Inbox                                                      */
/* ------------------------------------------------------------------ */

export class ApprovalInbox {
  constructor(opts) {
    this.store = new JsonStore('approval-inbox', opts);
  }

  enqueue({ draftId, gate, tier, requiresRollbackPlan, summary, why }) {
    const rec = {
      id: makeId('APPROVAL'),
      timestamp: Date.now(),
      draftId,
      gate,
      tier,
      requiresRollbackPlan,
      why: why || null, // risk reason, needed to rebuild the rollback plan on approval
      summary,
      decision: 'pending', // pending | approved | rejected | expired
      decidedBy: null,
      decidedAt: null,
      reason: null,
    };
    this.store.insert(rec);
    return rec;
  }


  pending() {
    return this.store.filter((r) => r.decision === 'pending');
  }

  decide(id, decision, { approver, reason } = {}) {
    return this.store.update(id, {
      decision,
      decidedBy: approver || 'human',
      decidedAt: Date.now(),
      reason: reason || null,
    });
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Rejection Learning                                                  */
/* ------------------------------------------------------------------ */

export class RejectionLearning {
  constructor(opts) {
    this.store = new JsonStore('rejection-learning', opts);
  }

  record({ draftId, actionType, tier, reason }) {
    const rec = {
      id: makeId('REJ'),
      timestamp: Date.now(),
      draftId,
      actionType,
      tier,
      reason: reason || 'unspecified',
    };
    this.store.insert(rec);
    return rec;
  }

  /** Rejections for an action type within `withinMs` ms (default 7d). */
  recentForActionType(actionType, withinMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - withinMs;
    return this.store.filter((r) => r.actionType === actionType && r.timestamp >= cutoff);
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Rollback Plan Engine                                                */
/* ------------------------------------------------------------------ */

const ROLLBACK_PLAYBOOK = {
  financial_mutation: [
    { step: 'capture pre-state balance/transaction snapshot', expect: 'reversible baseline' },
    { step: 'issue offsetting reversal entry via the financial API', expect: 'net effect zero' },
    { step: 'reconcile and notify accounting', expect: 'books corrected' },
  ],
  destructive_operation: [
    { step: 'create a backup/snapshot before the operation', expect: 'recoverable copy exists' },
    { step: 'restore from the snapshot on rollback', expect: 'state restored' },
  ],
  public_facing_publish: [

    { step: 'publish to a draft/staging slot first', expect: 'not yet public' },
    { step: 'unpublish / revert to previous version on rollback', expect: 'public surface restored' },
  ],
  default: [
    { step: 'capture pre-state snapshot', expect: 'recoverable baseline' },
    { step: 'restore pre-state on rollback', expect: 'state restored' },
  ],
};

export class RollbackPlanEngine {
  constructor(opts) {
    this.store = new JsonStore('rollback-plan', opts);
  }

  /**
   * @param {object} policyResult  from ApprovalPolicy.evaluate()
   * @param {object} action        the proposed action
   */
  planFor(policyResult, action) {
    if (!policyResult.requiresRollbackPlan) return null;
    // Normalize the policy "why" reason into a playbook key:
    // spaces and hyphens -> single underscore, lowercase.
    const key = String(policyResult.why || '').replace(/[\s-]+/g, '_').toLowerCase();
    const steps = ROLLBACK_PLAYBOOK[key] || ROLLBACK_PLAYBOOK.default;

    const plan = {
      id: makeId('ROLLBACK'),
      timestamp: Date.now(),
      actionId: policyResult.actionId,
      tier: policyResult.tier,
      why: policyResult.why,
      steps: steps.map((s, i) => ({ no: i + 1, ...s })),
      status: 'ready',
    };
    this.store.insert(plan);
    return plan;
  }

  all() {
    return this.store.all();
  }
}

/* ------------------------------------------------------------------ */
/* Audit Trail                                                         */
/* ------------------------------------------------------------------ */

export class AuditTrail {
  constructor(opts) {
    this.store = new JsonStore('audit-trail', opts);
  }

  append({ draftId, event, detail }) {
    const rec = {
      id: makeId('AUDIT'),
      timestamp: Date.now(),
      draftId,
      event, // e.g. 'drafted','gated','enqueued','approved','rejected','applied','rolled-back'
      detail: detail || {},
    };
    this.store.insert(rec);
    return rec;
  }

  forDraft(draftId) {
    return this.store.filter((a) => a.draftId === draftId).reverse();
  }

  all() {
    return this.store.all();
  }
}
