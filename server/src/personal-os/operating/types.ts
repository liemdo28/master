/**
 * Phase 5D-3 — Daily Operating Loop contracts.
 *
 * Everything here is a read model built from data Mi already has (Task Runtime,
 * Personal OS goals/knowledge/memory, Phase 5C read-only Gmail/Calendar intelligence,
 * Phase 5D-2 KnowledgePack, Project Registry, SelfHeal read-only probes). Nothing in
 * this module writes to an external system, executes a task, or activates a plan —
 * the only thing a caller can do with a DailyPlan is move it between DRAFT/APPROVED/
 * ACTIVE/COMPLETED/CANCELLED, which changes a status column and nothing else.
 */

/** See docs/architecture/PHASE5D3_DAILY_OPERATING_LOOP.md#truth-priority for the full
 *  policy. Enforced structurally: ServiceHealth/ProjectHealth are always read live and
 *  never overwritten by a knowledge- or memory-derived claim; a genuine disagreement
 *  between two knowledge sources is surfaced via `conflicts`, never resolved silently. */
export const TRUTH_PRIORITY = [
  'LIVE_SYSTEM_STATE',
  'LIVE_PROJECT_TASK_STATE',
  'EXPLICIT_RECENT_USER_DECISION',
  'CONFIRMED_KNOWLEDGE',
  'CONFIRMED_MEMORY',
  'INFERRED_KNOWLEDGE',
  'SUGGESTION',
] as const;
export type TruthPriorityLevel = typeof TRUTH_PRIORITY[number];

export type OperatingLoopPhase = 'MORNING' | 'MIDDAY' | 'EVENING' | 'WEEKLY';

export const OPERATING_BOUNDS = {
  maxPriorities: 10,
  maxRecommendedNextActions: 5,
  maxBlockers: 5,
  maxConfirmationRequests: 5,
  maxPlanTasks: 10,
  maxPlanGoals: 5,
} as const;

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

export type ProjectHealthStatus = 'HEALTHY' | 'ATTENTION' | 'BLOCKED' | 'UNKNOWN';

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
  status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
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

export interface DailyOperatingBrief {
  id: string;
  date: string;
  timezone: string;
  version: number;
  facts: string[];
  meetings: unknown[];
  deadlines: unknown[];
  activeGoals: unknown[];
  priorityTasks: unknown[];
  pendingApprovals: PendingApprovalItem[];
  followUps: unknown[];
  projectHealth: ProjectHealth[];
  serviceHealth: ServiceHealth[];
  relevantMemory: unknown[];
  relevantKnowledge: unknown[];
  knowledgeCitations: unknown[];
  focusWindows: FocusBlockSuggestion[];
  blockers: string[];
  risks: string[];
  suggestions: string[];
  unknowns: string[];
  confirmationRequests: unknown[];
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
  knowledgeCandidates: KnowledgeCandidate[];
  unresolvedFollowUps: unknown[];
  tomorrowSuggestions: string[];
  facts: string[];
  suggestions: string[];
  unknowns: string[];
  evidenceReferences: string[];
  generatedAt: string;
  version: number;
}

export type KnowledgeCandidateKind =
  | 'LESSON_LEARNED' | 'WORKFLOW_CONVENTION' | 'DECISION' | 'RECURRING_ISSUE'
  | 'PROJECT_RISK' | 'TROUBLESHOOTING_RESULT';

export interface KnowledgeCandidate {
  kind: KnowledgeCandidateKind;
  title: string;
  summary: string;
  evidenceReferences: string[];
  needsConfirmation: boolean;
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

export interface OperatingLoopRun {
  id: string;
  phase: OperatingLoopPhase;
  date: string;
  operationId: string;
  resultId: string;
  contentHash: string;
  createdAt: string;
}
