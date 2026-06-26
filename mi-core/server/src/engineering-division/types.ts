/**
 * Phase 1 - Engineering Division Types
 *
 * Mi manages engineering work. Coding providers execute work.
 */

export type CodingProvider = 'qwen' | 'deepseek' | 'claude' | 'gpt' | 'kimi' | 'human';

export type EngineeringTaskStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'EXECUTING'
  | 'REVIEW'
  | 'TESTING'
  | 'PR_READY'
  | 'APPROVAL_REQUIRED'
  | 'DONE'
  | 'FAILED';

export type EvidenceType =
  | 'commit'
  | 'branch'
  | 'pr'
  | 'screenshot'
  | 'log'
  | 'test-output'
  | 'coverage'
  | 'api-output';

export interface ModelProfile {
  provider: CodingProvider;
  model: string;
  strengths: string[];
  weaknesses: string[];
  languages: string[];
  frameworks: string[];
  cost: 'low' | 'medium' | 'high' | 'human';
  latency: 'low' | 'medium' | 'high' | 'human';
  qualityScore: number;
  availability: 'available' | 'limited' | 'unavailable';
}

export interface TaskClassification {
  domain: string;
  language: string;
  framework: string;
  repo: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'low' | 'medium' | 'high';
  productionImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface ModelSelection {
  selected_model: CodingProvider;
  confidence: number;
  reason: string;
}

export interface EngineeringEvidence {
  type: EvidenceType;
  value: string;
  capturedAt: string;
}

export interface ProviderResult {
  provider: CodingProvider;
  status: 'not-run' | 'executed' | 'failed' | 'human-required';
  summary: string;
  filesChanged: string[];
  branch?: string;
  commit?: string;
  pr?: string;
  capturedAt: string;
}

export interface ReviewResult {
  score: number;
  decision: 'ACCEPT' | 'REJECT';
  checks: Record<'syntax' | 'architecture' | 'security' | 'regression' | 'performance' | 'codingStandards', boolean>;
  findings: string[];
  capturedAt: string;
}

export interface TestRunResult {
  tests: number;
  passed: number;
  failed: number;
  suites: string[];
  command: string;
  executed: boolean;
  output: string;
  capturedAt: string;
}

export interface PullRequestDraft {
  title: string;
  rootCause: string;
  solution: string;
  risks: string[];
  rollback: string;
  evidence: EngineeringEvidence[];
  status: 'BLOCKED_NO_REAL_PR' | 'PR_READY';
}

export interface ApprovalDecision {
  required: boolean;
  reasons: string[];
  gate: 'APPROVAL_REQUIRED' | 'NO_APPROVAL_REQUIRED';
}

export interface EngineeringTask {
  task_id: string;
  objective_id: string;
  owner: string;
  model: CodingProvider;
  status: EngineeringTaskStatus;
  evidence: EngineeringEvidence[];
  approval: ApprovalDecision;
  repo: string;
  branch: string | null;
  PR: string | null;
  title: string;
  description: string;
  classification: TaskClassification;
  providerResult: ProviderResult | null;
  review: ReviewResult | null;
  tests: TestRunResult | null;
  prDraft: PullRequestDraft | null;
  createdAt: string;
  updatedAt: string;
}

export interface EngineeringDashboardSnapshot {
  activeTasks: number;
  assignedModels: Record<CodingProvider, number>;
  queueStatus: Record<EngineeringTaskStatus, number>;
  reviewScores: Array<{ task_id: string; score: number }>;
  testStatus: Array<{ task_id: string; passed: number; failed: number; executed: boolean }>;
  prStatus: Array<{ task_id: string; status: string; pr: string | null }>;
  approvals: Array<{ task_id: string; required: boolean; reasons: string[] }>;
  failures: string[];
  cost: Record<CodingProvider, 'low' | 'medium' | 'high' | 'human'>;
  successRate: Record<CodingProvider, number>;
}
