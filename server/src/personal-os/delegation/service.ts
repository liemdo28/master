import { randomUUID } from 'crypto';
import { DelegationStore } from './store';
import { evaluateDelegationEligibility, computeDecisionHash, type EligibilityContext } from './eligibility';
import { payloadHash, assertPlainPayload } from '../actions/policy';
import { ControlledActionService } from '../actions/service';
import type { ActionProposal } from '../actions/types';
import type {
  CreateDelegationInput, DelegatedAuthority, DelegatedAuthorityStatus, DelegationDecision,
} from './types';
import { DELEGATION_ALLOWED_TRANSITIONS, DELEGATION_ELIGIBLE_ACTION_TYPES } from './types';

const now = (): string => new Date().toISOString();

function assertTransition(from: DelegatedAuthorityStatus, to: DelegatedAuthorityStatus): void {
  if (!DELEGATION_ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new Error(`delegation cannot transition from ${from} to ${to}`);
  }
}

function delegationPayloadHash(input: CreateDelegationInput): string {
  return payloadHash({
    title: input.title, owner: input.owner, projectId: input.projectId,
    allowedActionTypes: [...input.allowedActionTypes].sort(),
    deniedActionTypes: [...(input.deniedActionTypes ?? [])].sort(),
    targetRestriction: input.targetRestriction,
    riskCeiling: input.riskCeiling, approvalLevelCeiling: input.approvalLevelCeiling,
    startsAt: input.startsAt, expiresAt: input.expiresAt, timezone: input.timezone,
    maxExecutions: input.maxExecutions, maxTargets: input.maxTargets ?? null,
    actionBudgets: input.actionBudgets ?? [],
  });
}

function extractTargetFacts(actionType: string, payload: Record<string, unknown>) {
  if (actionType === 'GMAIL_CREATE_DRAFT') {
    const to = Array.isArray(payload.to) ? (payload.to as string[]) : [];
    const cc = Array.isArray((payload as any).cc) ? ((payload as any).cc as string[]) : [];
    const recipients = [...to, ...cc];
    return {
      recipientCount: recipients.length,
      recipientDomains: [...new Set(recipients.map(r => String(r).split('@')[1]?.toLowerCase()).filter(Boolean))],
      attendeeCount: null as number | null,
      durationMinutes: null as number | null,
      hasRecurrence: false,
      hasBcc: Array.isArray((payload as any).bcc) && (payload as any).bcc.length > 0,
      targetsRequested: recipients.length,
    };
  }
  if (actionType === 'CALENDAR_EVENT_PROPOSAL' || actionType === 'CALENDAR_CREATE_EVENT') {
    const attendees = Array.isArray(payload.attendees) ? (payload.attendees as string[]) : [];
    const start = payload.start ? new Date(payload.start as string).getTime() : null;
    const end = payload.end ? new Date(payload.end as string).getTime() : null;
    return {
      recipientCount: attendees.length,
      recipientDomains: [...new Set(attendees.map(r => String(r).split('@')[1]?.toLowerCase()).filter(Boolean))],
      attendeeCount: attendees.length,
      durationMinutes: start != null && end != null ? Math.round((end - start) / 60000) : null,
      hasRecurrence: !!(payload as any).recurrence,
      hasBcc: false,
      targetsRequested: attendees.length,
    };
  }
  return { recipientCount: 0, recipientDomains: [], attendeeCount: null, durationMinutes: null, hasRecurrence: false, hasBcc: false, targetsRequested: 0 };
}

export class DelegationService {
  readonly store: DelegationStore;
  readonly controlledActions: ControlledActionService;

  constructor(root?: string, controlledActions?: ControlledActionService) {
    this.store = new DelegationStore(root);
    // Same personal-os.db, same governance singletons Controlled Actions itself uses —
    // never a second policy/kill-switch/budget engine.
    this.controlledActions = controlledActions ?? new ControlledActionService(root);
  }

  close(): void { this.store.close(); this.controlledActions.close(); }

  // ── Create / approve / activate ────────────────────────────────────────

