/**
 * Phase 6F — Governed Automation Simulation contracts.
 *
 * A SimulationRun answers "what WOULD happen" using the same deterministic Phase
 * 5F/5G/5H/5I evaluators the live system uses — never `EXECUTED`, never a live status.
 * Nothing in this module writes to a real store, calls a real provider, or consumes
 * real budget/delegation/kill-switch state. See docs/security/PHASE6F_SIMULATION_BOUNDARY.md.
 */
import type { ActionRiskClass, ActionType } from '../actions/types';
import type { ApprovalLevel, BudgetState, KillSwitchState, PolicyDecisionResult } from '../actions/governance/types';
import type { EligibilityResult } from '../delegation/eligibility';

export const SIMULATION_ENGINE_VERSION = 'phase6f-sim-1.0.0';

/** Never `EXECUTED` — that word is reserved for the real execution ledger. */
export type SimulationOutcome =
  | 'SIMULATED' | 'WOULD_EXECUTE' | 'WOULD_REQUIRE_APPROVAL' | 'WOULD_BLOCK'
  | 'WOULD_FAIL' | 'UNCERTAIN' | 'INVALID';

export type FakeProviderScenario =
  | 'SUCCESS' | 'VALIDATION_ERROR' | 'TIMEOUT' | 'RATE_LIMIT' | 'UNAVAILABLE'
  | 'AMBIGUOUS_RESULT' | 'PARTIAL_FAILURE';

/** A branded marker only this module's own fake-providers.ts can construct — see
 *  fake-providers.ts's header comment for why this exists (§33 hard boundary). */
export interface SimulationCapabilityToken {
  readonly __simulationOnly: true;
}

export interface KillSwitchOverride {
  scope: 'GLOBAL' | 'PROJECT' | 'ACTION_TYPE';
  projectId?: string | null;
  actionType?: ActionType | null;
  reason: string;
}

export interface BudgetOverride {
  actionType: ActionType;
  projectId: string | null;
  maxExecutions: number;
  usedExecutions: number;
  maxExternalTargets: number;
  usedExternalTargets: number;
}

export interface DelegationOverride {
  /** One of the EligibilityContext-shaped what-if scenarios from directive §15 —
   *  named rather than a raw context object so the evaluation dataset stays readable. */
  scenario:
    | 'NONE' | 'VALID' | 'EXPIRED' | 'REVOKED' | 'QUOTA_EXHAUSTED' | 'WRONG_PROJECT'
    | 'WRONG_ACTION' | 'WRONG_TARGET' | 'RISK_ABOVE_CEILING' | 'POLICY_CHANGED';
  delegationId?: string;
}

/** A single candidate action or local step to simulate. Immutable once constructed —
 *  the service never mutates a SimulationStepInput after hashing it into inputHash. */
export interface SimulationStepInput {
  key: string;
  type: 'READ_ONLY' | 'LOCAL_COMPUTE' | 'CONTROLLED_ACTION';
  description: string;
  dependsOnKeys?: string[];
  projectId?: string | null;
  actionType?: ActionType | null;
  actionPayload?: Record<string, unknown> | null;
  /** Forbidden/legacy-quarantine what-if candidates (§23-24) — never produces a real
   *  authority surface or provider path even if set. */
  forbiddenCandidate?: boolean;
  legacyQuarantinedSurfaceId?: string | null;
  providerScenario?: FakeProviderScenario;
  killSwitchOverrides?: KillSwitchOverride[];
  budgetOverrides?: BudgetOverride[];
  delegationOverride?: DelegationOverride | null;
  /** Concurrency what-if (§20): how many other candidates target the same idempotency
   *  key / budget slot in this same simulation run. */
  concurrentCandidateCount?: number;
}

export interface SimulationInput {
  kind: 'EXISTING_PLAN_SNAPSHOT' | 'PROPOSED_PLAN' | 'SINGLE_PROPOSAL' | 'DELEGATED_CANDIDATE' | 'POLICY_WHAT_IF';
  projectId: string | null;
  steps: SimulationStepInput[];
}

export interface FakeProviderResult {
  scenario: FakeProviderScenario;
  simulatedObjectId: string | null;
  responseSummary: Record<string, unknown>;
  reconciliationRequired: boolean;
}

export interface SimulationStepResult {
  stepId: string;
  type: SimulationStepInput['type'];
  dependencies: string[];
  authoritySurface: string | null;
  canonicalOwner: string | null;
  actionType: ActionType | null;
  targetSummary: string;
  riskClass: ActionRiskClass | null;
  policyDecision: PolicyDecisionResult | null;
  approvalRequirement: ApprovalLevel | null;
  delegationDecision: EligibilityResult | null;
  budgetDecision: BudgetState | null;
  killSwitchDecision: KillSwitchState | null;
  expectedProviderEffect: FakeProviderResult | null;
  result: SimulationOutcome;
  reason: string;
  evidenceRefs: string[];
  reversibility: 'REVERSIBLE' | 'IRREVERSIBLE' | 'UNKNOWN';
}

export interface SimulationRun {
  simulationId: string;
  inputHash: string;
  engineVersion: string;
  createdAt: string;
  simulatedAt: string;
  projectId: string | null;
  policyVersion: string | null;
  policyHash: string | null;
  overallOutcome: SimulationOutcome;
  steps: SimulationStepResult[];
  approvalCount: number;
  sideEffectCount: number;
  blockedCount: number;
  uncertainCount: number;
  evidenceRefs: string[];
  assumptions: string[];
  facts: string[];
  unknowns: string[];
  warnings: string[];
}
