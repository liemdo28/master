/**
 * Phase 25 — Objective Engine Types
 * CEO objectives flow through: Intent → Classification → Department → Tasks → Plan → Approval → Execute → Verify → Report
 */

// ── Intent Classification ────────────────────────────────────────────────────

export type IntentCategory =
  | 'traffic-growth'
  | 'revenue-growth'
  | 'brand-expansion'
  | 'operational-optimization'
  | 'risk-mitigation'
  | 'compliance'
  | 'customer-experience'
  | 'technology-upgrade';

// ── Goal Classification ──────────────────────────────────────────────────────

export type GoalType = 'quantitative' | 'qualitative' | 'binary';

export interface QuantitativeGoal {
  type: 'quantitative';
  metric: string;
  currentBaseline: number;
  targetValue: number;
  unit: string;
  timeframeDays: number;
}

export interface QualitativeGoal {
  type: 'qualitative';
  metric: string;
  currentState: string;
  targetState: string;
  timeframeDays: number;
}

export interface BinaryGoal {
  type: 'binary';
  description: string;
  successCondition: string;
}

export type Goal = QuantitativeGoal | QualitativeGoal | BinaryGoal;

// ── Department Mapping ───────────────────────────────────────────────────────

export type Department =
  | 'seo'
  | 'content'
  | 'marketing'
  | 'web-engineering'
  | 'analytics'
  | 'operations'
  | 'finance'
  | 'review-management'
  | 'local-seo'
  | 'compliance'
  | 'reporting'
  | 'executive-assistant';

// ── Task Decomposition ───────────────────────────────────────────────────────

export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

export type TaskStatus =
  | 'pending'
  | 'awaiting-approval'
  | 'approved'
  | 'in-progress'
  | 'evidence-collected'
  | 'qa-pending'
  | 'qa-passed'
  | 'qa-failed'
  | 'completed'
  | 'failed'
  | 'blocked';

export interface ObjectiveTask {
  id: string;
  objectiveId: string;
  title: string;
  description: string;
  department: Department;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedMinutes: number;
  dependencies: string[];
  subtasks: SubTask[];
  evidence: EvidenceItem[];
  qaResult: QAResult | null;
  result: any;
  startedAt: string | null;
  completedAt: string | null;
}

export interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  result: any;
}

// ── Evidence & QA ────────────────────────────────────────────────────────────

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  description: string;
  beforeState: any;
  afterState: any;
  result: any;
  collectedAt: string;
}

export type EvidenceType =
  | 'metric-snapshot'
  | 'file-scan'
  | 'route-audit'
  | 'log-check'
  | 'test-run'
  | 'health-check'
  | 'code-analysis'
  | 'config-audit'
  | 'seo-audit'
  | 'traffic-snapshot'
  | 'api-response'
  | 'screenshot'
  | 'crawl-result'
  | 'schema-validation'
  | 'ranking-snapshot'
  | 'gsc-data'
  | 'webhook-result'
  | 'manual-verification';

export interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface QAResult {
  passed: boolean;
  score: number;
  checks: QACheck[];
  reviewedAt: string;
}

// ── Execution Plan ───────────────────────────────────────────────────────────

export type PlanStatus =
  | 'draft'
  | 'awaiting-approval'
  | 'approved'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'failed';

export interface ExecutionPlan {
  id: string;
  objectiveId: string;
  status: PlanStatus;
  tasks: ObjectiveTask[];
  createdAt: string;
  approvedAt: string | null;
  completedAt: string | null;
  estimatedDurationMinutes: number;
  approvalGate: ApprovalGate;
  progress: PlanProgress;
}

export interface PlanProgress {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  percentComplete: number;
}

// ── Approval Gate ────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'auto-approved';

export interface ApprovalGate {
  required: boolean;
  status: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  riskLevel: RiskLevel;
}

export type RiskLevel = 'auto-approve' | 'low' | 'medium' | 'high' | 'critical';

// ── Objective Record ─────────────────────────────────────────────────────────

export type ObjectiveStatus =
  | 'received'
  | 'analyzing'
  | 'decomposed'
  | 'awaiting-approval'
  | 'approved'
  | 'executing'
  | 'verifying'
  | 'completed'
  | 'failed';

export interface ObjectiveRecord {
  id: string;
  objective: string;
  status: ObjectiveStatus;
  intent: IntentAnalysis | null;
  goal: Goal | null;
  departments: Department[];
  plan: ExecutionPlan | null;
  report: ObjectiveReport | null;
  receivedAt: string;
  completedAt: string | null;
  humanInterventions: number;
  evidenceCount: number;
}

// ── Intent Analysis ──────────────────────────────────────────────────────────

export interface IntentAnalysis {
  rawObjective: string;
  normalizedObjective: string;
  category: IntentCategory;
  businessEntity: string;
  actionVerb: string;
  targetMetric: string;
  targetValue: number | null;
  timeframe: string | null;
  confidence: number;
}

// ── Report ───────────────────────────────────────────────────────────────────

export interface ObjectiveReport {
  objectiveId: string;
  generatedAt: string;
  summary: string;
  metricsBefore: Record<string, any>;
  metricsAfter: Record<string, any>;
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  evidenceItems: number;
  overallScore: number;
  recommendations: string[];
  weeklyActions: string[];
}
