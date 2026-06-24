/**
 * Executive Intelligence — Shared Types (Phase 21)
 *
 * Consolidated type definitions for the entire Executive Intelligence Layer.
 * These types are shared across all engines: intent, planner, reflection,
 * reasoning, decision, brief, memory, evidence, QA gates, and skills.
 */

// ── Core ──────────────────────────────────────────────────────────────────────

export type Confidence = number; // 0.0 – 1.0

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ProcessingMode = 'quick' | 'full' | 'emergency' | 'strategic';

export type IngressChannel =
  | 'whatsapp'
  | 'dashboard'
  | 'api'
  | 'cron'
  | 'webhook'
  | 'incident';

export interface SessionNamespace {
  channel: IngressChannel;
  subchannel?: string;   // e.g. 'ceo', 'morning-brief', 'qbo'
  toString(): string;    // e.g. 'whatsapp:ceo'
}

// ── Intent ────────────────────────────────────────────────────────────────────

export interface IntentHypothesis {
  intent: string;
  confidence: Confidence;
  why: string;
  missingInformation?: string[];
}

export interface IntentResult {
  primaryIntent: string;
  confidence: Confidence;
  needsExecution: boolean;
  hypotheses: IntentHypothesis[];
  suggestedDepartments: string[];
}

// ── Plan ──────────────────────────────────────────────────────────────────────

export type PlanTaskType = 'investigate' | 'read' | 'analyze' | 'execute' | 'qa' | 'report';

export interface PlanTask {
  id: string;
  title: string;
  department: string;
  type: PlanTaskType;
  dependsOn?: string[];
  readOnly?: boolean;
  estimatedSeconds?: number;
}

export interface ExecutivePlan {
  objective: string;
  tasks: PlanTask[];
  successCriteria: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export interface EvidencePacket {
  id: string;
  objectiveRunId: string;
  sourceType: string;      // 'service_health', 'finance_report', 'pm2_status', etc.
  sourceRef: string;       // URL, file path, or API endpoint
  summary: string;
  sha256?: string;
  artifactPath?: string;
  capturedAt: string;
  readOnly: boolean;
}

// ── Reasoning ─────────────────────────────────────────────────────────────────

export interface ReasoningFrame {
  frameType: string;       // 'revenue_analysis', 'risk_assessment', etc.
  hypotheses: string[];
  signals: string[];
  evidenceSummaries: string[];
  confidence: Confidence;
}

// ── Decision ──────────────────────────────────────────────────────────────────

export interface RecommendedAction {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  owner?: string;
  dueHint?: string;
  reversible?: boolean;
}

export interface DecisionRecord {
  objectiveRunId: string;
  priority: string;
  impactScores: Record<string, number>;
  recommendedActions: RecommendedAction[];
  confidence: Confidence;
}

// ── Reflection ────────────────────────────────────────────────────────────────

export interface ReflectionResult {
  confidence: Confidence;
  assumptions: string[];
  alternativeExplanations: string[];
  missingEvidence: string[];
  contradictions: string[];
}

// ── Brief ─────────────────────────────────────────────────────────────────────

export interface ExecutiveBrief {
  headline: string;
  whatChanged: string[];
  whyItMatters: string[];
  risks: string[];
  recommendedActions: RecommendedAction[];
  confidence: Confidence;
  evidenceRefs: string[];
  // Formatted outputs
  formattedWhatsApp?: string;
  formattedMarkdown?: string;
}

// ── QA Gates ──────────────────────────────────────────────────────────────────

export type QAGateName =
  | 'schema_valid'
  | 'evidence_freshness'
  | 'traceability'
  | 'policy_safety'
  | 'contradiction_check'
  | 'executive_quality';

export interface QAGateResult {
  gate: QAGateName;
  passed: boolean;
  details: string;
  checkedAt: string;
}

export interface QARunResult {
  overall: 'pass' | 'fail';
  gates: QAGateResult[];
  runAt: string;
}

// ── Memory ────────────────────────────────────────────────────────────────────

export interface MemoryItem {
  id: string;
  namespace: string;
  kind: string;            // 'incident', 'priority', 'goal', 'claim', 'brief', etc.
  title: string;
  body: string;
  tags: string[];
  freshnessDate?: string;
  sourceRefs: string[];
  embedding?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryClaim {
  id: string;
  memoryItemId: string;
  claimText: string;
  evidenceRefs: string[];
  confidence: Confidence;
  contradictionRefs: string[];
  createdAt?: string;
}

// ── Skills ────────────────────────────────────────────────────────────────────

export interface SkillManifest {
  name: string;
  version: string;
  entry: string;           // path to SKILL.md
  approved: boolean;
  approvedBy?: string;
  scope: string[];
  sha256: string;
  policy: SkillPolicy;
}

export interface SkillPolicy {
  mode: 'read-only' | 'controlled-write';
  allowedConnectors: string[];
  deniedActions: string[];
  approvalRequiredForWrite: boolean;
}

export interface SkillRun {
  skillName: string;
  objectiveRunId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  evidenceRefs: string[];
  startedAt: string;
  endedAt?: string;
}

// ── Objective Run ─────────────────────────────────────────────────────────────

export type ObjectiveRunStatus =
  | 'pending'
  | 'intent_analyzed'
  | 'planned'
  | 'reasoning'
  | 'decided'
  | 'executing'
  | 'evidence_collected'
  | 'qa_passed'
  | 'qa_failed'
  | 'reflected'
  | 'briefed'
  | 'completed'
  | 'failed';

export interface ObjectiveRun {
  id: string;
  objectiveText: string;
  channel: string;
  status: ObjectiveRunStatus;
  owner: string;
  startedAt: string;
  endedAt?: string;
  finalConfidence?: Confidence;
}

// ── Model Routing ─────────────────────────────────────────────────────────────

export type ExecutiveModelRole =
  | 'intent'
  | 'planner'
  | 'reasoner'
  | 'decision'
  | 'reflection'
  | 'brief'
  | 'tools'
  | 'embeddings'
  | 'premium';

export interface ModelRoute {
  role: ExecutiveModelRole;
  model: string;
  provider: 'ollama' | 'openai' | 'anthropic';
}

// ── Session Routing ───────────────────────────────────────────────────────────

export function createSessionNamespace(channel: IngressChannel, subchannel?: string): string {
  return subchannel ? `${channel}:${subchannel}` : channel;
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface ExecutiveHealthStatus {
  ok: boolean;
  service: string;
  version: string;
  modelRoutes: Record<string, string>;
  dbStatus: 'connected' | 'disconnected' | 'fallback';
  evidenceStorePath: string;
  wikiStorePath: string;
  uptime: number;
  timestamp: string;
}
