import type { ActionRiskClass, ActionType } from '../actions/types';
import type { ApprovalLevel } from '../actions/governance/types';

export const PHASE5I_SCHEMA_VERSION = 10;

/** Only these Phase 5F action types may ever be delegated. Delegation narrows
 *  eligibility for an existing type — it can never introduce a new one. */
export const DELEGATION_ELIGIBLE_ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'GMAIL_CREATE_DRAFT',
  'CALENDAR_EVENT_PROPOSAL',
  'CALENDAR_CREATE_EVENT',
]);

/** CALENDAR_CREATE_EVENT may only be delegated at STRONG approval level with an
 *  explicit calendar/attendee restriction present (directive §7). */
export const DELEGATION_STRICT_ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'CALENDAR_CREATE_EVENT',
]);

export type DelegatedAuthorityStatus =
  | 'DRAFT'
  | 'WAITING_APPROVAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'PAUSED_POLICY_CHANGED'
  | 'EXPIRED'
  | 'EXHAUSTED'
  | 'REVOKED'
  | 'CANCELLED';

// Explicit transition map — same pattern as orchestration's PLAN_ALLOWED_TRANSITIONS.
// Nothing not listed here is reachable; a delegation can never skip states.
export const DELEGATION_ALLOWED_TRANSITIONS: Record<DelegatedAuthorityStatus, DelegatedAuthorityStatus[]> = {
  DRAFT: ['WAITING_APPROVAL', 'CANCELLED'],
  WAITING_APPROVAL: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['PAUSED', 'PAUSED_POLICY_CHANGED', 'EXPIRED', 'EXHAUSTED', 'REVOKED', 'CANCELLED'],
  PAUSED: ['ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED'],
  PAUSED_POLICY_CHANGED: ['ACTIVE', 'EXPIRED', 'REVOKED', 'CANCELLED'],
  EXPIRED: [],
  EXHAUSTED: [],
  REVOKED: [],
  CANCELLED: [],
};

/** Only ACTIVE (or PAUSED, which is still metadata-alive but execution-blocked)
 *  authorities are ever considered for delegated execution eligibility. */
export const DELEGATION_EXECUTABLE_STATUSES: ReadonlySet<DelegatedAuthorityStatus> = new Set(['ACTIVE']);

export interface DelegationTargetRestriction {
  /** Gmail: allowed recipient domains, e.g. ["example.com"]. Empty = no domain restricted (still requires allowedContactIds or projectLinkedContactsOnly). */
  allowedDomains?: string[];
  /** Explicit allow-listed contact identifiers (email addresses / calendar attendee ids). */
  allowedContactIds?: string[];
  /** If true, only contacts already linked to the delegation's project are eligible. */
  projectLinkedContactsOnly?: boolean;
  /** Gmail: max recipients (To+Cc) per single action. */
  maxRecipients?: number;
  /** Gmail: BCC is never permitted under delegation regardless of this flag; kept explicit for evidence clarity. */
  allowBcc?: false;
  /** Calendar: specific calendar id the delegation is scoped to. */
  calendarId?: string;
  /** Calendar: max attendees per event. */
  maxAttendees?: number;
  /** Calendar: max event duration in minutes. */
  maxDurationMinutes?: number;
  /** Calendar: recurrence is never permitted under delegation. */
  allowRecurrence?: false;
  /** Calendar: allowed local hour-of-day range, e.g. { startHour: 9, endHour: 17 }. */
  allowedHours?: { startHour: number; endHour: number };
}

export interface DelegationActionBudget {
  actionType: ActionType;
  maxExecutions: number;
}

export interface DelegatedAuthority {
  id: string;
  delegationVersion: number;
  previousVersionId: string | null;
  title: string;
  description: string;
  owner: string;
  projectId: string;
  status: DelegatedAuthorityStatus;

  allowedActionTypes: ActionType[];
  deniedActionTypes: ActionType[];
  targetRestriction: DelegationTargetRestriction;

  riskCeiling: ActionRiskClass;
  approvalLevelCeiling: ApprovalLevel;

  startsAt: string;
  expiresAt: string;
  timezone: string;

  maxExecutions: number;
  usedExecutions: number;
  maxTargets: number | null;
  usedTargets: number;
  actionBudgets: DelegationActionBudget[];

  sourceGoalId: string | null;
  sourcePlanId: string | null;

  policyVersion: string | null;
  policyHash: string | null;
  delegationPayloadHash: string;

  createdAt: string;
  approvedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  exhaustedAt: string | null;
  expiredAt: string | null;
  pausedReason: string | null;

  evidenceReferences: string[];
}

export interface CreateDelegationInput {
  title: string;
  description: string;
  owner: string;
  projectId: string;
  allowedActionTypes: ActionType[];
  deniedActionTypes?: ActionType[];
  targetRestriction: DelegationTargetRestriction;
  riskCeiling: ActionRiskClass;
  approvalLevelCeiling: ApprovalLevel;
  startsAt: string;
  expiresAt: string;
  timezone: string;
  maxExecutions: number;
  maxTargets?: number | null;
  actionBudgets?: DelegationActionBudget[];
  sourceGoalId?: string | null;
  sourcePlanId?: string | null;
}

export interface DelegationDecision {
  id: string;
  delegationId: string;
  proposalId: string;
  actionType: ActionType;
  projectId: string;
  eligible: boolean;
  reasons: string[];
  quotaBefore: { usedExecutions: number; usedTargets: number };
  quotaAfter: { usedExecutions: number; usedTargets: number } | null;
  targetScopeResult: 'PASS' | 'FAIL' | 'NOT_APPLICABLE';
  timeWindowResult: 'PASS' | 'FAIL';
  riskResult: 'PASS' | 'FAIL';
  policyResult: 'PASS' | 'FAIL';
  killSwitchResult: 'PASS' | 'FAIL';
  budgetResult: 'PASS' | 'FAIL';
  decisionHash: string;
  evaluatedAt: string;
}

export type DelegationEventType =
  | 'delegation.created'
  | 'delegation.approved'
  | 'delegation.activated'
  | 'delegation.evaluated'
  | 'delegation.execution.authorized'
  | 'delegation.execution.denied'
  | 'delegation.quota.reserved'
  | 'delegation.quota.exhausted'
  | 'delegation.paused'
  | 'delegation.resumed'
  | 'delegation.expired'
  | 'delegation.revoked'
  | 'delegation.cancelled'
  | 'delegation.policy_changed'
  | 'delegation.anomaly_detected';

export interface DelegationEvidence {
  id: string;
  delegationId: string;
  proposalId: string | null;
  eventType: DelegationEventType;
  summary: string;
  metadata: Record<string, unknown>;
  actor: string;
  createdAt: string;
}
