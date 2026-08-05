export type PreferenceStatus = 'ACTIVE' | 'NEEDS_CONFIRMATION' | 'SUPERSEDED' | 'DELETED';
export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type PriorityStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DISMISSED';
export type KnowledgeKind =
  | 'USER_FACT' | 'USER_PREFERENCE' | 'PROJECT_CONVENTION' | 'ARCHITECTURE_DECISION'
  | 'WORKFLOW' | 'LESSON_LEARNED' | 'RECURRING_ISSUE' | 'DECISION'
  | 'CONTACT_CONTEXT' | 'REFERENCE' | 'SUMMARY';
export type KnowledgeStatus = 'ACTIVE' | 'NEEDS_CONFIRMATION' | 'SUPERSEDED' | 'EXPIRED' | 'DELETED';
export type KnowledgeSensitivity = 'PUBLIC' | 'INTERNAL' | 'PRIVATE' | 'SECRET_REJECTED';
export type KnowledgeSourceType =
  | 'USER_STATEMENT' | 'PREFERENCE' | 'TASK_SUMMARY' | 'GOAL_OUTCOME'
  | 'PROJECT_DECISION' | 'VALIDATION_REVIEW' | 'MANUAL_IMPORT' | 'INFERRED';
export type MemoryPolicy = 'PERSONAL_ONLY' | 'PROJECT_ONLY' | 'PERSONAL_AND_PROJECT' | 'NO_MEMORY' | 'CONFIRMATION_REQUIRED';

export interface UserPreference {
  id: string;
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: 'USER_STATED' | 'MODEL_INFERRED' | 'SYSTEM';
  scope: string;
  createdAt: string;
  updatedAt: string;
  lastConfirmedAt: string | null;
  status: PreferenceStatus;
  provenance: string;
}

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
  approvalPolicy: 'approval-required' | 'manual-only';
  createdAt: string;
  updatedAt: string;
}

export interface PriorityItem {
  id: string;
  goalId: string;
  taskId: string | null;
  reason: string;
  urgency: number;
  importance: number;
  dueAt: string | null;
  status: PriorityStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DailyBrief {
  id: string;
  date: string;
  generatedAt: string;
  activeGoals: unknown[];
  activeProjects: unknown[];
  pendingTasks: unknown[];
  pendingApprovals: unknown[];
  recentFailures: unknown[];
  recentSuccesses: unknown[];
  systemAlerts: unknown[];
  recommendedNextActions: Array<{ label: string; reason: string; type: 'suggestion' }>;
  evidenceReferences: string[];
  facts: string[];
  suggestions: string[];
  unknowns: string[];
  confirmedMemory?: unknown[];
  confirmationRequests?: unknown[];
}

export interface GoalPlan {
  planId: string;
  version: number;
  goalId: string;
  objective: string;
  assumptions: string[];
  milestones: string[];
  proposedTasks: Array<{ id: string; title: string; risk: string; approvalRequired: boolean }>;
  dependencies: string[];
  risks: string[];
  approvalsRequired: string[];
  successCriteria: string[];
  estimatedResourceClass: 'small' | 'medium';
  nextRecommendedAction: string;
  memoryReferences?: string[];
  conflicts?: unknown[];
  createdAt: string;
}

export interface KnowledgeRecord {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  content: string;
  scope: MemoryPolicy;
  projectIds: string[];
  goalIds: string[];
  taskIds: string[];
  tags: string[];
  sourceType: KnowledgeSourceType;
  provenance: string;
  confidence: number;
  sensitivity: KnowledgeSensitivity;
  status: KnowledgeStatus;
  validFrom: string | null;
  validUntil: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  supersedesId: string | null;
  evidenceReferences: string[];
  contentHash: string;
}

export interface KnowledgeSearchInput {
  query: string;
  projectIds?: string[];
  goalId?: string | null;
  taskId?: string | null;
  kinds?: KnowledgeKind[];
  policy?: MemoryPolicy;
  maxRecords?: number;
  maxBytes?: number;
  includeUnconfirmed?: boolean;
}

export interface KnowledgeSearchResult {
  record: KnowledgeRecord;
  score: number;
  reasons: string[];
  stale: boolean;
}

export interface MemoryPack {
  id: string;
  policy: MemoryPolicy;
  requestIntent: string;
  confirmedPreferences: KnowledgeRecord[];
  relevantUserFacts: KnowledgeRecord[];
  relevantProjectConventions: KnowledgeRecord[];
  relevantArchitectureDecisions: KnowledgeRecord[];
  previousLessons: KnowledgeRecord[];
  recurringIssues: KnowledgeRecord[];
  conflicts: unknown[];
  staleWarnings: string[];
  evidenceReferences: string[];
  retrievalExplanation: string[];
  uncertainRecords: KnowledgeRecord[];
  createdAt: string;
}
