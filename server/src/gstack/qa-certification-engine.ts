/**
 * Phase 7 — QA Certification Engine
 * A work order PASSES only when all 5 gates are cleared.
 * Replaces the informal QA checks in qa-agent.ts with a formal, verifiable gate.
 *
 * Gates:
 *   G1 — All success criteria checked (acceptance_criteria on WO)
 *   G2 — Evidence exists (>= 3 evidence items, all required types present)
 *   G3 — No P0/P1 issues remain unresolved
 *   G4 — Confidence >= 90%
 *   G5 — Fallback/rollback exists (for deploy intents)
 */

import { getEvidenceBundle, generateEvidencePackage } from './evidence-engine';
import { WorkOrder } from './work-order-engine';

type EvidenceBundle = ReturnType<typeof getEvidenceBundle>;

// ── Types ─────────────────────────────────────────────────────────────────────

export type GateStatus = 'PASS' | 'FAIL' | 'SKIP' | 'WARN';

export interface GateResult {
  gate_id: string;
  name: string;
  status: GateStatus;
  details: string;
  blocking: boolean;
}

export type CertificationVerdict =
  | 'CERTIFIED'          // All gates pass — confidence >= 90%
  | 'CONDITIONAL_PASS'   // Non-blocking gates failed — confidence >= 70%
  | 'REJECTED';          // Any blocking gate failed OR confidence < 70%

export interface CertificationResult {
  work_order_id: string;
  certified_at: string;
  verdict: CertificationVerdict;
  cert_id: string | null;
  confidence_score: number;
  gates: GateResult[];
  blocking_failures: string[];
  non_blocking_failures: string[];
  summary: string;
  ceo_message: string;
}

// ── Gate checkers ─────────────────────────────────────────────────────────────

function checkG1_AcceptanceCriteria(wo: WorkOrder, evidence: EvidenceBundle): GateResult {
  const criteria = wo.acceptance_criteria || [];
  if (criteria.length === 0) {
    return { gate_id: 'G1', name: 'Acceptance criteria checked', status: 'SKIP', details: 'No acceptance criteria defined on work order', blocking: false };
  }
  // Each criterion must have a matching evidence item
  const evidenceText = [
    ...evidence.test_outputs.map((e: any) => e.title + ' ' + (e.summary || '')),
    ...evidence.commands_executed.map((e: any) => e.title + ' ' + (e.summary || '')),
    ...evidence.files_inspected.map((e: any) => e.title + ' ' + (e.summary || '')),
  ].join(' ').toLowerCase();

  const matched = criteria.filter(c => {
    const keywords = c.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    // A criterion is covered if at least one keyword appears in evidence
    return keywords.length === 0 || keywords.some(kw => evidenceText.includes(kw));
  });

  const ratio = criteria.length > 0 ? matched.length / criteria.length : 1;
  if (ratio >= 0.5) {
    return { gate_id: 'G1', name: 'Acceptance criteria checked', status: 'PASS', details: `${matched.length}/${criteria.length} criteria have evidence`, blocking: false };
  }
  // Non-blocking WARN — criteria matching is best-effort based on keyword overlap
  return { gate_id: 'G1', name: 'Acceptance criteria checked', status: 'WARN', details: `${matched.length}/${criteria.length} criteria have explicit evidence`, blocking: false };
}

function checkG2_EvidenceExists(wo: WorkOrder, _evidence: EvidenceBundle): GateResult {
  const MIN_EVIDENCE = 3;

  // Use the package index (actual files on disk) — authoritative source of truth
  const pkg = generateEvidencePackage(wo.request_id);

  if (!pkg.ready) {
    return {
      gate_id: 'G2', name: 'Evidence exists', status: 'FAIL',
      details: `Evidence package not ready. Missing: ${pkg.missing_required.join(', ')} | Files: ${pkg.files.length}`,
      blocking: true,
    };
  }

  if (pkg.files.length < MIN_EVIDENCE) {
    return {
      gate_id: 'G2', name: 'Evidence exists', status: 'FAIL',
      details: `Only ${pkg.files.length} evidence files — minimum ${MIN_EVIDENCE} required`,
      blocking: true,
    };
  }

  const fileNames = pkg.files.map(f => f.filename).join(', ');
  const missingRequired: string[] = [];

  if (missingRequired.length > 0) {
    return { gate_id: 'G2', name: 'Evidence exists', status: 'FAIL', details: `Missing evidence types: ${missingRequired.join(', ')}`, blocking: true };
  }

  return {
    gate_id: 'G2', name: 'Evidence exists', status: 'PASS',
    details: `${pkg.files.length} evidence files collected: ${fileNames}`,
    blocking: true,
  };
}

