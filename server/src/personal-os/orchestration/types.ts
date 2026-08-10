// Phase 5H — Governed Multi-Step Action Planning.
// Additive types only. This module never defines its own ActionType, ActionProposal,
// ActionApproval, ActionExecution, or policy-decision shape — it references the
// existing Phase 5F/5G ones (`../actions/types`, `../actions/governance/types`) and
// only adds the plan/step/dependency/evidence layer described in
// docs/architecture/PHASE5H_GOVERNED_ORCHESTRATION.md.

import type { ActionType } from '../actions/types';
import type { ApprovalLevel, PolicyDecisionResult } from '../actions/governance/types';

export const PHASE5H_SCHEMA_VERSION = 9;

/** The only 3 action types Phase 5H may ever create a Controlled Action proposal for. */
export const ORCHESTRATION_ALLOWED_ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'GMAIL_CREATE_DRAFT',
  'CALENDAR_EVENT_PROPOSAL',
  'CALENDAR_CREATE_EVENT',
]);

export type ActionPlanStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// Explicit transition map, same pattern as task-runtime/types.ts's ALLOWED_TRANSITIONS —
// anything not listed here is rejected so a plan cannot silently skip states.
// WAITING_APPROVAL here means "at least one step is WAITING_APPROVAL and nothing else
// is currently advanceable" — distinct from READY ("every eligible step has been
// advanced as far as it can go without a pending human approval").
export const PLAN_ALLOWED_TRANSITIONS: Record<ActionPlanStatus, ActionPlanStatus[]> = {
  DRAFT: ['VALIDATED', 'FAILED', 'CANCELLED'],
  VALIDATED: ['READY', 'CANCELLED'],
  WAITING_APPROVAL: ['READY', 'RUNNING', 'PAUSED', 'FAILED', 'CANCELLED'],
  READY: ['RUNNING', 'WAITING_APPROVAL', 'COMPLETED', 'CANCELLED'],
  RUNNING: ['WAITING_APPROVAL', 'READY', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PAUSED: ['READY', 'RUNNING', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export type ActionPlanStepType = 'READ_ONLY' | 'LOCAL_COMPUTE' | 'CONTROLLED_ACTION';

export type ActionPlanStepStatus =
  | 'PENDING'
  | 'BLOCKED'
  | 'READY'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECONCILIATION_REQUIRED';

export const STEP_ALLOWED_TRANSITIONS: Record<ActionPlanStepStatus, ActionPlanStepStatus[]> = {
  PENDING: ['BLOCKED', 'READY', 'CANCELLED'],
  BLOCKED: ['READY', 'CANCELLED', 'FAILED'],
  READY: ['RUNNING', 'CANCELLED'],
  RUNNING: ['WAITING_APPROVAL', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED', 'CANCELLED'],
  // WAITING_APPROVAL -> COMPLETED/FAILED directly: the human approval + execution
  // happen through the existing Controlled Actions surface between orchestration
  // polls, so the next advance() call observes the outcome in one hop.
  WAITING_APPROVAL: ['RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  RECONCILIATION_REQUIRED: ['FAILED'],
};

/** Side-effect class of a step — READ_ONLY/LOCAL_COMPUTE steps must be NONE or LOCAL. */
export type SideEffectClass = 'NONE' | 'LOCAL' | 'EXTERNAL';

export interface ActionPlanStepInput {
  /** Caller-assigned identifier used only for dependency wiring within one plan version. */
  key: string;
  type: ActionPlanStepType;
  description: string;
  projectId?: string | null;
  dependsOnKeys?: string[];
  inputs?: Record<string, unknown>;
  expectedOutputs?: Record<string, unknown>;
  /** Required and validated against ORCHESTRATION_ALLOWED_ACTION_TYPES when type is CONTROLLED_ACTION. */
  actionType?: ActionType | null;
  /** Payload passed straight through to ControlledActionService.propose() when this step runs. */
  actionPayload?: Record<string, unknown> | null;
}

export interface ActionPlanStep {
  id: string;
  planId: string;
  stepIndex: number;
  key: string;
  type: ActionPlanStepType;
  description: string;
  projectId: string | null;
  dependsOnStepIds: string[];
  inputs: Record<string, unknown>;
  expectedOutputs: Record<string, unknown>;
  sideEffectClass: SideEffectClass;
  actionType: ActionType | null;
  actionPayload: Record<string, unknown> | null;
  riskClass: string | null;
  requiredApprovalLevel: ApprovalLevel | null;
  policyDecisionId: string | null;
  policyDecisionResult: PolicyDecisionResult | null;
  proposalId: string | null;
  status: ActionPlanStepStatus;
  outputSummary: Record<string, unknown> | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface CreateActionPlanInput {
  title: string;
  objective: string;
  goalId?: string | null;
  projectId?: string | null;
  steps: ActionPlanStepInput[];
}

export interface ActionPlan {
  id: string;
  goalId: string | null;
  title: string;
  objective: string;
  projectId: string | null;
  status: ActionPlanStatus;
  planVersion: number;
  previousVersionId: string | null;
  planHash: string;
  policyVersion: string | null;
  policyHash: string | null;
  createdAt: string;
  updatedAt: string;
  validatedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
  blockedReason: string | null;
}

export type RetryClass =
  | 'RETRYABLE'
  | 'NON_RETRYABLE'
  | 'APPROVAL_REQUIRED'
  | 'POLICY_DENIED'
  | 'KILL_SWITCHED'
  | 'BUDGET_DENIED';

export interface ActionPlanStepAttempt {
  id: string;
  stepId: string;
  attempt: number;
  idempotencyKey: string;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  retryClass: RetryClass | null;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface ActionPlanRun {
  id: string;
  planId: string;
  triggeredBy: string;
  idempotencyKey: string;
  stepsAdvanced: number;
  startedAt: string;
  completedAt: string | null;
  resultSummary: string | null;
}

export type PlanEvidenceEventType =
  | 'PLAN_CREATED'
  | 'PLAN_VALIDATED'
  | 'PLAN_VALIDATION_FAILED'
  | 'PLAN_VERSIONED'
  | 'PLAN_STARTED'
  | 'STEP_READY'
  | 'STEP_STARTED'
  | 'STEP_WAITING_APPROVAL'
  | 'APPROVAL_BOUND'
  | 'POLICY_DENIED'
  | 'KILL_SWITCH_BLOCKED'
  | 'BUDGET_BLOCKED'
  | 'STEP_EXECUTED'
  | 'STEP_FAILED'
  | 'STEP_RECONCILIATION_REQUIRED'
  | 'PLAN_PAUSED'
  | 'PLAN_RESUMED'
  | 'PLAN_COMPLETED'
  | 'PLAN_FAILED'
  | 'PLAN_CANCELLED';

export interface ActionPlanEvidence {
  id: string;
  planId: string;
  stepId: string | null;
  eventType: PlanEvidenceEventType;
  summary: string;
  metadata: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export interface PlanValidationIssue {
  code: string;
  message: string;
  stepKey?: string;
}

export interface PlanValidationResult {
  valid: boolean;
  issues: PlanValidationIssue[];
  topologicalOrder: string[];
}

export interface PlanAdvanceResult {
  plan: ActionPlan;
  run: ActionPlanRun;
  stepsAdvanced: number;
  deduplicated: boolean;
}
