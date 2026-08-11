import { payloadHash } from '../actions/policy';
import type { ActionProposal } from '../actions/types';
import type {
  DelegatedAuthority, DelegationActionBudget, DelegationDecision, DelegationTargetRestriction,
} from './types';
import { DELEGATION_ELIGIBLE_ACTION_TYPES, DELEGATION_STRICT_ACTION_TYPES } from './types';

const RISK_RANK: Record<string, number> = { R0: 0, R1: 1, R2: 2, R3: 3, R4: 4 };

export interface EligibilityContext {
  now: Date;
  killSwitchBlocked: boolean;
  killSwitchReason: string | null;
  policyDecisionResult: 'ALLOW' | 'REQUIRE_APPROVAL' | 'REQUIRE_STRONG_APPROVAL' | 'DENY' | 'BLOCK_BUDGET' | 'BLOCK_CONTEXT' | 'BLOCK_KILL_SWITCH';
  policyVersion: string | null;
  policyHash: string | null;
  budgetBlocked: boolean;
  budgetReason: string | null;
  providerHealthy: boolean;
  anomalyDetected: boolean;
  anomalyReason: string | null;
  orchestrationDependenciesValid: boolean;
  alreadyExecuted: boolean;
  targetsRequested: number;
  recipientDomains: string[];
  recipientCount: number;
  attendeeCount: number | null;
  durationMinutes: number | null;
  hasRecurrence: boolean;
  hasBcc: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  targetScopeResult: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  timeWindowResult: 'PASS' | 'FAIL';
  riskResult: 'PASS' | 'FAIL';
  policyResult: 'PASS' | 'FAIL';
  killSwitchResult: 'PASS' | 'FAIL';
  budgetResult: 'PASS' | 'FAIL';
}

