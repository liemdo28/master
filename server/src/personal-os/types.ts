export type PreferenceStatus = 'ACTIVE' | 'NEEDS_CONFIRMATION' | 'SUPERSEDED' | 'DELETED';
export type GoalStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type PriorityStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'DISMISSED';

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
}

export interface GoalPlan {
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
  createdAt: string;
}
