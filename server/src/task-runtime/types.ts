// Mi Personal OS — canonical task runtime (Phase 1 vertical slice).
// New, additive module. Does not modify gstack/, council/, autonomous/ (Approval Engine),
// or the /api/execution-package contract — see CLAUDE.md "Critical Rules".

export type TaskStatus =
  | 'CREATED'
  | 'CONTEXT_BUILDING'
  | 'PLANNING'
  | 'WAITING_APPROVAL'
  | 'READY'
  | 'RUNNING'
  | 'VALIDATING'
  | 'RECOVERING'
  | 'BLOCKED'
  | 'FAILED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ROLLED_BACK';

// Transitions allowed out of each status. Anything not listed here is rejected
// by the engine so a task can't silently skip states (e.g. CREATED -> COMPLETED).
export const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  CREATED: ['CONTEXT_BUILDING', 'CANCELLED'],
  CONTEXT_BUILDING: ['PLANNING', 'BLOCKED', 'FAILED', 'CANCELLED'],
  PLANNING: ['WAITING_APPROVAL', 'READY', 'BLOCKED', 'FAILED', 'CANCELLED'],
  WAITING_APPROVAL: ['READY', 'CANCELLED', 'BLOCKED'],
  READY: ['RUNNING', 'CANCELLED'],
  RUNNING: ['VALIDATING', 'BLOCKED', 'FAILED', 'RECOVERING', 'CANCELLED'],
  VALIDATING: ['COMPLETED', 'FAILED', 'RECOVERING'],
  RECOVERING: ['RUNNING', 'FAILED', 'ROLLED_BACK'],
  BLOCKED: ['PLANNING', 'CANCELLED', 'FAILED'],
  FAILED: ['ROLLED_BACK', 'RECOVERING'],
  COMPLETED: [],
  CANCELLED: [],
  ROLLED_BACK: [],
};

export interface TaskRecord {
  id: string;
  parentTaskId: string | null;
  userRequest: string;
  normalizedIntent: string | null;
  taskKind: 'general' | 'coding';
  projectId: string | null;
  mapVersion: string | null;
  contextPackId: string | null;
  repository: string | null;
  workingDirectory: string | null;
  branch: string | null;
  baseBranch: string | null;
  baseCommit: string | null;
  taskBranch: string | null;
  worktreePath: string | null;
  codingEngine: string | null;
  modelRoles: string | null;
  candidateFiles: string | null;
  filesRead: string | null;
  filesChanged: string | null;
  validationPlan: string | null;
  validationResults: string | null;
  retryCount: number;
  maxRetries: number;
  reviewStatus: string | null;
  commitPolicy: string | null;
  commitSha: string | null;
  rollbackState: string | null;
  status: TaskStatus;
  riskLevel: 'read-only' | 'local-reversible' | 'reversible-external' | 'approved-external';
  approvalState: 'not-required' | 'requested' | 'granted' | 'rejected';
  executionEngine: string | null;
  selectedModel: string | null;
  plan: string | null;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  resultSummary: string | null;
}

export interface TaskEvent {
  id: number; // autoincrement
  taskId: string;
  type: string; // e.g. 'task.created', 'task.status_changed', 'command.completed'
  detail: string; // JSON-stringified payload
  createdAt: string;
}

export interface CreateTaskInput {
  userRequest: string;
  parentTaskId?: string | null;
  taskKind?: TaskRecord['taskKind'];
  projectId?: string | null;
  mapVersion?: string | null;
  contextPackId?: string | null;
  repository?: string | null;
  workingDirectory?: string | null;
  branch?: string | null;
  riskLevel?: TaskRecord['riskLevel'];
  baseBranch?: string | null;
  baseCommit?: string | null;
  maxRetries?: number;
}