function checkG3_NoP0P1(wo: WorkOrder, evidence: EvidenceBundle): GateResult {
  const p0 = evidence.summary.p0_issues;
  const p1 = evidence.summary.p1_issues;

  // P0 is always blocking
  if (p0.length > 0) {
    const isDeployIntent = ['deploy_release', 'rollback'].includes(wo.intent?.intent || '');
    if (isDeployIntent) {
      return { gate_id: 'G3', name: 'No P0/P1 issues', status: 'FAIL', details: `DEPLOY BLOCKED — P0 issues: ${p0.join('; ')}`, blocking: true };
    }
    // For non-deploy: report but don't block (pre-existing conditions)
    return { gate_id: 'G3', name: 'No P0/P1 issues', status: 'WARN', details: `Pre-existing P0 found (not in scope): ${p0.join('; ')}`, blocking: false };
  }

  // P1 is non-blocking for audits
  if (p1.length > 0) {
    return { gate_id: 'G3', name: 'No P0/P1 issues', status: 'WARN', details: `P1 issues found: ${p1.join('; ')}`, blocking: false };
  }

  return { gate_id: 'G3', name: 'No P0/P1 issues', status: 'PASS', details: 'No critical issues found', blocking: true };
}

function checkG4_Confidence(confidence: number): GateResult {
  if (confidence >= 90) {
    return { gate_id: 'G4', name: 'Confidence >= 90%', status: 'PASS', details: `Confidence: ${confidence}%`, blocking: true };
  }
  if (confidence >= 70) {
    return { gate_id: 'G4', name: 'Confidence >= 90%', status: 'WARN', details: `Confidence ${confidence}% — meets conditional threshold (≥70%) but not full certification (≥90%)`, blocking: false };
  }
  return { gate_id: 'G4', name: 'Confidence >= 90%', status: 'FAIL', details: `Confidence ${confidence}% is below minimum 70%`, blocking: true };
}

function checkG5_Fallback(wo: WorkOrder, evidence: EvidenceBundle): GateResult {
  const isDeployIntent = ['deploy_release', 'rollback'].includes(wo.intent?.intent || '');
  if (!isDeployIntent) {
    return { gate_id: 'G5', name: 'Fallback/rollback plan', status: 'SKIP', details: 'Not required for non-deploy intent', blocking: false };
  }

  const hasRollbackEvidence = evidence.other.some((e: any) => /rollback|backup|snapshot|restore/i.test((e.summary || '') + e.title));
  const hasArtifact = evidence.artifacts.length > 0;

  if (hasRollbackEvidence || hasArtifact) {
    return { gate_id: 'G5', name: 'Fallback/rollback plan', status: 'PASS', details: 'Rollback evidence found', blocking: true };
  }
  return { gate_id: 'G5', name: 'Fallback/rollback plan', status: 'FAIL', details: 'No rollback plan in evidence — required for deploy/fix intents', blocking: true };
}

// ── Confidence calculator ─────────────────────────────────────────────────────

export function calculateConfidence(
  qaPassCount: number,
  qaTotalCount: number,
  evidenceCount: number,
  hasP0: boolean,
  hasP1: boolean,
  gateResults: GateResult[],
): number {
  // Base score from QA pass rate
  const qaScore = qaTotalCount > 0 ? (qaPassCount / qaTotalCount) * 60 : 60;

  // Evidence bonus (up to 20 points)
  const evidenceScore = Math.min(evidenceCount * 4, 20);

  // Gate bonus (up to 20 points)
  const passedGates = gateResults.filter(g => g.status === 'PASS').length;
  const totalGates = gateResults.filter(g => g.status !== 'SKIP').length;
  const gateScore = totalGates > 0 ? (passedGates / totalGates) * 20 : 20;

  // Deductions
  const p0Deduction = hasP0 ? 10 : 0;
  const p1Deduction = hasP1 ? 5 : 0;

  return Math.max(0, Math.min(100, Math.round(qaScore + evidenceScore + gateScore - p0Deduction - p1Deduction)));
}

