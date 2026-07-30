/**
 * Mi Company OS — QA Department
 * Independent verification. Cannot certify its own work.
 *
 * Runs the qa-gate for a pipeline, then uses gemma3:12b to produce
 * a human-readable QA verdict with specific blocking reasons.
 *
 * Rules:
 *   - PASS or FAIL only. No provisional.
 *   - QA dept_id !== exec dept_id (enforced in qa-gate)
 *   - All 6 checks must pass for PASS verdict
 *   - gemma3:12b is the QA brain — independent from qwen models used by exec depts
 */

import { runQaGate, formatQaResult, type QaResult } from './qa-gate';
import { getBrainForDept, callBrain } from './brain-registry';
import { recordStep, completeStep, getStepsForPipeline } from './evidence-store';
import type { DeptReport } from './report-center';

const DEPT_ID = 'qa';

export interface QaRequest {
  pipeline_id: string;
  exec_dept_id: string;
  original_command: string;
  min_confidence?: number;
}

export interface QaDeptReport extends DeptReport {
  qa_verdict: 'PASS' | 'FAIL';
  checks_passed: number;
  checks_failed: number;
  blocking_reason?: string;
  evidence_steps_reviewed: number;
  brain_verdict?: string;
}

export async function executeQaDepartment(req: QaRequest): Promise<QaDeptReport> {
  const { pipeline_id, exec_dept_id, original_command, min_confidence = 0.80 } = req;

  // Step 1: Run the programmatic QA gate (6 deterministic checks)
  const gateStep = recordStep(pipeline_id, DEPT_ID, 'qa_gate_run', {
    exec_dept_id,
    min_confidence,
  });

  const qaResult: QaResult = runQaGate(pipeline_id, exec_dept_id, original_command, min_confidence);
  const steps = getStepsForPipeline(pipeline_id);
  const checksPassed = qaResult.checks.filter(c => c.passed).length;
  const checksFailed = qaResult.checks.filter(c => !c.passed).length;

  completeStep(
    gateStep.id,
    {
      verdict: qaResult.verdict,
      confidence: qaResult.confidence,
      checks_passed: checksPassed,
      checks_failed: checksFailed,
    },
    qaResult.confidence,
    qaResult.verdict === 'PASS' ? 'done' : 'failed'
  );

  // Step 2: Brain review — gemma3:12b reviews the gate output and adds narrative
  const brainStep = recordStep(pipeline_id, DEPT_ID, 'qa_brain_review', {
    gate_verdict: qaResult.verdict,
  });

  const brain = getBrainForDept(DEPT_ID);
  const gateText = formatQaResult(qaResult);
  const checksDetail = qaResult.checks
    .map(c => `${c.passed ? '✅' : '❌'} ${c.name}: ${c.detail}`)
    .join('\n');

  const brainPrompt = [
    `CEO Command: "${original_command}"`,
    `Executed by dept: ${exec_dept_id}`,
    `Evidence steps found: ${steps.length}`,
    '',
    `QA Gate Result:`,
    gateText,
    '',
    `Check Details:`,
    checksDetail,
    '',
    qaResult.verdict === 'PASS'
      ? 'Confirm this is a genuine PASS. State what was verified.'
      : `The execution FAILED. State clearly: what is missing, what the CEO must know, and what must happen before re-run.`,
  ].join('\n');

  let brainNarrative = '';
  try {
    const resp = await callBrain(brain, brainPrompt);
    brainNarrative = resp.text.trim();
    completeStep(brainStep.id, { narrative_length: brainNarrative.length }, qaResult.confidence);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    brainNarrative = `QA brain unavailable: ${msg}. Gate result stands: ${qaResult.verdict}.`;
    completeStep(brainStep.id, { error: msg }, qaResult.confidence * 0.8, 'failed');
  }

  const finalSummary = qaResult.verdict === 'PASS'
    ? `✅ QA PASS — ${checksPassed}/${qaResult.checks.length} checks cleared. ${brainNarrative.substring(0, 200)}`
    : `❌ QA FAIL — ${checksFailed} check(s) failed. ${qaResult.blocking_reason || ''}. ${brainNarrative.substring(0, 200)}`;

  return {
    dept_id: DEPT_ID,
    dept_name: 'QA Department',
    summary: finalSummary,
    result: brainNarrative || gateText,
    status: qaResult.verdict === 'PASS' ? 'done' : 'failed',
    evidence_count: steps.length,
    confidence: qaResult.confidence,
    qa_verdict: qaResult.verdict,
    checks_passed: checksPassed,
    checks_failed: checksFailed,
    blocking_reason: qaResult.blocking_reason,
    evidence_steps_reviewed: steps.length,
    brain_verdict: brainNarrative,
  };
}
