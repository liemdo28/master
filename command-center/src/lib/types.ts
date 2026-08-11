/** Mirrors of backend read-model contracts (Phase 5A-5D3). Kept intentionally loose
 *  (optional/unknown-tolerant) since the UI must never crash on a field the backend
 *  didn't send — see ErrorState/EmptyState handling instead of type coercion. */

export type ProjectHealthStatus = 'HEALTHY' | 'ATTENTION' | 'BLOCKED' | 'UNKNOWN';
export type ServiceHealthStatus = 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';

export interface ProjectHealth {
  projectId: string;
  mapStatus: string;
  lastTaskStatus: string | null;
  failedTaskCount: number;
  blockedTaskCount: number;
  staleKnowledgeCount: number;
  openConflictCount: number;
  pendingApprovalCount: number;
  status: ProjectHealthStatus;
  reasons: string[];
  evidenceReferences: string[];
}

export interface ServiceHealth {
  service: string;
  status: ServiceHealthStatus;
  lastCheck: string;
  reason: string | null;
  evidenceReference: string;
}

export type ApprovalSourceType = 'TASK_RUNTIME' | 'GOAL_PLANNER' | 'KNOWLEDGE_CONFIRMATION' | 'CONFLICT_RESOLUTION';

export interface PendingApprovalItem {
  id: string;
  sourceType: ApprovalSourceType;
  sourceId: string;
  title: string;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high';
  projectId: string | null;
  goalId: string | null;
  requestedAt: string;
  expiresAt: string | null;
  evidenceReferences: string[];
}

export interface FocusBlockSuggestion {
  start: string;
  end: string;
  durationMinutes: number;
  taskIds: string[];
  goalIds: string[];
  reason: string;
  confidence: number;
  constraints: string[];
  evidenceReferences: string[];
}

export interface DailyOperatingBrief {
  id: string;
  date: string;
  timezone: string;
  version: number;
  facts: string[];
  meetings: CalendarEventContext[];
  deadlines: Array<{ summary: string; dueAt: string; sourceId: string }>;
  activeGoals: Array<{ id: string; title: string; status: string; priority: number }>;
  priorityTasks: Array<{ id: string; status: string; projectId: string | null }>;
  pendingApprovals: PendingApprovalItem[];
  followUps: FollowUpCandidate[];
  projectHealth: ProjectHealth[];
  serviceHealth: ServiceHealth[];
  relevantMemory: Array<{ id: string; kind: string; title: string; summary: string }>;
  relevantKnowledge: Array<{ statement: string; citations: Citation[]; isStale?: boolean }>;
  knowledgeCitations: Citation[];
  focusWindows: FocusBlockSuggestion[];
  blockers: string[];
  risks: string[];
  suggestions: string[];
  unknowns: string[];
  confirmationRequests: Array<{ id: string; title: string; kind: string; type: string }>;
  conflicts: unknown[];
  evidenceReferences: string[];
  generatedAt: string;
  refreshedAt: string | null;
}

export type DailyPlanStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PlanTaskRef {
  id: string;
  kind: 'FIXED' | 'FLEXIBLE' | 'OPTIONAL';
  title: string;
  reason: string;
  tier: 'high' | 'medium' | 'low';
  sourceId: string | null;
  sourceType: 'TASK' | 'GOAL' | 'MEETING' | 'DEADLINE' | 'FOLLOW_UP' | 'SUGGESTION';
}

