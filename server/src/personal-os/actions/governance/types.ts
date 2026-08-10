import type { ActionRiskClass, ActionType } from '../types';

export const PHASE5G_SCHEMA_VERSION = 8;
export const PHASE5G_POLICY_VERSION = 'phase5g-default-v1';

export type PolicyDecisionResult =
  | 'ALLOW'
  | 'REQUIRE_APPROVAL'
  | 'REQUIRE_STRONG_APPROVAL'
  | 'DENY'
  | 'BLOCK_BUDGET'
  | 'BLOCK_CONTEXT'
  | 'BLOCK_KILL_SWITCH';

export type ApprovalLevel = 'NONE' | 'STANDARD' | 'STRONG' | 'DUAL_CONFIRMATION';
export type PolicyRuleScope = 'GLOBAL' | 'PROJECT' | 'ACTION_TYPE' | 'USER' | 'ENVIRONMENT';
export type PolicyRuleEffect = 'ALLOW' | 'REQUIRE_APPROVAL' | 'REQUIRE_STRONG_APPROVAL' | 'DENY' | 'LIMIT';
export type PolicySetStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK';
export type ActionBudgetPeriod = 'HOUR' | 'DAY' | 'WEEK';
export type KillSwitchScope = 'GLOBAL' | 'PROJECT' | 'ACTION_TYPE';
export type SensitivityClass = 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET';
export type AnomalySeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type GovernanceAnomalyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'CLOSED';

export interface BudgetState {
  blocked: boolean;
  budgetId: string | null;
  scope: string;
  maxExecutions: number | null;
  usedExecutions: number;
  remainingExecutions: number | null;
  resetsAt: string | null;
  reason: string | null;
}

export interface KillSwitchState {
  blocked: boolean;
  switches: Array<{
    id: string;
    scope: KillSwitchScope;
    projectId: string | null;
    actionType: ActionType | null;
    reason: string;
    activatedAt: string;
    expiresAt: string | null;
  }>;
}

export interface ContextualConstraints {
  proposalExpired: boolean;
  approvalExpired: boolean;
  projectRegistered: boolean;
  projectArchived: boolean;
  personalOsSchemaHealthy: boolean;
  providerCapabilityAvailable: boolean;
  policyVersionCurrent: boolean;
  serviceHealthy: boolean;
  staleReasons: string[];
}

export interface RiskAssessment {
  riskClass: ActionRiskClass;
  score: number;
  factors: string[];
  reversible: boolean;
  externalImpact: boolean;
  sensitivity: SensitivityClass;
  requiresStrongApproval: boolean;
  warnings: string[];
}

export interface PolicyDecision {
  id: string;
  proposalId: string;
  actionType: ActionType;
  projectId: string | null;
  riskClass: ActionRiskClass;
  decision: PolicyDecisionResult;
  requiredApprovalLevel: ApprovalLevel;
  reasons: string[];
  matchedPolicies: string[];
  deniedPolicies: string[];
  budgetState: BudgetState;
  killSwitchState: KillSwitchState;
  contextualConstraints: ContextualConstraints;
  evaluatedAt: string;
  policyVersion: string;
  inputHash: string;
  decisionHash: string;
  evidenceReferences: string[];
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  scope: PolicyRuleScope;
  actionTypes: ActionType[];
  projects: string[];
  riskClasses: ActionRiskClass[];
  conditions: Record<string, unknown>;
  effect: PolicyRuleEffect;
  approvalLevel: ApprovalLevel;
  maxExecutions: number | null;
  timeWindow: ActionBudgetPeriod | null;
  validFrom: string | null;
  validUntil: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface PolicySet {
  id: string;
  version: string;
  contentHash: string;
  status: PolicySetStatus;
  createdAt: string;
  activatedAt: string | null;
  supersedesId: string | null;
  rules: PolicyRule[];
}

export interface ActionBudget {
  id: string;
  scope: PolicyRuleScope;
  projectId: string | null;
  actionType: ActionType | null;
  period: ActionBudgetPeriod;
  maxProposals: number;
  maxApprovals: number;
  maxExecutions: number;
  maxExternalTargets: number;
  currentUsage: {
    proposals: number;
    approvals: number;
    executions: number;
    externalTargets: number;
  };
  resetsAt: string;
  enabled: boolean;
}

export interface KillSwitch {
  id: string;
  scope: KillSwitchScope;
  projectId: string | null;
  actionType: ActionType | null;
  enabled: boolean;
  reason: string;
  activatedBy: string;
  activatedAt: string;
  expiresAt: string | null;
  evidenceReferences: string[];
}

export interface GovernanceAnomaly {
  id: string;
  type: string;
  severity: AnomalySeverity;
  proposalId: string | null;
  projectId: string | null;
  description: string;
  evidence: Record<string, unknown>;
  detectedAt: string;
  status: GovernanceAnomalyStatus;
}

export interface GovernanceEvent {
  id: string;
  eventType: string;
  policyVersion: string | null;
  inputHash: string | null;
  decisionHash: string | null;
  actor: string;
  proposalId: string | null;
  reasons: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectActionPolicy {
  projectId: string;
  allowedActionTypes: ActionType[];
  deniedActionTypes: ActionType[];
  maxRiskClass: ActionRiskClass;
  budgets: Record<string, unknown>;
  targetRestrictions: Record<string, unknown>;
  active: boolean;
  updatedAt: string;
}

export interface BurstDetection {
  scope: string;
  window: string;
  count: number;
  threshold: number;
  triggered: boolean;
  reason: string;
}
