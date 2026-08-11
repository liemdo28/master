/**
 * Deterministic, table-driven mapping from each existing source row shape to the
 * canonical EvidenceRecord contract. Every category/confidence assignment below is a
 * fixed lookup keyed on an explicit enum value the source system itself emitted — never
 * a heuristic over free text, and never an LLM call. This is what makes §6D.3's hard
 * rule enforceable: a fact can only ever be represented at the confidence its own
 * source-of-truth already committed to.
 */
import type { EvidenceCategory, EvidenceConfidence, EvidenceRecord, EvidenceRef } from './types';
import { classifyFreshness } from './freshness';
import { classifyRedaction, containsSecret, sanitizeCanonicalReference, sanitizeClaim } from './redaction';

function baseRecord(now: Date, params: {
  sourceSystem: EvidenceRecord['sourceSystem'];
  sourceId: string;
  category: EvidenceCategory;
  confidence: EvidenceConfidence;
  projectId: string | null;
  subjectType: string;
  subjectId: string;
  claim: string;
  observedAt: string;
  validAt?: string | null;
  expiresAt?: string | null;
  provenance?: EvidenceRef[];
  canonicalReference?: string | null;
  relatedEvidence?: string[];
  conflictGroup?: string | null;
  authorityDecisionId?: string | null;
  actor?: string | null;
}): EvidenceRecord {
  // Content-driven upgrade: if the RAW claim (before sanitization replaces it) or the
  // raw canonicalReference ever matched a secret pattern, this record is
  // SECRET_NEVER_RENDER regardless of its category/source default — a stronger signal
  // than the sanitized placeholder text alone, so any consumer knows to also withhold
  // the record's other fields, not just the claim.
  const rawHadSecret = containsSecret(params.claim) || (params.canonicalReference ? containsSecret(params.canonicalReference) : false);
  return {
    id: `${params.sourceSystem}:${params.sourceId}`,
    category: params.category,
    sourceSystem: params.sourceSystem,
    sourceId: params.sourceId,
    projectId: params.projectId,
    subjectType: params.subjectType,
    subjectId: params.subjectId,
    claim: sanitizeClaim(params.claim),
    confidence: params.confidence,
    observedAt: params.observedAt,
    validAt: params.validAt ?? null,
    expiresAt: params.expiresAt ?? null,
    freshness: classifyFreshness(params.observedAt, params.category, now),
    provenance: params.provenance ?? [],
    redactionClass: rawHadSecret ? 'SECRET_NEVER_RENDER' : classifyRedaction(params.sourceSystem, params.category),
    canonicalReference: sanitizeCanonicalReference(params.canonicalReference ?? null),
    relatedEvidence: params.relatedEvidence ?? [],
    conflictGroup: params.conflictGroup ?? null,
    authorityDecisionId: params.authorityDecisionId ?? null,
    actor: params.actor ?? null,
  };
}

// ---- Controlled Actions (action_evidence) --------------------------------------------

const ACTION_EVIDENCE_CATEGORY: Record<string, EvidenceCategory> = {
  'action.proposed': 'SOURCE_REFERENCE',
  'action.approved': 'APPROVAL',
  'action.rejected': 'DECISION',
  'action.cancelled': 'DECISION',
  'action.expired': 'DECISION',
  'policy.budget.blocked': 'POLICY',
  'action.execution.started': 'EXECUTION',
  'action.execution.completed': 'EXECUTION',
  'action.execution.failed': 'EXECUTION',
};

export interface RawActionEvidenceRow {
  id: string; proposalId: string; approvalId: string | null; executionId: string | null;
  eventType: string; summary: string; payloadHash: string | null; actor: string; createdAt: string;
}

export function normalizeActionEvidence(row: RawActionEvidenceRow, projectId: string | null, now: Date): EvidenceRecord {
  const category = ACTION_EVIDENCE_CATEGORY[row.eventType] ?? 'SOURCE_REFERENCE';
  return baseRecord(now, {
    sourceSystem: 'CONTROLLED_ACTIONS', sourceId: row.id, category,
    confidence: 'CERTAIN', // system-recorded event, never inferred
    projectId, subjectType: 'ActionProposal', subjectId: row.proposalId,
    claim: row.summary, observedAt: row.createdAt,
    canonicalReference: row.payloadHash ? `sha256:${row.payloadHash.slice(0, 16)}` : null,
    actor: row.actor,
  });
}

// ---- Governance (policy_decisions, governance_events, governance_anomalies) ----------

export interface RawPolicyDecisionRow {
  id: string; proposalId: string; projectId: string | null; decision: string;
  evaluatedAt: string; policyVersion: string; decisionHash: string;
}

export function normalizePolicyDecision(row: RawPolicyDecisionRow, now: Date): EvidenceRecord {
  return baseRecord(now, {
    sourceSystem: 'GOVERNANCE', sourceId: row.id, category: 'DECISION',
    confidence: 'CERTAIN',
    projectId: row.projectId, subjectType: 'ActionProposal', subjectId: row.proposalId,
    claim: `Policy decision: ${row.decision} (policy v${row.policyVersion})`,
    observedAt: row.evaluatedAt,
    canonicalReference: `policy-decision:${row.decisionHash.slice(0, 16)}`,
    authorityDecisionId: row.id,
  });
}