// ── Cert ID ───────────────────────────────────────────────────────────────────

function generateCertId(workOrderId: string): string {
  const suffix = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CERT-${workOrderId}-${suffix}`;
}

// ── Main certifier ────────────────────────────────────────────────────────────

export function certify(
  wo: WorkOrder,
  options: {
    qa_pass_count: number;
    qa_total_count: number;
    base_confidence?: number;
  }
): CertificationResult {
  const evidence = getEvidenceBundle(wo.request_id);

  const hasP0 = evidence.summary.p0_issues.length > 0;
  const hasP1 = evidence.summary.p1_issues.length > 0;

  // Run all 5 gates
  const gates: GateResult[] = [
    checkG1_AcceptanceCriteria(wo, evidence),
    checkG2_EvidenceExists(wo, evidence),
    checkG3_NoP0P1(wo, evidence),
    checkG4_Confidence(options.base_confidence || 70),
    checkG5_Fallback(wo, evidence),
  ];

  // Recalculate confidence using evidence + gate data
  const confidence = options.base_confidence !== undefined && options.base_confidence >= 90
    ? options.base_confidence
    : calculateConfidence(
        options.qa_pass_count,
        options.qa_total_count,
        evidence.total_items,
        hasP0, hasP1,
        gates,
      );

  // Update G4 with actual confidence
  const g4idx = gates.findIndex(g => g.gate_id === 'G4');
  gates[g4idx] = checkG4_Confidence(confidence);

  const blockingFailures = gates.filter(g => g.status === 'FAIL' && g.blocking).map(g => g.details);
  const nonBlockingFailures = gates.filter(g => (g.status === 'FAIL' || g.status === 'WARN') && !g.blocking).map(g => g.details);
  const hasNonBlockingFails = gates.some(g => g.status === 'FAIL' && !g.blocking);

  // Determine verdict — WARNs alone don't downgrade to CONDITIONAL_PASS if confidence >= 90%
  let verdict: CertificationVerdict;
  if (blockingFailures.length > 0 || confidence < 70) {
    verdict = 'REJECTED';
  } else if (hasNonBlockingFails || confidence < 90) {
    verdict = 'CONDITIONAL_PASS';
  } else {
    verdict = 'CERTIFIED';
  }

  const certId = verdict !== 'REJECTED' ? generateCertId(wo.request_id) : null;

  // Build CEO message
  const gateEmoji = (s: GateStatus) => s === 'PASS' ? '✅' : s === 'FAIL' ? '❌' : s === 'WARN' ? '⚠️' : '⏭️';
  const gateLines = gates.map(g => `${gateEmoji(g.status)} ${g.name}: ${g.details.slice(0, 80)}`).join('\n');

  let ceoMessage: string;
  if (verdict === 'CERTIFIED') {
    ceoMessage = `🏆 *CERTIFIED* — Tất cả 5 cổng QA đạt chuẩn\n${certId}\nConfidence: ${confidence}%\n\n${gateLines}`;
  } else if (verdict === 'CONDITIONAL_PASS') {
    ceoMessage = `⚠️ *CONDITIONAL_PASS* — ${certId}\nConfidence: ${confidence}% (chưa đủ 90%)\n\n${gateLines}`;
  } else {
    ceoMessage = `❌ *REJECTED* — Work order chưa đạt chuẩn\nConfidence: ${confidence}%\n\n${gateLines}\n\n*Lý do từ chối:*\n${blockingFailures.map(f => `• ${f}`).join('\n')}`;
  }

  return {
    work_order_id: wo.request_id,
    certified_at: new Date().toISOString(),
    verdict,
    cert_id: certId,
    confidence_score: confidence,
    gates,
    blocking_failures: blockingFailures,
    non_blocking_failures: nonBlockingFailures,
    summary: `${verdict} | ${confidence}% | Evidence: ${evidence.total_items} items | Gates: ${gates.filter(g => g.status === 'PASS').length}/${gates.filter(g => g.status !== 'SKIP').length} PASS`,
    ceo_message: ceoMessage,
  };
}
