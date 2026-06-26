/**
 * Phase 0 — Executive Coordination Division Types
 * 
 * Single source of truth for all coordination data structures.
 * Every engine in this directory imports from here.
 */

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
