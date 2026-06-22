/**
 * Mi Company OS — Department Runtime
 * Wires brain + tools for any department.
 * Called by the execution-pipeline for steps 6-8.
 *
 * Flow: gather tool context → call brain with context → store evidence → return DeptReport
 */

import { getBrainForDept, callBrain, verifyBrain } from './brain-registry';
import { gatherToolContext } from './tool-registry';
import { recordStep, completeStep } from './evidence-store';
import type { DeptReport } from './report-center';

export interface RuntimeInput {
  pipeline_id: string;
  dept_id: string;
  intent: string;
  command: string;
  extra_context?: string;
}

export interface RuntimeOutput extends DeptReport {
  tools_used: string[];
  tools_failed: string[];
  brain_model: string;
  duration_ms: number;
  raw_response?: string;
}

/**
 * Execute a department against a CEO command.
 * Returns a fully-evidenced DeptReport with real brain response.
 */
export async function runDepartment(input: RuntimeInput): Promise<RuntimeOutput> {
  const { pipeline_id, dept_id, intent, command } = input;
  const start = Date.now();

  const brain = getBrainForDept(dept_id);

  // Step A: gather tool context
  const toolStep = recordStep(pipeline_id, dept_id, 'tool_gather', { dept_id, intent });
  let toolContext: { context: string; tools_used: string[]; tools_failed: string[] };

  try {
    toolContext = await gatherToolContext(dept_id, { pipeline_id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    toolContext = { context: `Tool gather failed: ${msg}`, tools_used: [], tools_failed: ['all'] };
  }

  completeStep(toolStep.id, {
    tools_used: toolContext.tools_used,
    tools_failed: toolContext.tools_failed,
  }, toolContext.tools_failed.length === 0 ? 0.95 : 0.70);

  // Step B: call brain with context
  const brainStep = recordStep(pipeline_id, dept_id, 'brain_inference', {
    model: brain.model,
    intent,
  });

  let brainResp: { text: string; model: string; duration_ms: number };
  let brainConfidence = 0;

  try {
    const contextPayload = [
      input.extra_context ? `Additional context:\n${input.extra_context}` : '',
      toolContext.context,
    ].filter(Boolean).join('\n\n');

    brainResp = await callBrain(brain, `CEO Command: ${command}\nIntent: ${intent}\n\nPlease handle this request.`, contextPayload || undefined);
    // Confidence scales with response quality: longer real responses = higher confidence
    brainConfidence = brainResp.text.length > 200 ? 0.90
                    : brainResp.text.length > 50  ? 0.85
                    : brainResp.text.length > 20  ? 0.80
                    : 0.40;
    completeStep(brainStep.id, { response_length: brainResp.text.length, model: brainResp.model }, brainConfidence);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    brainResp = { text: `Brain unavailable: ${msg}`, model: brain.model, duration_ms: 0 };
    brainConfidence = 0;
    completeStep(brainStep.id, { error: msg }, 0, 'failed');
  }

  const duration = Date.now() - start;
  const failed = brainConfidence === 0;

  return {
    dept_id,
    dept_name: brain.dept_id,
    summary: brainResp.text.substring(0, 500),
    result: brainResp.text,
    status: failed ? 'failed' : 'done',
    evidence_count: 2, // tool_gather + brain_inference
    confidence: brainConfidence,
    tools_used: toolContext.tools_used,
    tools_failed: toolContext.tools_failed,
    brain_model: brainResp.model,
    duration_ms: duration,
    raw_response: brainResp.text,
  };
}

/**
 * Quick brain health check — used by QA to verify brain is online before run.
 */
export async function checkBrainHealth(deptId: string): Promise<{
  dept_id: string;
  brain_name: string;
  model: string;
  online: boolean;
}> {
  const brain = getBrainForDept(deptId);
  const online = await verifyBrain(brain);
  return { dept_id: deptId, brain_name: brain.brain_name, model: brain.model, online };
}
