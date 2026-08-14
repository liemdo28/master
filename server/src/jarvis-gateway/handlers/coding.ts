/**
 * CODING — directive §22. Never calls CodingWorkflow.planTask()/.run() —
 * both create a real Task record and a real git worktree via
 * `prepareWorktree()` (a genuine `git worktree add` filesystem/git
 * mutation), then invoke a coding model. Neither is a safe side effect to
 * trigger from unconfirmed conversational text — the Coding Engine has no
 * read-only/dry-run planning mode to call instead. This mirrors the same
 * "never call the mutating method, always redirect" pattern ACTION_PROPOSAL
 * uses for its own governed subsystem: the Gateway confirms the request was
 * understood and points to the real entrypoint, it never starts a coding
 * task itself. (An earlier version of this handler called `planTask()`
 * believing it was read-only; an independent review of PR #103 found both
 * that assumption was wrong and that no test exercised the resolved-project
 * success path where it would have mattered — fixed here.)
 */
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

  response.status = 'ANSWERED';
  response.answer = `Understood as a coding request for this project. The Gateway never starts a coding task automatically — planning one creates a real task record and git worktree. Open Command Center → Coding (or POST /api/coding/tasks) to review context, candidates, and the plan before anything runs.`;
  response.suggestedNextSteps = ['Open Command Center → Coding to create and review the task there.'];
  return response;
}
