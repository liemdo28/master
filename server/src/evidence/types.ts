/**
 * Phase 6D canonical evidence contract. This module never stores a new row anywhere —
 * see docs/architecture/PHASE6D_EVIDENCE_AUDIT.md. Every EvidenceRecord is a
 * deterministic, table-driven normalization of a row that already exists in one of the
 * Phase 5F-5I / 6A-6C stores. Categories, freshness, and redaction are computed by pure
 * functions from explicit source-enum values only — never by pattern-matching or
 * LLM-inferring free text, so a fact can never be silently upgraded past what its
 * source actually claims (the hard rule in §6D.3).
 */

export type EvidenceCategory =
  | 'FACT' | 'INFERENCE' | 'ASSUMPTION' | 'UNKNOWN' | 'CONFLICT'
  | 'DECISION' | 'SIDE_EFFECT' | 'HEALTH' | 'POLICY' | 'APPROVAL'
  | 'EXECUTION' | 'SOURCE_REFERENCE';

export type EvidenceConfidence = 'CERTAIN' | 'LIKELY' | 'UNCERTAIN' | 'UNKNOWN';

export type EvidenceFreshness = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export type EvidenceRedactionClass = 'PUBLIC_SAFE' | 'OPERATOR_SAFE' | 'SENSITIVE' | 'SECRET_NEVER_RENDER';

/** Every existing evidence-like table this contract reads through — never a new one. */
export type EvidenceSourceSystem =
  | 'CONTROLLED_ACTIONS' | 'GOVERNANCE' | 'ORCHESTRATION' | 'DELEGATION'
  | 'KNOWLEDGE' | 'TASK_RUNTIME' | 'AUTHORITY_CONTROL_PLANE' | 'HEALTH';

/** A structured pointer replacing the loose `evidenceReferences: string[]` convention
 *  found everywhere in the pre-6D codebase (Controlled Actions, Governance,
 *  Orchestration, Delegation, Documents, Operating Loop, Operator Control). */
export interface EvidenceRef {
  sourceSystem: EvidenceSourceSystem;
  sourceId: string;
  /** Optional finer pointer within the source — e.g. a chunk id, a line range, a step id. */
  locator?: string | null;
}

export interface EvidenceRecord {
  /** Stable and derived, never a freshly-minted row id: `${sourceSystem}:${sourceId}`. */
  id: string;
  category: EvidenceCategory;
  sourceSystem: EvidenceSourceSystem;
  sourceId: string;
  projectId: string | null;
  /** e.g. 'ActionProposal', 'DelegatedAuthority', 'KnowledgeDocument', 'PolicyDecision'. */
  subjectType: string;
  subjectId: string;
  /** Human-readable claim text. Sanitized — see redaction.ts. Never raw metadata JSON. */
  claim: string;
  confidence: EvidenceConfidence;
  observedAt: string;
  validAt: string | null;
  expiresAt: string | null;
  freshness: EvidenceFreshness;
  /** What this record was itself derived from — chains back through the system. */
  provenance: EvidenceRef[];
  redactionClass: EvidenceRedactionClass;
  /** A safe, non-secret reference (path/URI/short hash prefix) — never a credential. */
  canonicalReference: string | null;
  relatedEvidence: string[];
  /** Set only for CONFLICT-category records or records a conflict was raised against. */
  conflictGroup: string | null;
  /** Links to the governance/delegation decision that consumed or produced this, if any. */
  authorityDecisionId: string | null;
  actor: string | null;
}

export interface EvidenceFilter {
  category?: EvidenceCategory;
  sourceSystem?: EvidenceSourceSystem;
  projectId?: string;
  subjectId?: string;
  since?: string;
  until?: string;
  redactionClassAtMost?: EvidenceRedactionClass;
}

export interface EvidenceServiceOptions {
  personalOsRoot?: string;
  taskRuntimeRoot?: string;
  repoRoot?: string;
  now?: () => Date;
}

/** §6D.8 — structured health metrics, one row per monitored dimension. */
export interface HealthMetric {
  dimension:
    | 'APPROVALS_WAITING' | 'BLOCKED_PLANS' | 'STALE_KNOWLEDGE' | 'FAILED_INGESTION'
    | 'POLICY_DRIFT' | 'DELEGATION_EXPIRY' | 'BUDGET_EXHAUSTION' | 'KILL_SWITCHES'
    | 'AUTHORITY_VIOLATIONS' | 'DB_INTEGRITY' | 'SERVICE_HEALTH';
  value: number;
  status: 'OK' | 'ATTENTION' | 'CRITICAL' | 'UNKNOWN';
  detail: string;
  evidenceIds: string[];
}

/** §6D.9 — read-only, no remediation, no side effects. */
export interface DailyAuditDigest {
  date: string;
  generatedAt: string;
  decisions: number;
  approvals: number;
  executions: number;
  denials: number;
  delegationExecutions: number;
  anomalies: number;
  blockedItems: number;
  openConflicts: number;
  healthDegradations: number;
  staleEvidenceCount: number;
  significantEvents: EvidenceRecord[];
}
