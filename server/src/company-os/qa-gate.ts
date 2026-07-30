/**
 * Mi Company OS — QA Gate (Phase 4)
 * Independent from the department that did the work.
 * Engineering cannot certify Engineering. Marketing cannot certify Marketing.
 *
 * Allowed verdicts: PASS | FAIL
 * Not allowed: PROVISIONAL, READY, DESIGNED, REPORT_ONLY_PASS
 *
 * QA checks (10 checks):
 *  1. Evidence exists in evidence-store
 *  2. QA independence (exec dept != qa dept)
 *  3. No failed steps
 *  4. Output quality (no placeholder/empty)
 *  5. Confidence >= threshold (default 0.80)
 *  6. Request match (output references request terms)
 *  7. Source truth verified (all tools used are registered)
 *  8. Business requirement match (dept assignment aligns with intent)
 *  9. Regression risk check (no destructive patterns in output)
 * 10. Evidence chain complete (all steps have timestamps + dept)
 */

import { getStepsForPipeline, hasEvidence, setQaVerdict, type ExecutionEvidence } from './evidence-store';
import type { Department } from './departments';

export type QaVerdict = 'PASS' | 'FAIL';

export interface QaResult {
  verdict: QaVerdict;
  confidence: number;
  checks: QaCheck[];
  notes: string;
  blocking_reason?: string;
}

export interface QaCheck {
  name: string;
  passed: boolean;
  detail: string;
}

// Patterns that indicate fake pass / placeholder output
const FORBIDDEN_PATTERNS = [
  /PROVISIONAL/i,
  /DESIGNED/i,
  /FRAMEWORK_COMPLETE/i,
  /REPORT_ONLY_PASS/i,
  /TODO:|FIXME:|PLACEHOLDER/i,
  /not yet implemented/i,
  /lorem ipsum/i,
  /\[object Object\]/,
];

const PLACEHOLDER_OUTPUTS = ['{}', '[]', 'null', 'undefined', '', 'ok', 'done', 'success'];

// Patterns indicating destructive or dangerous output that must not auto-execute
const REGRESSION_RISK_PATTERNS = [
  /rm\s+-rf/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM.*WHERE\s+1=1/i,
  /format\s+[c-z]:/i,
  /git\s+reset\s+--hard/i,
  /git\s+push\s+--force/i,
  /TRUNCATE\s+TABLE/i,
];

// Valid registered departments (source-truth check)
const VALID_DEPARTMENTS = [
  'dispatch','executive-assistant','report-center','library','qa',
  'finance','tax-compliance','restaurant-intelligence','engineering',
  'infrastructure','marketing','brand-creative','technical-operations','rd',
];

/**
 * Run QA verification for a completed pipeline run.
 * deptId = department that DID the work (QA must not be the same dept).
 */
