/**
 * GOAL_QUERY — directive §15. Direct read path against the canonical
 * Personal OS goal store; never a second goal-tracking implementation.
 */
import { personalOs } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handleGoalQuery(requestId: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'GOAL_QUERY', projectId);
  const goals = personalOs.store.listGoals().filter(g => !projectId || g.projectIds?.includes(projectId));

  if (goals.length === 0) {
    response.answer = projectId ? 'No goals found for this project.' : 'No goals found.';
    return response;
  }

  const active = goals.filter(g => g.status === 'ACTIVE');
  response.answer = [
    `${goals.length} goal(s), ${active.length} active.`,
    ...goals.slice(0, 20).map(g => `- [${g.status}] ${g.title}`),
  ].join('\n');
  response.facts = goals.slice(0, 20).map(g => ({ kind: 'FACT' as const, statement: `Goal "${g.title}" is ${g.status}.` }));
  response.evidenceRefs = goals.slice(0, 20).map(g => `goal:${g.id}`);
  return response;
}