  createDelegation(input: CreateDelegationInput): DelegatedAuthority {
    for (const t of input.allowedActionTypes) {
      if (!DELEGATION_ELIGIBLE_ACTION_TYPES.has(t)) {
        throw new Error(`action type "${t}" is not eligible for delegation (Phase 5I introduces no new external action type)`);
      }
    }
    if (input.targetRestriction) assertPlainPayload(input.targetRestriction as any);
    if (new Date(input.expiresAt).getTime() <= new Date(input.startsAt).getTime()) {
      throw new Error('expiresAt must be after startsAt — a delegation must always expire');
    }
    if (input.maxExecutions <= 0) throw new Error('maxExecutions must be a positive integer — no unlimited delegation');

    const id = `delegation-${randomUUID()}`;
    const activePolicySet = this.controlledActions.policyEngine.store.activePolicySet();
    const delegation: DelegatedAuthority = {
      id, delegationVersion: 1, previousVersionId: null,
      title: input.title, description: input.description, owner: input.owner, projectId: input.projectId,
      status: 'DRAFT',
      allowedActionTypes: input.allowedActionTypes, deniedActionTypes: input.deniedActionTypes ?? [],
      targetRestriction: input.targetRestriction,
      riskCeiling: input.riskCeiling, approvalLevelCeiling: input.approvalLevelCeiling,
      startsAt: input.startsAt, expiresAt: input.expiresAt, timezone: input.timezone,
      maxExecutions: input.maxExecutions, usedExecutions: 0,
      maxTargets: input.maxTargets ?? null, usedTargets: 0,
      actionBudgets: input.actionBudgets ?? [],
      sourceGoalId: input.sourceGoalId ?? null, sourcePlanId: input.sourcePlanId ?? null,
      policyVersion: activePolicySet?.version ?? null, policyHash: activePolicySet?.contentHash ?? null,
      delegationPayloadHash: delegationPayloadHash(input),
      createdAt: now(), approvedAt: null, activatedAt: null, revokedAt: null, exhaustedAt: null, expiredAt: null, pausedReason: null,
      evidenceReferences: [],
    };
    this.store.saveDelegation(delegation);
    this.store.recordEvent(id, null, 'delegation.created', `Delegation created for project "${delegation.projectId}", action types [${delegation.allowedActionTypes.join(', ')}].`, { delegationPayloadHash: delegation.delegationPayloadHash }, input.owner);
    return delegation;
  }