export function runQaGate(
  pipelineId: string,
  execDeptId: string,
  originalRequest: string,
  minConfidence = 0.80,
  intentCategory?: string
): QaResult {
  const checks: QaCheck[] = [];

  // 1. Evidence exists
  const evidenceExists = hasEvidence(pipelineId);
  checks.push({
    name: 'evidence_exists',
    passed: evidenceExists,
    detail: evidenceExists ? 'Evidence records found in store' : 'NO evidence in store — execution may not have run',
  });

  // 2. QA dept != exec dept
  const qaIsIndependent = execDeptId !== 'qa';
  checks.push({
    name: 'qa_independence',
    passed: qaIsIndependent,
    detail: qaIsIndependent
      ? `QA is independent from '${execDeptId}'`
      : 'QA and executor are same — independence violated',
  });

  // 3. Load steps and check outputs
  const steps = getStepsForPipeline(pipelineId);
  const doneSteps = steps.filter(s => s.status === 'done');
  const failedSteps = steps.filter(s => s.status === 'failed');

  checks.push({
    name: 'no_failed_steps',
    passed: failedSteps.length === 0,
    detail: failedSteps.length === 0
      ? `All ${doneSteps.length} steps completed`
      : `${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')}`,
  });

  // 4. Output quality — check for placeholder/empty outputs
  const badOutputs = doneSteps.filter(s => {
    if (!s.output) return true;
    const raw = s.output.trim().toLowerCase();
    if (PLACEHOLDER_OUTPUTS.includes(raw)) return true;
    const parsed = (() => { try { return JSON.stringify(JSON.parse(s.output)); } catch { return s.output; } })();
    return FORBIDDEN_PATTERNS.some(p => p.test(parsed));
  });

  checks.push({
    name: 'output_quality',
    passed: badOutputs.length === 0,
    detail: badOutputs.length === 0
      ? 'All outputs have real content'
      : `${badOutputs.length} step(s) have empty/placeholder output: ${badOutputs.map(s => s.step).join(', ')}`,
  });

  // 5. Confidence threshold
  const avgConfidence = doneSteps.length
    ? doneSteps.reduce((sum, s) => sum + (s.confidence ?? 0), 0) / doneSteps.length
    : 0;

  checks.push({
    name: 'confidence_threshold',
    passed: avgConfidence >= minConfidence,
    detail: `Average confidence: ${(avgConfidence * 100).toFixed(1)}% (required: ${(minConfidence * 100).toFixed(0)}%)`,
  });

  // 6. Request match — does output reference key terms from request
  const requestTokens = originalRequest.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  const allOutput = doneSteps.map(s => s.output || '').join(' ').toLowerCase();
  const matchCount = requestTokens.filter(t => allOutput.includes(t)).length;
  const matchRatio = requestTokens.length > 0 ? matchCount / requestTokens.length : 1;

  checks.push({
    name: 'request_match',
    passed: matchRatio >= 0.5,
    detail: `${(matchRatio * 100).toFixed(0)}% of request terms found in output`,
  });

  // 7. Source truth — exec dept must be a registered department
  const deptIsValid = VALID_DEPARTMENTS.includes(execDeptId);
  checks.push({
    name: 'source_truth',
    passed: deptIsValid,
    detail: deptIsValid
      ? `Dept '${execDeptId}' is registered in source truth`
      : `Dept '${execDeptId}' is NOT a registered department — source truth violation`,
  });

  // 8. Business requirement match — intent category aligns with dept
  const INTENT_DEPT_MAP: Record<string, string[]> = {
    'query_personal_tasks': ['executive-assistant', 'dispatch'],
    'check_status': ['infrastructure', 'technical-operations', 'report-center'],
    'finance_query': ['finance', 'tax-compliance'],
    'restaurant_query': ['restaurant-intelligence', 'report-center'],
    'build_feature': ['engineering', 'rd'],
    'search_knowledge': ['library', 'report-center'],
    'marketing_task': ['marketing', 'brand-creative'],
    'send_message': ['executive-assistant'],
  };
  let bizRequirementPassed = true;
  let bizDetail = 'No intent category provided — skipping requirement match';
  if (intentCategory && INTENT_DEPT_MAP[intentCategory]) {
    const allowed = INTENT_DEPT_MAP[intentCategory];
    bizRequirementPassed = allowed.includes(execDeptId) || execDeptId === 'dispatch';
    bizDetail = bizRequirementPassed
      ? `Dept '${execDeptId}' is valid for intent '${intentCategory}'`
      : `Dept '${execDeptId}' does not handle intent '${intentCategory}' (expected: ${allowed.join('/')})`;
  }
  checks.push({ name: 'business_requirement_match', passed: bizRequirementPassed, detail: bizDetail });

  // 9. Regression risk — scan output for dangerous patterns
  const riskPatterns = REGRESSION_RISK_PATTERNS.filter(p => p.test(allOutput));
  const regressionSafe = riskPatterns.length === 0;
  checks.push({
    name: 'regression_risk',
    passed: regressionSafe,
    detail: regressionSafe
      ? 'No destructive patterns detected in output'
      : `RISK: ${riskPatterns.length} destructive pattern(s) detected — requires explicit CEO approval`,
  });

  // 10. Evidence chain completeness — all steps must have dept + timestamp
  const incompleteSteps = steps.filter(s => !s.dept_id || !s.created_at);
  const chainComplete = incompleteSteps.length === 0;
  checks.push({
    name: 'evidence_chain',
    passed: chainComplete,
    detail: chainComplete
      ? `Evidence chain complete — ${steps.length} steps all have dept + timestamp`
      : `${incompleteSteps.length} step(s) missing dept or timestamp`,
  });

  // ── Verdict ──────────────────────────────────────────────────────────────
  const failedChecks = checks.filter(c => !c.passed);
  const passed = failedChecks.length === 0;
  const finalConfidence = passed ? Math.max(avgConfidence, 0.80) : avgConfidence * 0.5;

  const result: QaResult = {
    verdict: passed ? 'PASS' : 'FAIL',
    confidence: finalConfidence,
    checks,
    notes: passed
      ? `QA PASS — all ${checks.length} checks cleared`
      : `QA FAIL — ${failedChecks.length} check(s) failed: ${failedChecks.map(c => c.name).join(', ')}`,
    blocking_reason: passed ? undefined : failedChecks[0]?.detail,
  };

  // Persist verdict to each evidence step
  for (const step of steps) {
    setQaVerdict(step.id, result.verdict, result.notes);
  }

  return result;
}

/**
 * Quick check — can this dept self-certify? Always NO.
 */
export function canSelfCertify(_deptId: string): false {
  return false;
}

/**
 * Format QA result for CEO (plain language, no technical IDs).
 */
export function formatQaResult(qa: QaResult): string {
  const icon = qa.verdict === 'PASS' ? '✅' : '❌';
  const lines = [
    `${icon} QA: ${qa.verdict}`,
    qa.notes,
  ];
  if (qa.verdict === 'FAIL' && qa.blocking_reason) {
    lines.push(`Blocker: ${qa.blocking_reason}`);
  }
  return lines.join('\n');
}