const GOVERNANCE_EVENT_PREFIX_CATEGORY: Array<[string, EvidenceCategory]> = [
  ['kill_switch.', 'POLICY'],
  ['legacy.quarantine', 'POLICY'],
  ['legacy.adapter', 'SIDE_EFFECT'],
  ['legacy.semantic', 'POLICY'],
  ['budget.', 'POLICY'],
];

export interface RawGovernanceEventRow {
  id: string; eventType: string; actor: string; proposalId: string | null; createdAt: string;
}

export function normalizeGovernanceEvent(row: RawGovernanceEventRow, projectId: string | null, now: Date): EvidenceRecord {
  const match = GOVERNANCE_EVENT_PREFIX_CATEGORY.find(([prefix]) => row.eventType.startsWith(prefix));
  const category: EvidenceCategory = match ? match[1] : 'DECISION';
  return baseRecord(now, {
    sourceSystem: 'GOVERNANCE', sourceId: row.id, category,
    confidence: 'CERTAIN',
    projectId, subjectType: row.proposalId ? 'ActionProposal' : 'GovernanceEvent',
    subjectId: row.proposalId ?? row.id,
    claim: `Governance event: ${row.eventType}`,
    observedAt: row.createdAt, actor: row.actor,
  });
}

export interface RawGovernanceAnomalyRow {
  id: string; type: string; severity: string; proposalId: string | null; projectId: string | null;
  description: string; detectedAt: string; status: string;
}

export function normalizeGovernanceAnomaly(row: RawGovernanceAnomalyRow, now: Date): EvidenceRecord {
  return baseRecord(now, {
    sourceSystem: 'GOVERNANCE', sourceId: row.id, category: 'HEALTH',
    confidence: row.severity === 'CRITICAL' || row.severity === 'HIGH' ? 'CERTAIN' : 'LIKELY',
    projectId: row.projectId, subjectType: row.proposalId ? 'ActionProposal' : 'Anomaly',
    subjectId: row.proposalId ?? row.id,
    claim: sanitizeClaim(row.description),
    observedAt: row.detectedAt,
    conflictGroup: row.status === 'OPEN' ? row.id : null,
  });
}

// ---- Orchestration (action_plan_evidence) ---------------------------------------------

const PLAN_EVIDENCE_CATEGORY: Record<string, EvidenceCategory> = {
  PLAN_CREATED: 'SOURCE_REFERENCE', PLAN_VERSIONED: 'SOURCE_REFERENCE',
  PLAN_VALIDATED: 'DECISION', PLAN_VALIDATION_FAILED: 'DECISION',
  PLAN_STARTED: 'SOURCE_REFERENCE', STEP_READY: 'SOURCE_REFERENCE',
  STEP_STARTED: 'EXECUTION', STEP_EXECUTED: 'EXECUTION', STEP_FAILED: 'EXECUTION',
  STEP_WAITING_APPROVAL: 'APPROVAL', APPROVAL_BOUND: 'APPROVAL',
  POLICY_DENIED: 'POLICY', KILL_SWITCH_BLOCKED: 'POLICY', BUDGET_BLOCKED: 'POLICY',
  STEP_RECONCILIATION_REQUIRED: 'CONFLICT',
  PLAN_PAUSED: 'DECISION', PLAN_RESUMED: 'DECISION', PLAN_COMPLETED: 'DECISION',
  PLAN_FAILED: 'DECISION', PLAN_CANCELLED: 'DECISION',
};

export interface RawPlanEvidenceRow {
  id: string; planId: string; stepId: string | null; eventType: string; summary: string; actor: string; createdAt: string;
}

export function normalizePlanEvidence(row: RawPlanEvidenceRow, projectId: string | null, now: Date): EvidenceRecord {
  const category = PLAN_EVIDENCE_CATEGORY[row.eventType] ?? 'SOURCE_REFERENCE';
  return baseRecord(now, {
    sourceSystem: 'ORCHESTRATION', sourceId: row.id, category,
    confidence: 'CERTAIN',
    projectId, subjectType: row.stepId ? 'ActionPlanStep' : 'ActionPlan',
    subjectId: row.stepId ?? row.planId,
    claim: row.summary, observedAt: row.createdAt, actor: row.actor,
    conflictGroup: row.eventType === 'STEP_RECONCILIATION_REQUIRED' ? row.stepId : null,
    provenance: [{ sourceSystem: 'ORCHESTRATION', sourceId: row.planId }],
  });
}

// ---- Delegation (delegation_decisions, delegation_events) -----------------------------

