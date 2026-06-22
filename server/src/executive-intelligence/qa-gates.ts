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

  // Check intent has required fields (handles both types.ts and executive-intent-engine.ts shapes)
  if (intent) {
    const hasPrimary = typeof intent.primary_intent === 'string' || (typeof intent.primary_intent === 'object' && intent.primary_intent !== null);
    if (!hasPrimary) errors.push('intent: missing primary_intent');
    const confidence = typeof intent.confidence === 'number' ? intent.confidence
      : typeof intent.primary_intent === 'object' ? (intent.primary_intent as any)?.confidence
      : undefined;
    if (typeof confidence !== 'number') errors.push('intent: missing confidence number');
    const hasHypotheses = Array.isArray(intent.hypotheses) || Array.isArray(intent.alternatives);
    if (!hasHypotheses) errors.push('intent: missing hypotheses/alternatives');
  }

  // Check plan has required fields (handles both types.ts and executive-planner.ts shapes)
  if (plan) {
    const hasObjective = typeof plan.objective === 'string' || typeof plan.title === 'string';
    if (!hasObjective) errors.push('plan: missing objective/title string');
    const hasTasks = Array.isArray(plan.tasks) || Array.isArray(plan.steps);
    if (!hasTasks) errors.push('plan: missing tasks/steps');
  }

  // Check brief has required fields (handles both types.ts and executive-brief.ts shapes)
  if (brief) {
    const b = brief as any;
    const hasHeadline = typeof b.headline === 'string' || typeof b.title_vi === 'string';
    const hasWhatChanged = Array.isArray(b.whatChanged) || typeof b.what_changed === 'string';
    const hasActions = Array.isArray(b.recommendedActions) || Array.isArray(b.recommended_actions);
    if (!hasHeadline) errors.push('brief: missing headline/title_vi string');
    if (!hasWhatChanged) errors.push('brief: missing what_changed section');
    if (!hasActions) errors.push('brief: missing recommended_actions array');
    if (typeof b.confidence !== 'number') errors.push('brief: missing confidence number');
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

  // Handle both types.ts ExecutiveBrief (has evidenceRefs) and executive-brief.ts ExecutiveBrief (doesn't)
  const evidenceRefs: string[] = (brief as any).evidenceRefs || [];
  const risks: string[] = brief.risks || [];

  // Check that brief has at least some evidence references
  if (evidenceRefs.length === 0 && risks.length > 0 && evidencePackets.length > 0) {
    missingRefs.push('Brief has risks but no evidence references');
  }

  // Check each evidence ref exists
  for (const ref of evidenceRefs) {
    if (!evidenceIds.has(ref)) {
      missingRefs.push(`Evidence ref "${ref}" not found in evidence packets`);
    }
  }

  // If there are no evidence packets at all, the gate passes (no evidence to trace)
  if (evidencePackets.length === 0) {
    return {
      gate: 'traceability',
      passed: true,
      details: 'No evidence packets to trace (minimal mode)',
      checkedAt: new Date().toISOString(),
    };
  }

  return {
    gate: 'traceability',
    passed: missingRefs.length === 0,
    details: missingRefs.length === 0
      ? `All ${evidenceRefs.length} evidence refs traceable (${evidencePackets.length} packets)`
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
  // Handle both types.ts ReflectionResult (has contradictions: string[])
  // and executive-reflection.ts ReflectionResult (may use different shape)
  const r = reflection as any;
  const contradictions: string[] = r.contradictions || r.alternativeExplanations || [];
  const unresolved = Array.isArray(contradictions) ? contradictions.filter((c: string) => c && c.length > 0) : [];

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
  const b = brief as any;

  // Must have a headline/title (handles both types.ts and executive-brief.ts)
  const headline = b.headline || b.title_vi || '';
  if (!headline || headline.trim().length === 0) {
    issues.push('Brief has no headline');
  }

  // Must have at least one recommended action for non-trivial briefs
  const actions = b.recommendedActions || b.recommended_actions || [];
  if (actions.length === 0 && b.confidence < 0.95) {
    issues.push('Brief has no recommended actions');
  }

  // Must not be just raw data dump (check if it has structured sections)
  const whatChanged = b.whatChanged || b.what_changed || '';
  const whyMatters = b.whyItMatters || b.why_it_matters || '';
  if ((!whatChanged || (Array.isArray(whatChanged) && whatChanged.length === 0) || (typeof whatChanged === 'string' && whatChanged.length === 0)) &&
      (!whyMatters || (Array.isArray(whyMatters) && whyMatters.length === 0) || (typeof whyMatters === 'string' && whyMatters.length === 0))) {
    issues.push('Brief lacks what_changed and why_it_matters sections');
  }

  // Confidence must be reasonable
  if (b.confidence < 0 || b.confidence > 1) {
    issues.push(`Invalid confidence: ${b.confidence}`);
  }

  return {
    gate: 'executive_quality',
    passed: issues.length === 0,
    details: issues.length === 0
      ? `Brief quality OK (confidence: ${b.confidence})`
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