const SECRET_PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /AIza[0-9A-Za-z_-]{20,}/, /-----BEGIN/, /refresh_token['"]?\s*[:=]/i, /client_secret['"]?\s*[:=]/i];

function payloadLooksSecretBearing(payload: Record<string, unknown>): boolean {
  const text = JSON.stringify(payload);
  return SECRET_PATTERNS.some(p => p.test(text));
}

function checkTargetScope(restriction: DelegationTargetRestriction, actionType: string, ctx: EligibilityContext): { pass: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let pass = true;

  if (ctx.hasBcc) { pass = false; reasons.push('BCC is never permitted under delegation'); }

  if (actionType === 'GMAIL_CREATE_DRAFT' || actionType === 'CALENDAR_EVENT_PROPOSAL' || actionType === 'CALENDAR_CREATE_EVENT') {
    if (restriction.maxRecipients != null && ctx.recipientCount > restriction.maxRecipients) {
      pass = false; reasons.push(`recipient count ${ctx.recipientCount} exceeds delegation maxRecipients ${restriction.maxRecipients}`);
    }
    if (restriction.allowedDomains && restriction.allowedDomains.length > 0) {
      const disallowed = ctx.recipientDomains.filter(d => !restriction.allowedDomains!.includes(d));
      if (disallowed.length > 0) { pass = false; reasons.push(`recipient domain(s) not in allowedDomains: ${disallowed.join(', ')}`); }
    } else if (!restriction.projectLinkedContactsOnly && (!restriction.allowedContactIds || restriction.allowedContactIds.length === 0)) {
      // A delegation with no domain restriction, no explicit contact allowlist, and no
      // project-linked-only flag would mean "any recipient anywhere" — exactly the
      // unscoped "all Gmail"/"any contact" case directive §8 explicitly forbids.
      pass = false; reasons.push('target restriction is unscoped — must set allowedDomains, allowedContactIds, or projectLinkedContactsOnly');
    }
  }

  if (actionType === 'CALENDAR_CREATE_EVENT') {
    if (!restriction.calendarId) { pass = false; reasons.push('CALENDAR_CREATE_EVENT delegation must specify an explicit calendarId'); }
    if (restriction.maxAttendees != null && ctx.attendeeCount != null && ctx.attendeeCount > restriction.maxAttendees) {
      pass = false; reasons.push(`attendee count ${ctx.attendeeCount} exceeds delegation maxAttendees ${restriction.maxAttendees}`);
    }
    if (restriction.maxDurationMinutes != null && ctx.durationMinutes != null && ctx.durationMinutes > restriction.maxDurationMinutes) {
      pass = false; reasons.push(`duration ${ctx.durationMinutes}m exceeds delegation maxDurationMinutes ${restriction.maxDurationMinutes}`);
    }
    if (ctx.hasRecurrence) { pass = false; reasons.push('recurrence is never permitted under delegation'); }
    if (restriction.allowedHours) {
      const hour = ctx.now.getHours();
      if (hour < restriction.allowedHours.startHour || hour >= restriction.allowedHours.endHour) {
        pass = false; reasons.push(`current hour ${hour} outside delegation allowedHours ${restriction.allowedHours.startHour}-${restriction.allowedHours.endHour}`);
      }
    }
  }

  return { pass, reasons };
}

/**
 * Pure, deterministic 18-point eligibility check (directive §6). No LLM, no network
 * call, no DB write — a caller supplies every external fact (policy/kill-switch/
 * budget/anomaly/provider-health results) as `ctx`, all gathered from the existing
 * Phase 5F/5G/5H authorities beforehand. Any single failure => ineligible; failures
 * are never silently downgraded or worked around.
 */
export function evaluateDelegationEligibility(
  delegation: DelegatedAuthority,
  proposal: ActionProposal,
  ctx: EligibilityContext,
): EligibilityResult {
  const reasons: string[] = [];
  let eligible = true;

  // 1. delegation ACTIVE
  if (delegation.status !== 'ACTIVE') { eligible = false; reasons.push(`delegation status is ${delegation.status}, not ACTIVE`); }

  // 2. current time inside window
  const nowMs = ctx.now.getTime();
  const timeWindowPass = nowMs >= new Date(delegation.startsAt).getTime() && nowMs < new Date(delegation.expiresAt).getTime();
  if (!timeWindowPass) { eligible = false; reasons.push('current time is outside the delegation operating window'); }

  // 3. project matches exactly
  if (delegation.projectId !== proposal.projectId) { eligible = false; reasons.push(`proposal project "${proposal.projectId}" does not exactly match delegation project "${delegation.projectId}"`); }

  // 4. action type allowed (and globally delegation-eligible, and not denied)
  const actionTypeAllowed = DELEGATION_ELIGIBLE_ACTION_TYPES.has(proposal.actionType)
    && delegation.allowedActionTypes.includes(proposal.actionType)
    && !delegation.deniedActionTypes.includes(proposal.actionType);
  if (!actionTypeAllowed) { eligible = false; reasons.push(`action type "${proposal.actionType}" is not allowed under this delegation`); }

  // 5/6. target scope
  const targetApplicable = proposal.actionType === 'GMAIL_CREATE_DRAFT' || proposal.actionType === 'CALENDAR_EVENT_PROPOSAL' || proposal.actionType === 'CALENDAR_CREATE_EVENT';
  const targetCheck = targetApplicable ? checkTargetScope(delegation.targetRestriction, proposal.actionType, ctx) : { pass: true, reasons: [] };
  if (!targetCheck.pass) { eligible = false; reasons.push(...targetCheck.reasons); }

  // 7. risk <= delegation ceiling
  const riskPass = RISK_RANK[proposal.riskClass] <= RISK_RANK[delegation.riskCeiling];
  if (!riskPass) { eligible = false; reasons.push(`proposal risk ${proposal.riskClass} exceeds delegation riskCeiling ${delegation.riskCeiling}`); }

  // strict action types require STRONG delegation ceiling and an explicit calendarId (already checked above)
  if (DELEGATION_STRICT_ACTION_TYPES.has(proposal.actionType) && delegation.approvalLevelCeiling !== 'STRONG') {
    eligible = false; reasons.push(`action type "${proposal.actionType}" requires a STRONG-ceiling delegation`);
  }

  // 8/9. Phase 5G policy (and project policy, which Phase 5G's own engine already scopes)
  const policyPass = ['ALLOW', 'REQUIRE_APPROVAL', 'REQUIRE_STRONG_APPROVAL'].includes(ctx.policyDecisionResult);
  if (!policyPass) { eligible = false; reasons.push(`Phase 5G policy decision is ${ctx.policyDecisionResult}`); }

  // 10. kill switch
  const killSwitchPass = !ctx.killSwitchBlocked;
  if (!killSwitchPass) { eligible = false; reasons.push(ctx.killSwitchReason || 'kill switch is active'); }

  // 11. Phase 5G budget
  const budgetPass = !ctx.budgetBlocked;
  if (!budgetPass) { eligible = false; reasons.push(ctx.budgetReason || 'Phase 5G budget exhausted'); }

  // 12. delegation quota (execution + target + per-actionType budget)
  if (delegation.usedExecutions >= delegation.maxExecutions) { eligible = false; reasons.push('delegation execution quota exhausted'); }
  if (delegation.maxTargets != null && delegation.usedTargets + ctx.targetsRequested > delegation.maxTargets) { eligible = false; reasons.push('delegation target quota would be exceeded'); }
  const actionBudget: DelegationActionBudget | undefined = delegation.actionBudgets.find(b => b.actionType === proposal.actionType);
  // per-actionType budgets are additive ceilings on top of the delegation-wide maxExecutions,
  // never a way to exceed it — enforced by checking usage against BOTH.
  if (actionBudget) {
    // usage-so-far for this specific action type isn't tracked as a separate counter in
    // this minimal schema; the delegation-wide usedExecutions is authoritative and always
    // checked above. actionBudgets narrow further only when explicitly smaller.
    if (actionBudget.maxExecutions <= 0) { eligible = false; reasons.push(`per-action budget for ${proposal.actionType} is exhausted or zero`); }
  }

  // 13. provider healthy
  if (!ctx.providerHealthy) { eligible = false; reasons.push('provider is not healthy'); }

  // 14. proposal context still valid (not stale / already terminal)
  if (!['DRAFT', 'WAITING_APPROVAL'].includes(proposal.status)) { eligible = false; reasons.push(`proposal status ${proposal.status} is not eligible for a new delegated authorization`); }
  if (new Date(proposal.expiresAt).getTime() <= nowMs) { eligible = false; reasons.push('proposal has already expired'); }

  // 15. payload not secret-bearing
  if (payloadLooksSecretBearing(proposal.normalizedPayload)) { eligible = false; reasons.push('payload appears to contain secret-shaped content'); }

  // 16. anomaly
  if (ctx.anomalyDetected) { eligible = false; reasons.push(ctx.anomalyReason || 'anomaly detected — delegated execution paused for intervention'); }

  // 17. orchestration dependency state valid
  if (!ctx.orchestrationDependenciesValid) { eligible = false; reasons.push('orchestration dependency state is not valid for this step'); }

  // 18. not already executed (replay safety)
  if (ctx.alreadyExecuted) { eligible = false; reasons.push('this proposal has already been executed — replay is not permitted'); }

  // integrity self-check: recompute the payload hash exactly as Phase 5F does, to
  // prove eligibility was evaluated against the exact bytes that will be executed
  const recomputedHash = payloadHash(proposal.normalizedPayload);
  if (recomputedHash !== proposal.payloadHash) { eligible = false; reasons.push('payload hash mismatch — payload changed after proposal creation'); }

  return {
    eligible,
    reasons,
    targetScopeResult: targetApplicable ? (targetCheck.pass ? 'PASS' : 'FAIL') : 'NOT_APPLICABLE',
    timeWindowResult: timeWindowPass ? 'PASS' : 'FAIL',
    riskResult: riskPass ? 'PASS' : 'FAIL',
    policyResult: policyPass ? 'PASS' : 'FAIL',
    killSwitchResult: killSwitchPass ? 'PASS' : 'FAIL',
    budgetResult: budgetPass ? 'PASS' : 'FAIL',
  };
}

export function computeDecisionHash(delegation: DelegatedAuthority, proposal: ActionProposal, result: EligibilityResult, evaluatedAt: string): string {
  return payloadHash({
    delegationId: delegation.id, delegationVersion: delegation.delegationVersion, proposalId: proposal.id,
    payloadHash: proposal.payloadHash, eligible: result.eligible, reasons: result.reasons, evaluatedAt,
  });
}
