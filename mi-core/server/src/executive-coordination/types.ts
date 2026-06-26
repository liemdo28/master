/**
 * Phase 0 — Executive Coordination Division Types
<<<<<<< a471ef81
 *
=======
 * 
>>>>>>> origin/seo/phase-29-revenue-execution-loop
 * Single source of truth for all coordination data structures.
 * Every engine in this directory imports from here.
 */

<<<<<<< a471ef81
// ── Objective ──────────────────────────────────────────────────────────────
export type ObjectiveStatus =
  | 'DRAFT' | 'ACCEPTED' | 'PLANNING' | 'IN_PROGRESS'
  | 'BLOCKED' | 'WAITING_APPROVAL' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface Objective {
  id: string;
  title: string;
  description: string;
  source: string;
  requestedBy: string;
  ownerExecutive: string;
  primaryDivision: string;
  supportingDivisions: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: ObjectiveStatus;
  businessGoal: string;
  expectedImpact: string;
  createdAt: string;
  updatedAt: string;
  targetDate: string | null;
  closedAt: string | null;
  evidenceRequired: boolean;
  approvalRequired: boolean;
  linkedTasks: string[];
  linkedReports: string[];
}

// ── Task ───────────────────────────────────────────────────────────────────
export type TaskStatus =
  | 'NEW' | 'TRIAGED' | 'ASSIGNED' | 'IN_PROGRESS'
  | 'WAITING_DEPENDENCY' | 'WAITING_APPROVAL' | 'BLOCKED'
  | 'DONE' | 'CANCELLED' | 'FAILED' | 'DUPLICATE';

export type TaskSeverity = 'critical' | 'high' | 'medium' | 'low';
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface Task {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  source: string;
  division: string;
  owner: string;
  assignee: string;
  status: TaskStatus;
  priority: TaskPriority;
  severity: TaskSeverity;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  dependencyIds: string[];
  duplicateOf: string | null;
  conflictWith: string[];
  evidenceIds: string[];
  approvalId: string | null;
  executionLog: ExecutionLogEntry[];
  resultSummary: string | null;
  evidenceRequired: boolean;
  approvalRequired: boolean;
}

export interface ExecutionLogEntry {
  timestamp: string;
  action: string;
  from: TaskStatus;
  to: TaskStatus;
  actor: string;
  note: string;
}

// ── Ownership ──────────────────────────────────────────────────────────────
export interface OwnershipRule {
  division: string;
  keywords: string[];
  domains: string[];
  description: string;
}

export interface OwnershipResolution {
  taskText: string;
  resolvedDivision: string;
  confidence: number;
  matchedKeywords: string[];
  fallback: boolean;
}

// ── Duplicate Detection ────────────────────────────────────────────────────
export interface DuplicateCheck {
  existingTaskId: string;
  newTaskTitle: string;
  confidence: number;
  matchSignals: string[];
}

export interface DuplicateRecord {
  id: string;
  originalTaskId: string;
  duplicateTaskId: string;
  confidence: number;
  action: 'linked' | 'merged' | 'ignored' | 'review_required';
  createdAt: string;
}

// ── Dependency Graph ───────────────────────────────────────────────────────
export type DependencyType =
  | 'blocks' | 'depends_on' | 'related_to' | 'duplicates'
  | 'conflicts_with' | 'requires_approval' | 'requires_credentials'
  | 'requires_human' | 'produces_evidence' | 'triggers';

export interface DependencyEdge {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
  createdAt: string;
}

export interface BlockerInfo {
  taskId: string;
  blockedBy: string[];
  reason: string;
}

// ── Priority Engine ────────────────────────────────────────────────────────
export const PRIORITY_WEIGHT: Record<string, number> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
};

export interface PriorityResult {
  priority: TaskPriority;
  score: number;
  reason: string;
}

// ── Conflict Engine ────────────────────────────────────────────────────────
export type ConflictType =
  | 'resource_contention' | 'simultaneous_modify'
  | 'dependency_cycle' | 'approval_conflict'
  | 'contradictory_objective' | 'same_deployment_target'
  | 'same_workflow_target' | 'production_freeze';

