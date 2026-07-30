/**
 * AgentSkill Schema — Phase 11
 * Standardized types for the AgentSkill ecosystem.
 */

import type { SkillCategory, ApprovalClass } from './skill-registry';

// ── Core AgentSkill Definition ─────────────────────────────────────────────────

export interface AgentSkillDefinition {
  // Identity
  id: string;
  name: string;
  name_vi: string;
  version: string;              // semver: "1.0.0"
  owner: string;                // "mi-core" | "external" | email

  // Classification
  category: SkillCategory;
  tags: string[];               // ["qa", "dashboard", "audit"]
  description: string;

  // Security
  approval_class: ApprovalClass;
  risk_level: 1 | 2 | 3;

  // Execution
  params: string[];
  dependencies: string[];       // skill IDs this skill depends on
  available: boolean;
  disabled: boolean;

  // Lifecycle
  installed_at: string;         // ISO timestamp
  updated_at: string;
  active_version: string;       // version currently executing
  versions: SkillVersion[];

  // Reliability (computed from metrics)
  reliability_score?: number;   // 0–100
}

// ── Version record ─────────────────────────────────────────────────────────────

export interface SkillVersion {
  version: string;
  released_at: string;
  changelog: string;
  active: boolean;
  rollback_available: boolean;
}

// ── Execution metrics ──────────────────────────────────────────────────────────

export interface SkillExecutionRecord {
  skill_id: string;
  version: string;
  work_order_id?: string;
  executed_at: string;
  success: boolean;
  duration_ms: number;
  error?: string;
}

// ── Reliability score ──────────────────────────────────────────────────────────

export interface SkillReliabilityScore {
  skill_id: string;
  score: number;                // 0–100
  execution_count: number;
  success_count: number;
  failure_count: number;
  success_rate: number;         // 0.0–1.0
  avg_duration_ms: number;
  last_executed?: string;
  last_success?: string;
  last_failure?: string;
}

// ── Discovery query ────────────────────────────────────────────────────────────

export interface SkillDiscoveryQuery {
  intent?: string;
  tags?: string[];
  category?: SkillCategory;
  approval_class?: ApprovalClass;
  available_only?: boolean;
  min_reliability?: number;     // filter skills below this score
}

export interface SkillDiscoveryResult {
  skill: AgentSkillDefinition;
  match_score: number;          // how well this skill matches the query
  match_reasons: string[];
  reliability?: SkillReliabilityScore;
}
