/**
 * COO V4 — Core Types
 * Shared across all 24 domains.
 */

// ── Domain A: Execution Graph ──────────────────────────────────────────────

export interface WorkflowState {
  workflow_id:   string;
  intent:        string;
  goal:          string;
  plan:          PlanStep[];
  current_step:  number;
  context:       Record<string, unknown>;
  outputs:       Record<string, unknown>;
  status:        WorkflowStatus;
  errors:        string[];
  created_at:    string;
  updated_at:    string;
}

export type WorkflowStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'blocked';

export interface PlanStep {
  id:          string;
  name:        string;
  description: string;
  agent:       AgentDomain;
  input:       Record<string, unknown>;
  depends_on:  string[];   // step ids
  parallel:    boolean;
  status:      StepStatus;
  output?:     unknown;
  error?:      string;
  governor:    GovernorClass;
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval';

// ── Domain C: NLP ──────────────────────────────────────────────────────────

export interface ParsedIntent {
  raw:        string;
  normalized: string;
  action:     string;
  target:     string;
  modifiers:  string[];
  language:   'vi' | 'en' | 'mixed';
  confidence: number;
  inferred:   boolean;
}

// ── Domain H: Skill Marketplace ────────────────────────────────────────────

export interface Skill {
  id:              string;
  name:            string;
  version:         string;
  description:     string;
  agent:           AgentDomain;
  input_schema:    Record<string, string>;
  output_schema:   Record<string, string>;
  reliability:     number;   // 0-100
  trust_score:     number;   // 0-100
  executions:      number;
  failures:        number;
  avg_duration_ms: number;
  tags:            string[];
  enabled:         boolean;
  registered_at:   string;
}

export interface SkillExecution {
  skill_id:    string;
  input:       Record<string, unknown>;
  output?:     unknown;
  error?:      string;
  duration_ms: number;
  success:     boolean;
  timestamp:   string;
}

// ── Domain I: Agent Council V4 ─────────────────────────────────────────────

export type CouncilRole =
  | 'pm'
  | 'qa'
  | 'dev'
  | 'security'
  | 'ops'
  | 'marketing'
  | 'bookkeeper'
  | 'accountant'
  | 'cfo';

export type CouncilStance = 'PROCEED' | 'PROCEED_WITH_CONDITIONS' | 'ESCALATE_TO_CEO' | 'BLOCK';

export interface CouncilVote {
  role:       CouncilRole;
  name_vi:    string;
  stance:     CouncilStance;
  reasoning:  string;
  conditions: string[];
  weight:     number;
}

export interface CouncilDecision {
  request:      string;
  votes:        CouncilVote[];
  outcome:      CouncilStance;
  summary_vi:   string;
  conditions:   string[];
  requires_ceo: boolean;
  risk_level:   'low' | 'medium' | 'high' | 'critical';
}

// ── Domain W: Production Governor ─────────────────────────────────────────

export type GovernorClass = 'SAFE' | 'REQUIRES_APPROVAL' | 'DANGEROUS' | 'BLOCKED';

export interface GovernorDecision {
  class:     GovernorClass;
  reason:    string;
  domains:   string[];
  risk_tags: string[];
}

// ── Domain V: Flow Optimizer ───────────────────────────────────────────────

export interface QueueJob<T = unknown> {
  id:          string;
  queue:       string;
  payload:     T;
  priority:    number;   // higher = sooner
  attempts:    number;
  max_attempts:number;
  status:      'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  created_at:  string;
  scheduled_at:string;
  started_at?: string;
  error?:      string;
}

export interface CircuitBreakerState {
  name:        string;
  state:       'closed' | 'open' | 'half_open';
  failures:    number;
  threshold:   number;
  last_failure:string | null;
  open_until?: string;
}

// ── Domain B: Durable Workflow ─────────────────────────────────────────────

export interface DurableWorkflow {
  id:           string;
  name:         string;
  status:       WorkflowStatus;
  input:        Record<string, unknown>;
  state:        WorkflowState;
  checkpoint:   number;    // last completed step index
  signals:      WorkflowSignal[];
  created_at:   string;
  updated_at:   string;
  completed_at: string | null;
}

export interface WorkflowSignal {
  type:        'approval' | 'rejection' | 'cancel' | 'resume' | 'input';
  payload:     unknown;
  received_at: string;
}

// ── Agent Domains ──────────────────────────────────────────────────────────

export type AgentDomain =
  | 'intent'          // A - planning
  | 'nlp'             // C
  | 'ai_developer'    // D - OpenHands
  | 'swe_agent'       // E - bug fix
  | 'code_reviewer'   // F - Aider
  | 'code_gate'       // G - production gate
  | 'skill_store'     // H
  | 'council'         // I - CrewAI
  | 'browser'         // J - Playwright
  | 'computer'        // K - Computer Use
  | 'workspace'       // L - Google Workspace
  | 'bookkeeper'      // M
  | 'accountant'      // N
  | 'cfo'             // O
  | 'tax'             // P
  | 'marketing'       // Q
  | 'website'         // R
  | 'social'          // S
  | 'orchestrator'    // T
  | 'executive'       // U
  | 'flow'            // V
  | 'governor'        // W
  | 'self_improve'    // X
  | 'gstack'          // existing GStack
  | 'jarvis';         // existing Jarvis

export interface AgentResult {
  success:     boolean;
  output:      unknown;
  error?:      string;
  duration_ms: number;
  agent:       AgentDomain;
  metadata:    Record<string, unknown>;
}

// ── V4 Executive Report ────────────────────────────────────────────────────

export interface ExecutiveReport {
  workflow_id:   string;
  title:         string;
  summary_vi:    string;
  steps_total:   number;
  steps_done:    number;
  steps_failed:  number;
  outcome:       'SUCCESS' | 'PARTIAL' | 'FAILED' | 'BLOCKED';
  duration_ms:   number;
  report_text:   string;  // WhatsApp-ready
  artifacts:     string[];
  generated_at:  string;
}