export interface ConflictRecord {
  id: string;
  taskIds: string[];
  conflictType: ConflictType;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  blockedTaskId: string | null;
  resolved: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

// ── Approval Registry ──────────────────────────────────────────────────────
export type ApprovalType =
  | 'code_merge' | 'production_deploy' | 'credential_use'
  | 'financial_action' | 'payroll_action' | 'marketing_publish'
  | 'review_response' | 'doordash_campaign_change'
  | 'website_content_publish' | 'data_export';

export type ApprovalStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

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

// ── Evidence Registry ──────────────────────────────────────────────────────
export type EvidenceType =
  | 'git_commit' | 'pull_request' | 'screenshot' | 'curl_output'
  | 'api_response' | 'log_file' | 'test_result' | 'report'
  | 'database_snapshot' | 'workflow_execution' | 'browser_recording'
  | 'deployment_proof' | 'rollback_plan';

export interface EvidenceRecord {
  id: string;
  taskId: string;
  objectiveId: string | null;
  evidenceType: EvidenceType;
  title: string;
  source: string;
  filePath: string | null;
  url: string | null;
  hash: string | null;
  createdAt: string;
  createdBy: string;
  verified: boolean;
  verificationMethod: string | null;
}

// ── Division Router ────────────────────────────────────────────────────────
export interface DivisionDefinition {
  id: string;
  name: string;
  domains: string[];
  keywords: string[];
  parentDivision: string | null;
}

export interface RouteResult {
  division: string;
  confidence: number;
  matchedKeywords: string[];
  supportingDivisions: string[];
}

// ── Execution State Machine ────────────────────────────────────────────────
export interface StateTransition {
  from: TaskStatus;
  to: TaskStatus;
  requires: string[];
}

export interface TransitionResult {
  success: boolean;
  from: TaskStatus;
  to: TaskStatus;
  timestamp: string;
  reason: string;
}

// ── Dashboard ──────────────────────────────────────────────────────────────
export interface DashboardSnapshot {
  timestamp: string;
  objectives: { total: number; active: number; completed: number; blocked: number };
  tasks: { total: number; active: number; blocked: number; completed: number; duplicate: number };
  conflicts: { total: number; unresolved: number };
  approvals: { total: number; pending: number; approved: number; rejected: number };
  evidence: { total: number; verified: number; missing: number };
  divisionLoad: Record<string, number>;
  priorityQueue: Task[];
  recentCompleted: Task[];
  atRiskObjectives: Objective[];
}
=======
// ── Divisions ──────────────────────────────────────────────────────────────

export type Division =
  | 'engineering'
  | 'computer-operator'
  | 'finance'
  | 'marketing'
  | 'it'
  | 'creative'
  | 'seo'
  | 'operations';

// ── Priority ───────────────────────────────────────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  P0: 4,  // Revenue-critical / production down
  P1: 3,  // High business impact
  P2: 2,  // Normal work
  P3: 1,  // Nice-to-have / documentation
};

// ── Task Status ────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in-progress'
  | 'blocked'
  | 'awaiting-approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── Approval Type ──────────────────────────────────────────────────────────

export type ApprovalType =
  | 'deploy'
  | 'merge'
  | 'financial'
  | 'payroll'
  | 'credentials'
  | 'none';

// ── Coordinated Task ───────────────────────────────────────────────────────

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

// ── Evidence Reference ─────────────────────────────────────────────────────

export interface EvidenceRef {
  type: 'pr' | 'commit' | 'log' | 'screenshot' | 'api-output' | 'test-result';
  url: string;
  capturedAt: string;
}

// ── Duplicate Match ────────────────────────────────────────────────────────

export interface DuplicateMatch {
  taskA: string;
  taskB: string;
  similarity: number;   // 0-1
  reason: string;
}

// ── Conflict ───────────────────────────────────────────────────────────────

export interface TaskConflict {
  taskA: string;
  taskB: string;
  conflictType: 'simultaneous-modify' | 'resource-contention' | 'dependency-cycle';
  description: string;
}

// ── Dependency Edge ────────────────────────────────────────────────────────

export interface DependencyEdge {
  from: string;   // task ID that must complete first
  to: string;     // task ID that depends on it
}

// ── Dashboard Data ─────────────────────────────────────────────────────────

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

// ── Task Source (for unified registry) ─────────────────────────────────────

export type TaskSource = 'objective-engine' | 'auto-task-engine' | 'manual' | 'signal';
>>>>>>> origin/seo/phase-29-revenue-execution-loop