export interface DailyPlan {
  id: string;
  date: string;
  timezone: string;
  briefId: string;
  objective: string;
  selectedGoals: string[];
  selectedTasks: PlanTaskRef[];
  proposedOrder: string[];
  dependencies: Array<{ taskId: string; dependsOnTaskId: string }>;
  focusBlocks: FocusBlockSuggestion[];
  meetings: unknown[];
  requiredApprovals: string[];
  risks: string[];
  successCriteria: string[];
  evidenceReferences: string[];
  status: DailyPlanStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyRefresh {
  id: string;
  date: string;
  previousBriefId: string;
  changedFacts: string[];
  newRisks: string[];
  resolvedBlockers: string[];
  newFollowUps: unknown[];
  planAdjustments: string[];
  suggestions: string[];
  generatedAt: string;
}

export interface EndOfDayReview {
  id: string;
  date: string;
  planId: string | null;
  plannedItems: PlanTaskRef[];
  completedItems: Array<{ id: string; title: string; evidenceReference: string }>;
  incompleteItems: PlanTaskRef[];
  blockedItems: PlanTaskRef[];
  failedItems: Array<{ id: string; title: string; reason: string; evidenceReference: string }>;
  decisions: string[];
  lessons: string[];
  recurringIssues: string[];
  knowledgeCandidates: Array<{ kind: string; title: string; summary: string; evidenceReferences: string[]; needsConfirmation: boolean }>;
  unresolvedFollowUps: unknown[];
  tomorrowSuggestions: string[];
  facts: string[];
  suggestions: string[];
  unknowns: string[];
  evidenceReferences: string[];
  generatedAt: string;
  version: number;
}

export interface WeeklyOperatingReview {
  id: string;
  weekStart: string;
  weekEnd: string;
  goalsProgressed: string[];
  goalsStalled: string[];
  completedTasks: number;
  failedTasks: number;
  blockedTasks: number;
  unresolvedApprovals: number;
  unresolvedFollowUps: unknown[];
  projectHealth: ProjectHealth[];
  serviceHealth: ServiceHealth[];
  recurringIssues: string[];
  knowledgeAdded: number;
  staleKnowledge: number;
  conflicts: unknown[];
  meetingLoad: { meetingCount: number; totalMinutes: number };
  focusTime: { minutes: number };
  lessons: string[];
  suggestedNextWeekPriorities: string[];
  suggestedDeScope: string[];
  facts: string[];
  suggestions: string[];
  unknowns: string[];
  evidenceReferences: string[];
  version: number;
  generatedAt: string;
}

// ── Goals (Phase 5A) ──────────────────────────────────────────────────────
export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface Goal {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  status: GoalStatus;
  targetDate: string | null;
  completedAt: string | null;
  projectIds: string[];
  parentGoalId: string | null;
  successCriteria: string[];
  constraints: string[];
  approvalPolicy?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Task Runtime ──────────────────────────────────────────────────────────
export type TaskStatus =
  | 'CREATED' | 'CONTEXT_BUILDING' | 'PLANNING' | 'WAITING_APPROVAL' | 'READY'
  | 'RUNNING' | 'VALIDATING' | 'RECOVERING' | 'BLOCKED' | 'FAILED' | 'COMPLETED'
  | 'CANCELLED' | 'ROLLED_BACK';

export interface TaskRecord {
  id: string;
  parentTaskId: string | null;
  userRequest: string;
  taskKind?: string;
  projectId: string | null;
  status: TaskStatus;
  approvalState: 'not-required' | 'requested' | 'granted' | 'rejected';
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resultSummary: string | null;
  currentStep?: number;
}

export interface TaskEvent {
  id?: number;
  taskId: string;
  type: string;
  payload?: unknown;
  createdAt: string;
}

// ── Knowledge / Memory (Phase 5A + 5D-1/2) ───────────────────────────────
export type KnowledgeStatus = 'ACTIVE' | 'NEEDS_CONFIRMATION' | 'SUPERSEDED' | 'EXPIRED' | 'DELETED';

export interface KnowledgeRecord {
  id: string;
  kind: string;
  title: string;
  summary: string;
  scope?: string;
  provenance?: 'user-stated' | 'confirmed' | 'inferred' | string;
  confidence?: number;
  source?: string;
  status: KnowledgeStatus;
  projectIds?: string[];
  goalIds?: string[];
  taskIds?: string[];
  lastConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Citation {
  documentId: string;
  chunkId: string;
  sourceUri: string;
  headingPath?: string[];
  lineStart?: number | null;
  lineEnd?: number | null;
  excerpt: string;
  documentChecksum?: string;
  chunkContentHash?: string;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  sourceUri: string;
  type?: string;
  projectIds: string[];
  version: number;
  status: 'ACTIVE' | 'STALE' | 'SUPERSEDED' | 'REJECTED' | 'DELETED';
  checksum: string;
  indexedAt: string;
  sizeBytes?: number;
}

export interface KnowledgePackItem {
  factType: 'FACT' | 'SYNTHESIS' | 'SUGGESTION' | 'UNKNOWN';
  statement: string;
  citations: Citation[];
  score?: number;
  isStale?: boolean;
}

export interface KnowledgePack {
  queryId: string;
  query: { text: string; projectIds: string[]; includeStale?: boolean };
  generatedAt: string;
  items: KnowledgePackItem[];
  conflicts: unknown[];
  warnings: string[];
  unknown: boolean;
}

// ── Calendar / Email (Phase 5C) ──────────────────────────────────────────
export interface CalendarEventContext {
  eventId: string;
  calendarId: string;
  title: string;
  start: string;
  end: string;
  timezone: string;
  allDay: boolean;
  attendees: Array<{ email: string; displayName: string | null; responseStatus: string; organizer: boolean }>;
  organizer: string | null;
  location: string | null;
  descriptionSummary: string;
  status: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED';
  recurrence: string[];
  recurringEventId: string | null;
  visibility: 'default' | 'public' | 'private';
  projectIds: string[];
  goalIds: string[];
  evidenceReference: string;
}

export interface EmailContext {
  messageId: string;
  threadId: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  receivedAt: string;
  labels: string[];
  bodySummary: string;
  attachmentMetadata: Array<{ filename: string; mimeType: string; sizeBytes: number }>;
  projectIds: string[];
  goalIds: string[];
  evidenceReference: string;
}

export interface FollowUpCandidate {
  id: string;
  kind: string;
  summary: string;
  sourceId: string;
  sourceType: 'EMAIL' | 'CALENDAR';
  reason: string;
  confidence: number;
  dueAt: string | null;
  projectIds: string[];
  goalIds: string[];
  linkConfidence: string;
  evidenceReference: string;
  status: 'SUGGESTION' | 'WAITING_APPROVAL';
  createdAt: string;
}

// ── Project Registry ──────────────────────────────────────────────────────
export interface ProjectRecord {
  id: string;
  displayName: string;
  gitRoot?: string | null;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
  owner?: string | null;
  businessPurpose?: string | null;
  mapStatus: 'FRESH' | 'STALE' | 'PARTIAL' | 'FAILED' | 'NOT_GENERATED';
  updatedAt?: string;
}

// ── Coding ─────────────────────────────────────────────────────────────────
export interface CodingTaskSummary {
  id: string;
  status: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectorStatusInfo {
  status: 'READY' | 'NOT_CONFIGURED' | 'TOKEN_EXPIRED' | 'INSUFFICIENT_SCOPE';
  grantedScopes?: string[];
  detail?: string;
}

// ── Controlled Actions (Phase 5F) ─────────────────────────────────────────
export type ActionRiskClass = 'R0' | 'R1' | 'R2' | 'R3' | 'R4';
export type ActionProposalStatus = 'DRAFT' | 'WAITING_APPROVAL' | 'APPROVED' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'RECOVERY_REQUIRED';

export interface ActionPreview {
  kind: 'EMAIL' | 'CALENDAR' | 'LOCAL_TASK' | 'CODING' | 'GENERIC';
  text: string;
  fields: Record<string, string | string[] | number | boolean | null>;
}

export interface ActionProposal {
  id: string;
  actionType: string;
  riskClass: ActionRiskClass;
  title: string;
  description: string;
  reason: string;
  projectId: string | null;
  targetSystem: string;
  requestedOperation: string;
  normalizedPayload: Record<string, unknown>;
  payloadHash: string;
  preview: ActionPreview;
  sideEffects: string[];
  rollbackPlan: string;
  requiredApprovals: number;
  status: ActionProposalStatus;
  evidenceReferences: string[];
  safeFailure: boolean;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  executedAt: string | null;
  rejectedAt: string | null;
  failureCode: string | null;
}

export interface ActionApproval {
  id: string;
  proposalId: string;
  approver: string;
  decision: 'APPROVE' | 'REJECT';
  payloadHash: string;
  actionType: string;
  targetSystem: string;
  targetSummary: string;
  riskAcknowledgement: string;
  approvedAt: string;
  expiresAt: string;
  source: string;
}

export interface ActionExecution {
  id: string;
  proposalId: string;
  approvalId: string;
  status: 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'RECOVERY_REQUIRED';
  providerMode: 'fixture' | 'sandbox' | 'live';
  providerResponseSummary: Record<string, unknown>;
  externalObjectId: string | null;
  failureCode: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface ActionEvidence {
  id: string;
  proposalId: string;
  eventType: string;
  summary: string;
  payloadHash: string | null;
  actor: string;
  createdAt: string;
}

export interface ActionDetail {
  proposal: ActionProposal;
  approval: ActionApproval | null;
  executions: ActionExecution[];
  evidence: ActionEvidence[];
  compensations: Array<{ id: string; description: string; available: boolean; requiresNewApproval: boolean; status: string }>;
  governance: {
    latestDecision: PolicyDecision | null;
    anomalies: GovernanceAnomaly[];
    budgets: ActionBudget[];
    killSwitches: KillSwitch[];
  };
}

export type ApprovalLevel = 'NONE' | 'STANDARD' | 'STRONG' | 'DUAL_CONFIRMATION';
export type PolicyDecisionResult = 'ALLOW' | 'REQUIRE_APPROVAL' | 'REQUIRE_STRONG_APPROVAL' | 'DENY' | 'BLOCK_BUDGET' | 'BLOCK_CONTEXT' | 'BLOCK_KILL_SWITCH';

export interface PolicyDecision {
  id: string;
  proposalId: string;
  actionType: string;
  projectId: string | null;
  riskClass: ActionRiskClass;
  decision: PolicyDecisionResult;
  requiredApprovalLevel: ApprovalLevel;
  reasons: string[];
  matchedPolicies: string[];
  deniedPolicies: string[];
  budgetState: { blocked: boolean; budgetId: string | null; remainingExecutions: number | null; reason: string | null };
  killSwitchState: { blocked: boolean; switches: KillSwitch[] };
  contextualConstraints: { staleReasons: string[] };
  evaluatedAt: string;
  policyVersion: string;
  inputHash: string;
  decisionHash: string;
}

export interface ActionBudget {
  id: string;
  scope: string;
  projectId: string | null;
  actionType: string | null;
  period: string;
  maxExecutions: number;
  currentUsage: { executions: number; proposals: number; approvals: number; externalTargets: number };
  resetsAt: string;
  enabled: boolean;
}

export interface KillSwitch {
  id: string;
  scope: string;
  projectId: string | null;
  actionType: string | null;
  enabled: boolean;
  reason: string;
  activatedAt: string;
  expiresAt: string | null;
}

export interface GovernanceAnomaly {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  proposalId: string | null;
  projectId: string | null;
  description: string;
  detectedAt: string;
  status: string;
}

export interface GovernanceStatus {
  pendingActions: number;
  actionsExecutedToday: number;
  blockedByPolicy: number;
  blockedByBudget: number;
  anomalies: number;
  currentGlobalPolicy: { id: string; version: string; contentHash: string; status: string } | null;
  killSwitchState: { active: boolean; switches: KillSwitch[] };
  budgets: ActionBudget[];
}

// Phase 6A — Authority Control Plane
export type AuthorityClass =
  | 'CANONICAL_READ'
  | 'CANONICAL_LOCAL_MUTATION'
  | 'CANONICAL_CONTROLLED_ACTION'
  | 'CANONICAL_GOVERNED_ORCHESTRATION'
  | 'CANONICAL_DELEGATED_AUTHORITY'
  | 'ADAPTER_TO_CANONICAL'
  | 'LEGACY_QUARANTINED'
  | 'FORBIDDEN'
  | 'INTERNAL_TEST_ONLY';

export type EffectClass =
  | 'READ_ONLY'
  | 'LOCAL_REVERSIBLE'
  | 'LOCAL_IRREVERSIBLE'
  | 'EXTERNAL_REVERSIBLE'
  | 'EXTERNAL_IRREVERSIBLE'
  | 'PROCESS_CONTROL'
  | 'CODE_EXECUTION'
  | 'SERVICE_CONTROL';

export interface AuthoritySurface {
  id: string;
  kind: string;
  sourcePath: string;
  runtimeMount: string;
  method: string;
  capability: string;
  effectClass: EffectClass;
  authorityClass: AuthorityClass;
  canonicalOwner: string;
  projectScoped: boolean;
  externalSystem: string | null;
  approvalRequired: boolean;
  governanceRequired: boolean;
  delegationEligible: boolean;
  authenticationRequired: string;
  status: string;
  legacyReason: string | null;
  migrationTarget: string | null;
  phase6bDisposition?: string | null;
  adapterTarget?: string | null;
  quarantineHandler?: string | null;
  canonicalReplacement?: string | null;
  lastAuthorityEvidence?: string | null;
  evidence: string[];
}

export interface AuthorityManifest {
  generatedAt: string;
  version: string;
  surfaces: AuthoritySurface[];
  counts: {
    total: number;
    readOnly: number;
    mutations: number;
    canonical: number;
    adapters: number;
    quarantined: number;
    forbidden: number;
    internalTest: number;
    unknownMutations: number;
    legacyMutations?: number;
    adaptedLegacy?: number;
    quarantinedLegacy?: number;
    disabledDeadLegacy?: number;
    unresolvedLegacyMutations?: number;
  };
}

// Phase 5H — Governed Multi-Step Action Planning. ActionPlan/ActionPlanStep are a
// distinct concept from Phase 5D-3's DailyPlan (see PlanPage.tsx / /today/plan) —
// that is a read-only daily-agenda summary; this is an executable, governed,
// multi-step action DAG. Sharing the English word "plan" only.
export type ActionPlanStatus = 'DRAFT' | 'VALIDATED' | 'WAITING_APPROVAL' | 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ActionPlanStepType = 'READ_ONLY' | 'LOCAL_COMPUTE' | 'CONTROLLED_ACTION';
export type ActionPlanStepStatus = 'PENDING' | 'BLOCKED' | 'READY' | 'RUNNING' | 'WAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'RECONCILIATION_REQUIRED';

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

export interface ActionPlanStep {
  id: string;
  planId: string;
  stepIndex: number;
  key: string;
  type: ActionPlanStepType;
  description: string;
  projectId: string | null;
  dependsOnStepIds: string[];
  sideEffectClass: 'NONE' | 'LOCAL' | 'EXTERNAL';
  actionType: string | null;
  riskClass: string | null;
  requiredApprovalLevel: string | null;
  proposalId: string | null;
  status: ActionPlanStepStatus;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ActionPlanEvidence {
  id: string;
  planId: string;
  stepId: string | null;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export interface PlanValidationResult {
  valid: boolean;
  issues: Array<{ code: string; message: string; stepKey?: string }>;
  topologicalOrder: string[];
}

// Phase 5I — DelegatedAuthority. Distinct from ActionPlan (workflow structure) and
// from a single Controlled Action approval (one action). A delegation pre-authorizes
// a tightly bounded CLASS of actions in advance; it is never itself an approval of
// any specific action, and plan/action approval semantics are unchanged by its
// existence — see docs/architecture/PHASE5I_DELEGATED_AUTHORITY.md.
export type DelegatedAuthorityStatus =
  | 'DRAFT' | 'WAITING_APPROVAL' | 'ACTIVE' | 'PAUSED' | 'PAUSED_POLICY_CHANGED'
  | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED' | 'CANCELLED';

export interface DelegationTargetRestriction {
  allowedDomains?: string[];
  allowedContactIds?: string[];
  projectLinkedContactsOnly?: boolean;
  maxRecipients?: number;
  calendarId?: string;
  maxAttendees?: number;
  maxDurationMinutes?: number;
  allowedHours?: { startHour: number; endHour: number };
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
  allowedActionTypes: string[];
  deniedActionTypes: string[];
  targetRestriction: DelegationTargetRestriction;
  riskCeiling: string;
  approvalLevelCeiling: string;
  startsAt: string;
  expiresAt: string;
  timezone: string;
  maxExecutions: number;
  usedExecutions: number;
  maxTargets: number | null;
  usedTargets: number;
  policyVersion: string | null;
  policyHash: string | null;
  createdAt: string;
  approvedAt: string | null;
  activatedAt: string | null;
  revokedAt: string | null;
  exhaustedAt: string | null;
  expiredAt: string | null;
  pausedReason: string | null;
}

export interface DelegationEvidenceEvent {
  id: string;
  delegationId: string;
  proposalId: string | null;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown>;
  actor: string;
  createdAt: string;
}

export interface DelegationDecisionRecord {
  id: string;
  delegationId: string;
  proposalId: string;
  actionType: string;
  eligible: boolean;
  reasons: string[];
  evaluatedAt: string;
}
