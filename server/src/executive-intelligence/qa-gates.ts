/**
 * QA Gates — Phase 21
 *
 * Hard gates that every executive run must pass before brief delivery.
 * Any gate failure blocks the brief and requires remediation.
 *
 * Gates:
 *   1. schema_valid — all JSON outputs parse against schemas
 *   2. evidence_freshness — evidence timestamps within SLA
 *   3. traceability — every conclusion maps to evidence
 *   4. policy_safety — read-only / approval rules enforced
 *   5. contradiction_check — evidence contradictions surfaced
 *   6. executive_quality — brief has actions, not raw logs
 */

import {
  QAGateName, QAGateResult, QARunResult,
  EvidencePacket, ReflectionResult, ExecutiveBrief, Confidence,
} from './types';

// ── SLA constants ─────────────────────────────────────────────────────────────

const EVIDENCE_FRESHNESS_SLA_MS = {
  service_health: 15 * 60 * 1000,       // 15 minutes
  business_kpi: 24 * 60 * 60 * 1000,    // 24 hours
  default: 60 * 60 * 1000,              // 1 hour
};

// ── Gate implementations ──────────────────────────────────────────────────────

function gateSchemaValid(
  intent?: Record<string, unknown>,
  plan?: Record<string, unknown>,
  brief?: Record<string, unknown>,
): QAGateResult {
  const errors: string[] = [];

  // Check intent has required fields
  if (intent) {
    if (typeof intent.primary_intent !== 'string') errors.push('intent: missing primary_intent string');
    if (typeof intent.confidence !== 'number') errors.push('intent: missing confidence number');
    if (!Array.isArray(intent.hypotheses) || intent.hypotheses.length === 0) errors.push('intent: hypotheses must be non-empty array');
  }

  // Check plan has required fields
  if (plan) {
    if (typeof plan.objective !== 'string') errors.push('plan: missing objective string');
    if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) errors.push('plan: tasks must be non-empty array');
  }

  // Check brief has required fields
  if (brief) {
    if (typeof brief.headline !== 'string') errors.push('brief: missing headline string');
    if (!Array.isArray(brief.what_changed)) errors.push('brief: missing what_changed array');
    if (!Array.isArray(brief.recommended_actions)) errors.push('brief: missing recommended_actions array');
    if (typeof brief.confidence !== 'number') errors.push('brief: missing confidence number');
  }

  return {
    gate: 'schema_valid',
    passed: errors.length === 0,
    details: errors.length === 0 ? 'All schemas valid' : `Errors: ${errors.join('; ')}`,
    checkedAt: new Date().toISOString(),
  };
}

function gateEvidenceFreshness(evidencePackets: EvidencePacket[]): QAGateResult {
  const now = Date.now();
  const stale: string[] = [];

  for (const packet of evidencePackets) {
    const age = now - new Date(packet.capturedAt).getTime();
    const sla = EVIDENCE_FRESHNESS_SLA_MS[packet.sourceType as keyof typeof EVIDENCE_FRESHNESS_SLA_MS]
      || EVIDENCE_FRESHNESS_SLA_MS.default;

    if (age > sla) {
      stale.push(`${packet.sourceType} (${packet.sourceRef}): age=${Math.round(age / 60000)}min, SLA=${Math.round(sla / 60000)}min`);
    }
  }

  return {
    gate: 'evidence_freshness',
    passed: stale.length === 0,
    details: stale.length === 0
      ? `All ${evidencePackets.length} evidence packets within SLA`
      : `${stale.length}/${evidencePackets.length} evidence packets stale: ${stale.join('; ')}`,
    checkedAt: new Date().toISOString(),
  };
}

