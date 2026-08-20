import type { AuthorityManifest, AuthoritySurface } from '../authority-control-plane/types';
import type { ActionType } from '../personal-os/actions/types';

export type OperatorSourceType =
  | 'TASK_APPROVAL'
  | 'KNOWLEDGE_CONFIRMATION'
  | 'CONTROLLED_ACTION'
  | 'GOVERNANCE_CHANGE'
  | 'ACTION_PLAN'
  | 'ACTION_PLAN_STEP'
  | 'DELEGATION'
  | 'LEGACY_MIGRATION_WARNING'
  | 'AUTHORITY_VIOLATION';

export type OperatorItemState =
  | 'WAITING_ON_OPERATOR'
  | 'ACTIVE'
  | 'BLOCKED'
  | 'NEEDS_ATTENTION'
  | 'EXPIRING'
  | 'QUARANTINED'
  | 'INFORMATIONAL';

export type OperatorUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type OperatorBlockedReason =
  | 'NONE'
  | 'WAITING_HUMAN_APPROVAL'
  | 'KNOWLEDGE_NEEDS_CONFIRMATION'
  | 'POLICY_DENIED'
  | 'BUDGET_EXHAUSTED'
  | 'KILL_SWITCH_ACTIVE'
  | 'CONTEXT_BLOCKED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PAYLOAD_CHANGED'
  | 'FORBIDDEN_CAPABILITY'
  | 'DELEGATION_EXPIRED'
  | 'DELEGATION_EXHAUSTED'
  | 'DELEGATION_REVOKED'
  | 'DELEGATION_PAUSED'
  | 'PLAN_DEPENDENCY_BLOCKED'
  | 'RECONCILIATION_REQUIRED'
  | 'LEGACY_QUARANTINED'
  | 'UNKNOWN_BLOCKER';

export interface OperatorRiskSummary {
  effectClass: string;
  riskClass: string | null;
  approvalRequired: boolean;
  requiredApprovalLevel: string | null;
  governanceRequired: boolean;
  externalSystem: string | null;
  canExecuteWithoutHuman: boolean;
  canonicalRecheckRequired: boolean;
}

export interface OperatorAuthoritySummary {
  actionType: string | null;
  authorityClass: string | null;
  authoritySurfaceId: string | null;
  canonicalOwner: string | null;
  state: 'READ_ONLY' | 'PER_ACTION_APPROVAL_REQUIRED' | 'DELEGATED_CONDITIONALLY' | 'BLOCKED' | 'FORBIDDEN' | 'UNKNOWN';
  reason: OperatorBlockedReason;
  details: string[];
}

export interface OperatorItem {
  id: string;
  sourceType: OperatorSourceType;
  sourceId: string;
  projectId: string | null;
  title: string;
  summary: string;
  state: OperatorItemState;
  urgency: OperatorUrgency;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  actor: string | null;
  requestedBy: string | null;
  actionType: string | null;
  targetSummary: string | null;
  risk: OperatorRiskSummary;
  authority: OperatorAuthoritySummary;
  policyState: string | null;
  budgetState: string | null;
  killSwitchState: string | null;
  delegationState: string | null;
  planId: string | null;
  stepId: string | null;
  blockedReason: OperatorBlockedReason;
  evidenceRefs: string[];
  allowedOperatorActions: string[];
}

export interface EffectiveAuthorityAction {
  actionType: ActionType;
  state: OperatorAuthoritySummary['state'];
  canExecuteWithoutHuman: boolean;
  canonicalRecheckRequired: boolean;
  reason: OperatorBlockedReason;
  activeDelegations: number;
  remainingDelegatedExecutions: number;
  activeKillSwitches: number;
  enabledBudgets: number;
  details: string[];
}

export interface OperatorAuthorityView {
  generatedAt: string;
  frozenExternalWritableActions: ActionType[];
  effectiveActions: EffectiveAuthorityAction[];
  manifestCounts: AuthorityManifest['counts'];
  legacy: {
    legacyMutations: number;
    adaptedLegacy: number;
    quarantinedLegacy: number;
    unresolvedLegacyMutations: number;
    sampleQuarantinedSurfaces: Array<Pick<AuthoritySurface, 'id' | 'runtimeMount' | 'method' | 'canonicalOwner' | 'phase6bDisposition'>>;
  };
}

export interface OperatorOverview {
  generatedAt: string;
  counts: Record<OperatorItemState | 'total', number>;
  pendingBySource: Record<OperatorSourceType, number>;
  criticalCount: number;
  expiringCount: number;
  legacyQuarantinedCount: number;
  authority: OperatorAuthorityView;
}

export interface OperatorControlSnapshot {
  overview: OperatorOverview;
  pending: OperatorItem[];
  blocked: OperatorItem[];
  attention: OperatorItem[];
  authority: OperatorAuthorityView;
  items: OperatorItem[];
}

export interface OperatorServiceOptions {
  personalOsRoot?: string;
  taskRuntimeRoot?: string;
  repoRoot?: string;
  now?: () => Date;
}

/** Phase 9B — pure observability of a background worker's live state. Never a
 *  mutation surface: nothing in this view or its consumer can restart, kill,
 *  or otherwise act on anything it describes. */
export interface OperatorBackgroundServiceView {
  id: string;
  name: string;
  type: 'pm2' | 'http' | 'port' | 'internal';
  pm2Name: string | null;
  critical: boolean;
  healthy: boolean | null;
  lastChecked: string | null;
  lastHealthyAt: string | null;
  lastFailureAt: string | null;
  intentionallyStopped: boolean;
  restartEligibility: string | null;
  restartCount: number;
}

export interface OperatorBackgroundRestartEvidence {
  serviceId: string;
  pm2Name: string;
  decision: string;
  outcome: string | null;
  restartAttemptNumber: number;
  detail: string;
  createdAt: string;
}

export interface OperatorBackgroundWorkerClassification {
  id: string;
  sourcePath: string;
  authorityClass: AuthoritySurface['authorityClass'];
  status: AuthoritySurface['status'];
  approvalRequired: boolean;
  governanceRequired: boolean;
  quarantineHandler: string | null;
  phase6bDisposition: AuthoritySurface['phase6bDisposition'];
  /** True for a BACKGROUND_WORKER surface still authorityClass LEGACY_QUARANTINED —
   *  i.e. honestly reclassified in Phase 9A (no false enforcement claim) but not yet
   *  behaviorally hardened. Distinct from self-healing-monitor, which received real
   *  behavioral enforcement, not just reclassification. */
  behavioralHardeningDebt: boolean;
}

export interface OperatorBackgroundWorkerView {
  generatedAt: string;
  scanLastRunAt: string | null;
  globalKillSwitchActive: boolean;
  services: OperatorBackgroundServiceView[];
  recentRestartEvidence: OperatorBackgroundRestartEvidence[];
  workerClassifications: OperatorBackgroundWorkerClassification[];
  behavioralHardeningDebtSurfaces: string[];
}