  submitForApproval(id: string): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'WAITING_APPROVAL');
    return this.store.updateDelegationStatus(id, d.delegationVersion, 'WAITING_APPROVAL', {});
  }

  /**
   * Strong-approves and activates a delegation. `approver` may never be a
   * system/automation identity — Mi may propose a delegation, Mi may never approve
   * its own delegation (directive §3). `strongConfirmation` must contain the exact
   * `AUTHORIZE:<delegationId>` phrase, typed deliberately — no `--yes`/`--force`
   * equivalent exists anywhere in this path.
   */
  approve(id: string, input: { approver: string; strongConfirmation: string }): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'ACTIVE');
    const approver = (input.approver || '').trim();
    if (!approver) throw new Error('approver is required');
    if (/^(mi|system|automation|delegation|ai)$/i.test(approver)) {
      throw new Error('a delegation cannot be approved by Mi or any system/automation identity — a human approver is required');
    }
    if (!input.strongConfirmation || !input.strongConfirmation.includes(`AUTHORIZE:${id}`)) {
      throw new Error(`strong approval requires deliberate confirmation containing "AUTHORIZE:${id}"`);
    }
    const approvedAt = now();
    const strongConfirmationHash = payloadHash({ approver, delegationId: id, confirmed: true });
    this.store.saveVersionSnapshot({
      delegationId: id, delegationVersion: d.delegationVersion, snapshot: d,
      delegationPayloadHash: d.delegationPayloadHash, policyVersion: d.policyVersion, policyHash: d.policyHash,
      approver, strongConfirmationHash,
    });
    const updated = this.store.updateDelegationStatus(id, d.delegationVersion, 'ACTIVE', { approvedAt, activatedAt: approvedAt });
    this.store.recordEvent(id, null, 'delegation.approved', `Strongly approved by ${approver}.`, { strongConfirmationHash }, approver);
    this.store.recordEvent(id, null, 'delegation.activated', `Delegation is now ACTIVE from ${d.startsAt} to ${d.expiresAt} (${d.timezone}).`, {}, approver);
    return updated;
  }

  pause(id: string, actor: string, reason: string): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'PAUSED');
    const updated = this.store.updateDelegationStatus(id, d.delegationVersion, 'PAUSED', { pausedReason: reason });
    this.store.recordEvent(id, null, 'delegation.paused', reason, {}, actor);
    return updated;
  }

  /** Never re-approves anything — resuming only restores the ability to be
   *  re-evaluated; every subsequent action still passes the full eligibility check. */
  resume(id: string, actor: string): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'ACTIVE');
    const updated = this.store.updateDelegationStatus(id, d.delegationVersion, 'ACTIVE', { pausedReason: null });
    this.store.recordEvent(id, null, 'delegation.resumed', 'Delegation resumed.', {}, actor);
    return updated;
  }

  /**
   * §15: if the currently active Phase 5G policy set no longer matches the exact
   * policy the delegation was strongly approved against, the delegation must not
   * silently keep operating under a policy nobody reviewed it against. This is
   * deliberately conservative — ANY policy change pauses the delegation (not just a
   * detected stricter one), since safely proving "the new policy is strictly looser"
   * in general is not decidable from a content hash alone. A human reviews and calls
   * resume() (no re-approval needed — the delegation's own declared scope is
   * unchanged) once satisfied the new policy still permits its exact scope.
   */
  private checkPolicyDrift(d: DelegatedAuthority): DelegatedAuthority {
    if (d.status !== 'ACTIVE') return d;
    const activePolicySet = this.controlledActions.policyEngine.store.activePolicySet();
    const currentHash = activePolicySet?.contentHash ?? null;
    if (d.policyHash && currentHash && d.policyHash !== currentHash) {
      const updated = this.store.updateDelegationStatus(d.id, d.delegationVersion, 'PAUSED_POLICY_CHANGED', { pausedReason: `active policy changed from ${d.policyHash.slice(0, 12)} to ${currentHash.slice(0, 12)} since this delegation was approved` });
      this.store.recordEvent(d.id, null, 'delegation.policy_changed', 'Active policy changed since approval — delegation paused pending review.', { previousPolicyHash: d.policyHash, currentPolicyHash: currentHash }, 'system');
      return updated;
    }
    return d;
  }

  revoke(id: string, actor: string, reason: string): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'REVOKED');
    const updated = this.store.updateDelegationStatus(id, d.delegationVersion, 'REVOKED', { revokedAt: now() });
    this.store.recordEvent(id, null, 'delegation.revoked', reason, {}, actor);
    return updated;
  }

  cancel(id: string, actor: string, reason: string): DelegatedAuthority {
    const d = this.get(id);
    assertTransition(d.status, 'CANCELLED');
    const updated = this.store.updateDelegationStatus(id, d.delegationVersion, 'CANCELLED', {});
    this.store.recordEvent(id, null, 'delegation.cancelled', reason, {}, actor);
    return updated;
  }

  get(id: string): DelegatedAuthority {
    this.sweepExpired();
    let d = this.store.getDelegation(id);
    if (!d) throw new Error('delegation not found');
    d = this.checkPolicyDrift(d);
    return d;
  }

  list(status?: DelegatedAuthorityStatus): DelegatedAuthority[] {
    this.sweepExpired();
    for (const d of this.store.listDelegations('ACTIVE')) this.checkPolicyDrift(d);
    return this.store.listDelegations(status);
  }

  evidence(id: string) {
    return {
      events: this.store.listEventsForDelegation(id),
      decisions: this.store.listDecisionsForDelegation(id),
    };
  }

  private sweepExpired(): void {
    const changed = this.store.sweepExpired();
    if (changed > 0) {
      // best-effort evidence for whichever rows just flipped; cheap since it's rare
      for (const d of this.store.listDelegations('EXPIRED')) {
        if (d.expiredAt && new Date(d.expiredAt).getTime() > Date.now() - 5000) {
          this.store.recordEvent(d.id, null, 'delegation.expired', `Delegation expired at ${d.expiresAt}.`, {}, 'system');
        }
      }
    }
  }

  // ── Read-only evaluation (does not authorize) ──────────────────────────

  evaluate(proposal: ActionProposal): DelegationDecision {
    this.sweepExpired();
    for (const d of this.store.listDelegations('ACTIVE')) this.checkPolicyDrift(d);
    const candidates = this.store.listDelegations('ACTIVE').filter(d => d.projectId === proposal.projectId);
    if (candidates.length === 0) {
      return this.persistDenied(proposal, null, ['no ACTIVE delegation exists for this project']);
    }
    for (const d of candidates) {
      const ctx = this.buildContext(d, proposal);
      const result = evaluateDelegationEligibility(d, proposal, ctx);
      if (result.eligible) return this.persistDecision(d, proposal, result, ctx);
    }
    // none eligible — persist the first candidate's denial reasons as representative
    const d = candidates[0];
    const ctx = this.buildContext(d, proposal);
    const result = evaluateDelegationEligibility(d, proposal, ctx);
    return this.persistDecision(d, proposal, result, ctx);
  }

  /**
   * The orchestration integration point (directive §20). Attempts to authorize
   * `proposal` under any matching ACTIVE delegation. On success, calls the existing
   * `ControlledActionService.approve()` — the same, sole, pre-existing approval
   * surface Phase 5F/5H already use — with `approver: "delegation:<id>"` so the audit
   * trail always shows exactly which delegation stood in for a fresh human click.
   * Never calls a provider directly; execution still flows through the unmodified
   * `ControlledActionService.execute()` path, which independently re-validates
   * payload/risk/budget/policy at dispatch time regardless of how approval was
   * granted. Returns false (a safe no-op) on any ineligibility — the proposal simply
   * remains WAITING_APPROVAL for a normal human approval, exactly as it would with no
   * delegation at all (directive §5: default deny is unchanged).
   */
  async tryAuthorize(proposal: ActionProposal): Promise<boolean> {
    if (proposal.status !== 'WAITING_APPROVAL') return false;
    this.sweepExpired();
    for (const d of this.store.listDelegations('ACTIVE')) this.checkPolicyDrift(d);
    const candidates = this.store.listDelegations('ACTIVE').filter(d => d.projectId === proposal.projectId);
    for (const d of candidates) {
      const ctx = this.buildContext(d, proposal);
      const result = evaluateDelegationEligibility(d, proposal, ctx);
      const decision = this.persistDecision(d, proposal, result, ctx);
      if (!result.eligible) {
        this.store.recordEvent(d.id, proposal.id, 'delegation.execution.denied', `Denied: ${result.reasons.join('; ')}`, { decisionId: decision.id }, 'system');
        continue;
      }
      const reserved = this.store.reserveQuota(d.id, d.delegationVersion, ctx.targetsRequested);
      if (!reserved) {
        // lost the race for the last slot, or a concurrent quota check moved past us
        this.store.recordEvent(d.id, proposal.id, 'delegation.execution.denied', 'DELEGATION_EXHAUSTED: quota reservation failed (concurrent race or exhausted)', { decisionId: decision.id }, 'system');
        continue;
      }
      this.store.recordQuotaUsage(d.id, proposal.id, 'EXECUTION', 1);
      if (ctx.targetsRequested > 0) this.store.recordQuotaUsage(d.id, proposal.id, 'TARGET', ctx.targetsRequested);
      this.store.recordEvent(d.id, proposal.id, 'delegation.quota.reserved', `Reserved 1 execution + ${ctx.targetsRequested} target slot(s).`, { decisionId: decision.id }, 'system');

      const refreshed = this.store.getDelegationVersion(d.id, d.delegationVersion)!;
      if (refreshed.usedExecutions >= refreshed.maxExecutions) {
        this.store.updateDelegationStatus(d.id, d.delegationVersion, 'EXHAUSTED', { exhaustedAt: now() });
        this.store.recordEvent(d.id, proposal.id, 'delegation.quota.exhausted', 'Delegation execution quota fully consumed.', {}, 'system');
      }

      const strongConfirmation = `AUTHORIZE:${d.id} CONFIRM:${proposal.id} ${decision.decisionHash.slice(0, 12)}`;
      try {
        await this.controlledActions.approve(proposal.id, { approver: `delegation:${d.id}`, source: 'delegation', strongConfirmation });
      } catch (err: any) {
        // Approval itself was refused by Phase 5F/5G (e.g. a race let a DENY-triggering
        // policy change land between our evaluation and this call) — the quota
        // reservation already made is not refunded; it is safer to under-spend a
        // delegation's budget than to retry into a state Phase 5G has since denied.
        this.store.recordEvent(d.id, proposal.id, 'delegation.execution.denied', `Approval rejected after quota reservation: ${err?.message ?? err}`, { decisionId: decision.id }, 'system');
        return false;
      }
      this.store.recordEvent(d.id, proposal.id, 'delegation.execution.authorized', `Delegated authorization granted for ${proposal.actionType}.`, { decisionId: decision.id, strongConfirmation }, 'system');
      return true;
    }
    return false;
  }

  private buildContext(d: DelegatedAuthority, proposal: ActionProposal): EligibilityContext {
    const decision = this.controlledActions.policyEngine.evaluate({ proposal, stage: 'proposal', actor: 'delegation' });
    const killSwitch = this.controlledActions.policyEngine.killSwitch.state({ projectId: proposal.projectId, actionType: proposal.actionType });
    const budget = this.controlledActions.policyEngine.budgetManager.state(proposal);
    const facts = extractTargetFacts(proposal.actionType, proposal.normalizedPayload);
    const existingExecution = this.controlledActions.store.handle
      .prepare('SELECT COUNT(*) c FROM action_executions WHERE proposalId = ?').get(proposal.id) as { c: number };
    return {
      now: new Date(),
      killSwitchBlocked: killSwitch.blocked,
      killSwitchReason: killSwitch.switches[0]?.reason ?? null,
      policyDecisionResult: decision.decision as any,
      policyVersion: decision.policyVersion, policyHash: null,
      budgetBlocked: budget.blocked, budgetReason: budget.reason ?? null,
      providerHealthy: true,
      anomalyDetected: false, anomalyReason: null,
      orchestrationDependenciesValid: true,
      alreadyExecuted: existingExecution.c > 0,
      ...facts,
    };
  }

  private persistDecision(d: DelegatedAuthority, proposal: ActionProposal, result: ReturnType<typeof evaluateDelegationEligibility>, ctx: EligibilityContext): DelegationDecision {
    const evaluatedAt = now();
    const decisionHash = computeDecisionHash(d, proposal, result, evaluatedAt);
    const decision: DelegationDecision = {
      id: `deleg-decision-${randomUUID()}`, delegationId: d.id, proposalId: proposal.id,
      actionType: proposal.actionType, projectId: proposal.projectId ?? '',
      eligible: result.eligible, reasons: result.reasons,
      quotaBefore: { usedExecutions: d.usedExecutions, usedTargets: d.usedTargets },
      quotaAfter: null,
      targetScopeResult: result.targetScopeResult, timeWindowResult: result.timeWindowResult,
      riskResult: result.riskResult, policyResult: result.policyResult,
      killSwitchResult: result.killSwitchResult, budgetResult: result.budgetResult,
      decisionHash, evaluatedAt,
    };
    this.store.saveDecision(decision);
    this.store.recordEvent(d.id, proposal.id, 'delegation.evaluated', `Eligibility evaluated: ${result.eligible ? 'ELIGIBLE' : 'INELIGIBLE'}.`, { decisionHash }, 'system');
    return decision;
  }

  private persistDenied(proposal: ActionProposal, delegationId: string | null, reasons: string[]): DelegationDecision {
    const evaluatedAt = now();
    const decision: DelegationDecision = {
      id: `deleg-decision-${randomUUID()}`, delegationId: delegationId ?? 'none', proposalId: proposal.id,
      actionType: proposal.actionType, projectId: proposal.projectId ?? '', eligible: false, reasons,
      quotaBefore: { usedExecutions: 0, usedTargets: 0 }, quotaAfter: null,
      targetScopeResult: 'NOT_APPLICABLE', timeWindowResult: 'FAIL', riskResult: 'FAIL',
      policyResult: 'FAIL', killSwitchResult: 'PASS', budgetResult: 'PASS',
      decisionHash: payloadHash({ proposalId: proposal.id, reasons, evaluatedAt }), evaluatedAt,
    };
    return decision;
  }
}