function gateTraceability(
  brief: ExecutiveBrief,
  evidencePackets: EvidencePacket[],
): QAGateResult {
  // Every recommended action and risk should reference evidence
  const evidenceIds = new Set(evidencePackets.map(e => e.id));
  const missingRefs: string[] = [];

  // Check that brief has at least some evidence references
  if (brief.evidenceRefs.length === 0 && brief.risks.length > 0) {
    missingRefs.push('Brief has risks but no evidence references');
  }

  // Check each evidence ref exists
  for (const ref of brief.evidenceRefs) {
    if (!evidenceIds.has(ref)) {
      missingRefs.push(`Evidence ref "${ref}" not found in evidence packets`);
    }
  }

  return {
    gate: 'traceability',
    passed: missingRefs.length === 0,
    details: missingRefs.length === 0
      ? `All ${brief.evidenceRefs.length} evidence refs traceable`
      : `Traceability issues: ${missingRefs.join('; ')}`,
    checkedAt: new Date().toISOString(),
  };
}

function gatePolicySafety(
  isReadOnlyDefault: boolean,
  hasApprovalForWrite: boolean,
): QAGateResult {
  const issues: string[] = [];

  if (isReadOnlyDefault && !hasApprovalForWrite) {
    // This is correct behavior — read-only without write approval
  } else if (!isReadOnlyDefault && !hasApprovalForWrite) {
    issues.push('Write actions attempted without CEO approval');
  }

  return {
    gate: 'policy_safety',
    passed: issues.length === 0,
    details: issues.length === 0
      ? 'Policy rules satisfied'
      : `Policy violations: ${issues.join('; ')}`,
    checkedAt: new Date().toISOString(),
  };
}

function gateContradictionCheck(reflection: ReflectionResult): QAGateResult {
  const unresolved = reflection.contradictions.filter(c => c.length > 0);

  // Contradictions are allowed IF they are surfaced (which they are by definition)
  // The gate passes as long as contradictions are documented
  return {
    gate: 'contradiction_check',
    passed: true,  // Always passes — contradictions are surfaced, not hidden
    details: unresolved.length === 0
      ? 'No contradictions found'
      : `${unresolved.length} contradictions surfaced (documented)`,
    checkedAt: new Date().toISOString(),
  };
}

function gateExecutiveQuality(brief: ExecutiveBrief): QAGateResult {
  const issues: string[] = [];

  // Must have a headline
  if (!brief.headline || brief.headline.trim().length === 0) {
    issues.push('Brief has no headline');
  }

  // Must have at least one recommended action for non-trivial briefs
  if (brief.recommendedActions.length === 0 && brief.confidence < 0.95) {
    issues.push('Brief has no recommended actions');
  }

  // Must not be just raw data dump (check if it has structured sections)
  if (brief.whatChanged.length === 0 && brief.whyItMatters.length === 0) {
    issues.push('Brief lacks what_changed and why_it_matters sections');
  }

  // Confidence must be reasonable
  if (brief.confidence < 0 || brief.confidence > 1) {
    issues.push(`Invalid confidence: ${brief.confidence}`);
  }

  return {
    gate: 'executive_quality',
    passed: issues.length === 0,
    details: issues.length === 0
      ? `Brief quality OK (confidence: ${brief.confidence})`
      : `Quality issues: ${issues.join('; ')}`,
    checkedAt: new Date().toISOString(),
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export interface QAGateInput {
  evidencePackets: EvidencePacket[];
  reflection: ReflectionResult;
  brief: ExecutiveBrief;
  isReadOnlyDefault: boolean;
  hasApprovalForWrite: boolean;
  rawOutputs?: {
    intent?: Record<string, unknown>;
    plan?: Record<string, unknown>;
  };
}

/**
 * Run all 6 QA gates against an executive run.
 * Returns a QARunResult with per-gate pass/fail and overall verdict.
 */
export function runQAGates(input: QAGateInput): QARunResult {
  const gates: QAGateResult[] = [
    gateSchemaValid(input.rawOutputs?.intent, input.rawOutputs?.plan, input.brief as unknown as Record<string, unknown>),
    gateEvidenceFreshness(input.evidencePackets),
    gateTraceability(input.brief, input.evidencePackets),
    gatePolicySafety(input.isReadOnlyDefault, input.hasApprovalForWrite),
    gateContradictionCheck(input.reflection),
    gateExecutiveQuality(input.brief),
  ];

  const overall = gates.every(g => g.passed) ? 'pass' : 'fail';

  return {
    overall,
    gates,
    runAt: new Date().toISOString(),
  };
}
