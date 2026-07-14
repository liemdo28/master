/**
 * SEO Control Center — QA Certification test suite.
 *
 * Exercises the real gstack/qa-certification-engine.ts certify() function
 * (a pure function, no DB/network) at and around its actual threshold
 * boundaries as read from source, not guessed:
 *   - passRate === 1        -> PASS
 *   - passRate >= 0.7        -> CONDITIONAL_PASS
 *   - passRate <  0.7        -> REJECTED
 *   - qa_total_count === 0  -> CONDITIONAL_PASS (special case, independent of base_confidence)
 *
 * Run with (from mi-core/server):
 *   npx tsx src/seo/__tests__/qa.mjs
 */

import { section, check, finalize } from './_harness.mjs';
import { certify } from '../../gstack/qa-certification-engine.ts';

const wo = { request_id: 'wo-test-1', intent: { intent: 'build_feature', risk_level: 2 } };

function run(qa_pass_count, qa_total_count, base_confidence = 80) {
  return certify(wo, { qa_pass_count, qa_total_count, base_confidence });
}

section('PASS boundary — 100% pass rate');
{
  const r = run(10, 10, 80);
  check('10/10 (100%) -> PASS', r.verdict === 'PASS', `got ${r.verdict}`);
  check('PASS confidence_score = min(100, base+5)', r.confidence_score === 85, `got ${r.confidence_score}`);
  check('PASS gets a non-null cert_id', typeof r.cert_id === 'string' && r.cert_id.startsWith('CERT-'), `got ${r.cert_id}`);

  const rCap = run(5, 5, 98);
  check('PASS confidence_score is capped at 100 (base 98 + 5 = 103 -> 100)', rCap.confidence_score === 100, `got ${rCap.confidence_score}`);

  const r1of1 = run(1, 1, 50);
  check('1/1 (100%) -> PASS (small-N boundary)', r1of1.verdict === 'PASS', `got ${r1of1.verdict}`);
}

section('CONDITIONAL_PASS boundary — exactly 70%');
{
  const r7of10 = run(7, 10, 80);
  check('7/10 (exactly 70%) -> CONDITIONAL_PASS (>= 0.7 boundary is inclusive)',
    r7of10.verdict === 'CONDITIONAL_PASS', `got ${r7of10.verdict}`);
  check('CONDITIONAL_PASS confidence_score is unchanged from base_confidence',
    r7of10.confidence_score === 80, `got ${r7of10.confidence_score}`);

  const r70of100 = run(70, 100, 80);
  check('70/100 (exactly 70%) -> CONDITIONAL_PASS', r70of100.verdict === 'CONDITIONAL_PASS', `got ${r70of100.verdict}`);

  const r9of10 = run(9, 10, 80);
  check('9/10 (90%) -> CONDITIONAL_PASS', r9of10.verdict === 'CONDITIONAL_PASS', `got ${r9of10.verdict}`);
}

section('REJECTED boundary — just under 70%');
{
  const r69of100 = run(69, 100, 80);
  check('69/100 (69%, just under the 70% threshold) -> REJECTED',
    r69of100.verdict === 'REJECTED', `got ${r69of100.verdict}`);
  check('REJECTED confidence_score = max(0, base-20)', r69of100.confidence_score === 60, `got ${r69of100.confidence_score}`);

  const r6of10 = run(6, 10, 80);
  check('6/10 (60%) -> REJECTED', r6of10.verdict === 'REJECTED', `got ${r6of10.verdict}`);

  const r0of5 = run(0, 5, 80);
  check('0/5 (0%) -> REJECTED', r0of5.verdict === 'REJECTED', `got ${r0of5.verdict}`);

  const rFloorClamp = run(0, 5, 10);
  check('REJECTED confidence_score is clamped at 0 (base 10 - 20 = -10 -> 0)', rFloorClamp.confidence_score === 0, `got ${rFloorClamp.confidence_score}`);
}

section('Zero-QA special case — qa_total_count === 0');
{
  const rZero = run(0, 0, 80);
  check('0/0 -> CONDITIONAL_PASS (special-cased, not treated as 0% or 100%)',
    rZero.verdict === 'CONDITIONAL_PASS', `got ${rZero.verdict}`);
  check('0/0 confidence_score equals base_confidence unchanged', rZero.confidence_score === 80, `got ${rZero.confidence_score}`);

  const rZeroLowBase = run(0, 0, 15);
  check('0/0 verdict is independent of base_confidence value (still CONDITIONAL_PASS at base=15)',
    rZeroLowBase.verdict === 'CONDITIONAL_PASS', `got ${rZeroLowBase.verdict}`);
}

section('Gate structure — every result includes the 5 documented gates');
{
  const r = run(8, 10, 80);
  const gateNames = r.gates.map(g => g.name);
  check('gates include "QA Execution Gate"', gateNames.includes('QA Execution Gate'));
  check('gates include "Pass Rate Gate"', gateNames.includes('Pass Rate Gate'));
  check('gates include "Intent Risk Gate"', gateNames.includes('Intent Risk Gate'));
  check('gates include "Evidence Gate"', gateNames.includes('Evidence Gate'));
  check('gates include "Approval Gate"', gateNames.includes('Approval Gate'));

  const passRateGate = r.gates.find(g => g.name === 'Pass Rate Gate');
  check('Pass Rate Gate is PASS at 80% (>= 70% threshold)', passRateGate.status === 'PASS', `got ${passRateGate.status}`);

  const rFail = run(3, 10, 80); // 30% — below threshold but not zero
  const failGate = rFail.gates.find(g => g.name === 'Pass Rate Gate');
  check('Pass Rate Gate is FAIL when 0% < passRate < 70%', failGate.status === 'FAIL', `got ${failGate.status}`);

  const rWarnZero = run(0, 0, 80);
  const warnGate = rWarnZero.gates.find(g => g.name === 'QA Execution Gate');
  check('QA Execution Gate is WARN when qa_total_count is 0', warnGate.status === 'WARN', `got ${warnGate.status}`);
}

finalize('qa.mjs');
