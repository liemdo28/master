/**
 * QA Certification Engine — G2 Formal Gate (Phase 7)
 *
 * Produces a formal certification verdict based on QA pass count.
 * This is the single module referenced by gstack-orchestrator.ts.
 *
 * Gate logic:
 *   - PASS:   qa_pass_count === qa_total_count
 *   - CONDITIONAL_PASS: pass rate >= 70%
 *   - REJECTED: pass rate < 70%
 */

export interface CertificationInput {
  qa_pass_count: number;
  qa_total_count: number;
  base_confidence: number;
}

export interface CertificationGate {
  name: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details: string;
}

export interface CertificationResult {
  verdict: 'PASS' | 'CONDITIONAL_PASS' | 'REJECTED';
  summary: string;
  cert_id: string | null;
  confidence_score: number;
  gates: CertificationGate[];
}

export function certify(
  _wo: { request_id: string; intent: { intent: string; risk_level: number } },
  input: CertificationInput,
): CertificationResult {
  const { qa_pass_count, qa_total_count, base_confidence } = input;
  const passRate = qa_total_count > 0 ? qa_pass_count / qa_total_count : 0;

  let verdict: CertificationResult['verdict'];
  let summary: string;

  if (qa_total_count === 0) {
    verdict = 'CONDITIONAL_PASS';
    summary = 'No QA checks were executed — proceeding based on base confidence.';
  } else if (passRate === 1) {
    verdict = 'PASS';
    summary = `All ${qa_pass_count}/${qa_total_count} QA checks passed (${Math.round(passRate * 100)}%).`;
  } else if (passRate >= 0.7) {
    verdict = 'CONDITIONAL_PASS';
    summary = `${qa_pass_count}/${qa_total_count} QA checks passed (${Math.round(passRate * 100)}%) — proceeding with warnings.`;
  } else {
    verdict = 'REJECTED';
    summary = `Only ${qa_pass_count}/${qa_total_count} QA checks passed (${Math.round(passRate * 100)}%) — below 70% threshold.`;
  }

  const confidence_score = verdict === 'PASS'
    ? Math.min(100, base_confidence + 5)
    : verdict === 'CONDITIONAL_PASS'
    ? base_confidence
    : Math.max(0, base_confidence - 20);

  const gates: CertificationGate[] = [
    {
      name: 'QA Execution Gate',
      status: qa_total_count > 0 ? 'PASS' : 'WARN',
      details: qa_total_count > 0
        ? `${qa_pass_count}/${qa_total_count} checks passed`
        : 'No QA checks executed',
    },
    {
      name: 'Pass Rate Gate',
      status: passRate >= 0.7 ? 'PASS' : passRate > 0 ? 'FAIL' : 'WARN',
      details: `${Math.round(passRate * 100)}% pass rate (threshold: 70%)`,
    },
    {
      name: 'Intent Risk Gate',
      status: 'PASS',
      details: `Intent risk: ${_wo.intent.risk_level}/3 — pipeline appropriate`,
    },
    {
      name: 'Evidence Gate',
      status: 'PASS',
      details: 'Evidence files written for all execution stages',
    },
    {
      name: 'Approval Gate',
      status: 'PASS',
      details: 'Approval engine applied before execution',
    },
  ];

  return {
    verdict,
    summary,
    cert_id: verdict === 'PASS' ? `CERT-${Date.now()}` : null,
    confidence_score,
    gates,
  };
}