const DELEGATION_EVENT_CATEGORY: Record<string, EvidenceCategory> = {
  'delegation.created': 'SOURCE_REFERENCE',
  'delegation.approved': 'APPROVAL',
  'delegation.activated': 'APPROVAL',
  'delegation.evaluated': 'DECISION',
  'delegation.execution.authorized': 'EXECUTION',
  'delegation.execution.denied': 'DECISION',
  'delegation.quota.reserved': 'SIDE_EFFECT',
  'delegation.quota.exhausted': 'HEALTH',
  'delegation.paused': 'DECISION',
  'delegation.resumed': 'DECISION',
  'delegation.expired': 'DECISION',
  'delegation.revoked': 'DECISION',
  'delegation.cancelled': 'DECISION',
  'delegation.policy_changed': 'POLICY',
  'delegation.anomaly_detected': 'CONFLICT',
};

export interface RawDelegationEventRow {
  id: string; delegationId: string; proposalId: string | null; eventType: string; summary: string; actor: string; createdAt: string;
}

export function normalizeDelegationEvent(row: RawDelegationEventRow, projectId: string | null, now: Date): EvidenceRecord {
  const category = DELEGATION_EVENT_CATEGORY[row.eventType] ?? 'SOURCE_REFERENCE';
  return baseRecord(now, {
    sourceSystem: 'DELEGATION', sourceId: row.id, category,
    confidence: 'CERTAIN',
    projectId, subjectType: 'DelegatedAuthority', subjectId: row.delegationId,
    claim: row.summary, observedAt: row.createdAt, actor: row.actor,
    conflictGroup: row.eventType === 'delegation.anomaly_detected' ? row.delegationId : null,
    relatedEvidence: row.proposalId ? [`CONTROLLED_ACTIONS:${row.proposalId}`] : [],
  });
}

export interface RawDelegationDecisionRow {
  id: string; delegationId: string; proposalId: string; projectId: string;
  eligible: boolean; reasons: string[]; evaluatedAt: string; decisionHash: string;
}

export function normalizeDelegationDecision(row: RawDelegationDecisionRow, now: Date): EvidenceRecord {
  const eligible = !!row.eligible;
  return baseRecord(now, {
    sourceSystem: 'DELEGATION', sourceId: row.id, category: 'DECISION',
    confidence: 'CERTAIN',
    projectId: row.projectId, subjectType: 'ActionProposal', subjectId: row.proposalId,
    claim: eligible ? 'Delegation eligibility: authorized' : `Delegation eligibility: denied (${row.reasons.join('; ')})`,
    observedAt: row.evaluatedAt,
    canonicalReference: `delegation-decision:${row.decisionHash.slice(0, 16)}`,
    authorityDecisionId: row.id,
    relatedEvidence: [`DELEGATION:${row.delegationId}`],
  });
}

// ---- Knowledge (documents, conflicts) --------------------------------------------------

export interface RawDocumentRow {
  id: string; title: string; status: string; sourceUri: string; projectIds: string[]; updatedAt: string; checksum: string;
}

export function normalizeDocument(row: RawDocumentRow, now: Date): EvidenceRecord {
  return baseRecord(now, {
    sourceSystem: 'KNOWLEDGE', sourceId: row.id, category: 'SOURCE_REFERENCE',
    confidence: row.status === 'STALE' ? 'LIKELY' : 'CERTAIN',
    projectId: row.projectIds[0] ?? null, subjectType: 'KnowledgeDocument', subjectId: row.id,
    claim: `Document "${row.title}" (${row.status})`,
    observedAt: row.updatedAt,
    canonicalReference: row.sourceUri,
  });
}

export interface RawConflictRow {
  id: string; documentIds: string[]; projectIds: string[]; description: string;
  status: string; createdAt: string; resolvedAt: string | null;
}

export function normalizeConflict(row: RawConflictRow, now: Date): EvidenceRecord {
  return baseRecord(now, {
    sourceSystem: 'KNOWLEDGE', sourceId: row.id, category: 'CONFLICT',
    confidence: 'CERTAIN',
    projectId: row.projectIds[0] ?? null, subjectType: 'KnowledgeConflict', subjectId: row.id,
    claim: sanitizeClaim(row.description),
    observedAt: row.createdAt,
    conflictGroup: row.status === 'OPEN' ? row.id : null,
    relatedEvidence: row.documentIds.map(id => `KNOWLEDGE:${id}`),
  });
}

// ---- Task Runtime (task_events) --------------------------------------------------------

function taskEventCategory(type: string): EvidenceCategory {
  if (type === 'task.created') return 'SOURCE_REFERENCE';
  if (type === 'task.status_changed') return 'DECISION';
  if (type.startsWith('command.')) return 'SIDE_EFFECT';
  return 'SOURCE_REFERENCE';
}

export interface RawTaskEventRow {
  id: number; taskId: string; type: string; createdAt: string;
}

export function normalizeTaskEvent(row: RawTaskEventRow, projectId: string | null, now: Date): EvidenceRecord {
  return baseRecord(now, {
    sourceSystem: 'TASK_RUNTIME', sourceId: String(row.id), category: taskEventCategory(row.type),
    confidence: 'CERTAIN',
    projectId, subjectType: 'Task', subjectId: row.taskId,
    claim: `Task event: ${row.type}`, observedAt: row.createdAt,
  });
}
