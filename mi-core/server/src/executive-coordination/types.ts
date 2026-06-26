// Phase 0 coordination types.
// â”€â”€ Divisions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type Division =
  | 'engineering'
  | 'computer-operator'
  | 'finance'
  | 'marketing'
  | 'it'
  | 'creative'
  | 'seo'
  | 'operations';

// â”€â”€ Priority â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  P0: 4,  // Revenue-critical / production down
  P1: 3,  // High business impact
  P2: 2,  // Normal work
  P3: 1,  // Nice-to-have / documentation
};

// â”€â”€ Task Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'blocked'
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

// â”€â”€ Approval Type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type ApprovalType =
  | 'deploy'
  | 'merge'
  | 'financial'
  | 'payroll'
  | 'credentials'
  | 'code_merge'
  | 'production_deploy'
  | 'credential_use'
  | 'financial_action'
  | 'payroll_action'
  | 'marketing_publish'
  | 'review_response'
  | 'doordash_campaign_change'
  | 'website_content_publish'
  | 'data_export'
  | 'none';

export type ApprovalStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';

// â”€â”€ Coordinated Task â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CoordinatedTask {
  id: string;                // ENG-001, MKT-001, FIN-001, IT-001
  objectiveId: string;       // links to objective-engine
  title: string;
  description: string;
  division: Division;
  owner: string;
  priority: Priority;
  status: TaskStatus;
  dependencies: string[];    // other task IDs
  approvalRequired: ApprovalType;
  evidenceRefs: EvidenceRef[];
  duplicateOf: string | null; // null = original, string = points to canonical task
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type Task = CoordinatedTask;

export interface ApprovalRecord {
  id: string;
  objectiveId: string | null;
  taskId: string | null;
  requestedBy: string;
  approvalType: ApprovalType;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: ApprovalStatus;
  approver: string | null;
  reason: string;
  evidenceIds: string[];
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  expiresAt: string | null;
}

export interface OwnershipRule {
  division: Division | 'executive' | string;
  keywords: string[];
  domains: string[];
  description: string;
}

export interface OwnershipResolution {
  taskText: string;
  resolvedDivision: Division | 'executive' | string;
  confidence: number;
  matchedKeywords: string[];
  fallback: boolean;
}

// â”€â”€ Evidence Reference â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface EvidenceRef {
  type: 'pr' | 'commit' | 'log' | 'screenshot' | 'api-output' | 'test-result';
  url: string;
  capturedAt: string;
}

// â”€â”€ Duplicate Match â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DuplicateMatch {
  taskA: string;
  taskB: string;
  similarity: number;   // 0-1
  reason: string;
}

// â”€â”€ Conflict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TaskConflict {
  taskA: string;
  taskB: string;
  conflictType: 'simultaneous-modify' | 'resource-contention' | 'dependency-cycle';
  description: string;
}

// â”€â”€ Dependency Edge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DependencyEdge {
  from: string;   // task ID that must complete first
  to: string;     // task ID that depends on it
}

// â”€â”€ Dashboard Data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DashboardSnapshot {
  generatedAt: string;
  objectives: DashboardObjective[];
  tasksByDivision: Record<Division, CoordinatedTask[]>;
  blockedTasks: CoordinatedTask[];
  pendingApprovals: CoordinatedTask[];
  duplicates: DuplicateMatch[];
  conflicts: TaskConflict[];
  completedToday: CoordinatedTask[];
  summary: DashboardSummary;
}

export interface DashboardObjective {
  id: string;
  title: string;
  taskCount: number;
  completedCount: number;
  blockedCount: number;
  progress: number; // 0-100
}

export interface DashboardSummary {
  totalObjectives: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  pendingApprovals: number;
  activeConflicts: number;
  activeDuplicates: number;
  overallProgress: number; // 0-100
}

// â”€â”€ Task Source (for unified registry) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type TaskSource = 'objective-engine' | 'auto-task-engine' | 'manual' | 'signal';
