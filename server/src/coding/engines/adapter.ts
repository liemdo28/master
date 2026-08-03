import type { CandidateSelection, CodingModelRoles, EngineApplyResult, EnginePlan } from '../types';

export interface CodingEngineAdapter {
  id: string;
  inspect(input: { worktreePath: string; candidates: CandidateSelection; userRequest: string }): Promise<{ filesRead: string[] }>;
  plan(input: { worktreePath: string; candidates: CandidateSelection; userRequest: string; modelRoles: CodingModelRoles }): Promise<EnginePlan>;
  apply(input: { worktreePath: string; plan: EnginePlan; userRequest: string; signal?: AbortSignal }): Promise<EngineApplyResult>;
  continue(input: { worktreePath: string; plan: EnginePlan; attempt: number; validationSummary: string }): Promise<EngineApplyResult>;
  cancel(taskId: string): Promise<void>;
  status(taskId: string): Promise<{ running: boolean }>;
  collectEvidence(worktreePath: string): Promise<Record<string, unknown>>;
}
