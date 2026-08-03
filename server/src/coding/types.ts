import type { ContextPack, ProjectRecord } from '../project-registry/types';
import type { TaskRecord } from '../task-runtime/types';

export type CodingTaskPhase =
  | 'context'
  | 'worktree'
  | 'candidate_selection'
  | 'model_routing'
  | 'engine_plan'
  | 'engine_apply'
  | 'validation'
  | 'repair'
  | 'review'
  | 'commit'
  | 'completed';

export interface CodingWorkflowInput {
  userRequest: string;
  projectId: string;
  contextPackId?: string | null;
  mapVersion?: string | null;
  baseBranch?: string | null;
  baseCommit?: string | null;
  commitPolicy?: 'local-only' | 'no-commit';
  maxRetries?: number;
  validationCommands?: string[];
}

export interface CodingContext {
  project: ProjectRecord;
  contextPack: ContextPack;
  baseCommit: string;
  baseBranch: string;
}

export interface CandidateFile {
  path: string;
  reason: string;
  relatedTests: string[];
  confidence: number;
}

export interface CandidateSelection {
  candidates: CandidateFile[];
  excluded: string[];
  hardLimit: number;
  maxBytesPerFile: number;
  source: 'context-pack';
}

export interface CodingModelRoles {
  coding_fast: string | null;
  coding_primary: string | null;
  coding_review: string | null;
  locality: 'local-first';
  offlineReady: boolean;
}

export interface EnginePlan {
  engineId: string;
  summary: string;
  filesToRead: string[];
  filesToChange: string[];
  confidence: number;
}

export interface EngineApplyResult {
  engineId: string;
  changedFiles: string[];
  evidence: Record<string, unknown>;
}

export interface ValidationCommand {
  name: string;
  command: string;
  args: string[];
  cwd: string;
  configured: boolean;
}

export interface ValidationResult {
  name: string;
  configured: boolean;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

export interface ReviewResult {
  status: 'PASS' | 'FAIL';
  findings: string[];
}

export interface CodingRunResult {
  task: TaskRecord;
  context: CodingContext;
  candidates: CandidateSelection;
  modelRoles: CodingModelRoles;
  plan: EnginePlan;
  apply: EngineApplyResult;
  validation: ValidationResult[];
  review: ReviewResult;
  commitSha: string | null;
}

export interface CodingEngineRegistryEntry {
  id: string;
  label: string;
  purpose: string;
  status: 'ACTIVE' | 'WRAP_LATER' | 'DEPRECATED';
  repositoryScale: boolean;
}
