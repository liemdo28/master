/**
 * CODING — directive §22. Routes to the canonical Coding Engine
 * (coding/workflow.ts CodingWorkflow) exclusively; never duplicates coding
 * agent logic in the Gateway.
 *
 * Calls `planTask()` (read-plan-only — builds context/candidates/plan
 * without running or mutating anything) rather than `run()` (which executes
 * a real coding task: worktree creation, model generation, patch
 * application, validation commands). This matches §15's "direct read path
 * when safe" and §17's simulation-first philosophy applied to coding: the
 * Gateway shows what the Coding Engine would do and points to the real
 * execution endpoint, it does not itself kick off a potentially slow, real,
 * file-mutating task inline in a conversational request.
 */
import { codingWorkflow } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export async function handleCoding(requestId: string, text: string, projectId: string | null): Promise<JarvisResponse> {
  const response = baseResponse(requestId, 'CODING', projectId);

  if (!projectId) {
    response.status = 'NEEDS_CLARIFICATION';
    response.answer = 'Which project is this coding request for?';
    response.unknowns = ['projectId'];
    return response;
  }

  try {
    const plan = await codingWorkflow.planTask({ userRequest: text, projectId });
    response.answer = `Coding plan ready for task ${plan.task.id}: ${plan.plan?.summary ?? 'plan generated'}. To actually run it, use Command Center → Coding or POST /api/coding/tasks/${plan.task.id}/run.`;
    response.evidenceRefs = [`coding-task:${plan.task.id}`];
    response.suggestedNextSteps = [`Review the plan, then run it from Command Center → Coding.`];
    response.status = 'ANSWERED';
  } catch (err) {
    response.status = 'FAILED';
    response.answer = `Could not build a coding plan: ${err instanceof Error ? err.message : 'unknown error'}.`;
  }
  return response;
}
