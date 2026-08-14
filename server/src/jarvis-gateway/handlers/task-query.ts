/**
 * TASK_QUERY — directive §15. Direct read path against the canonical Task
 * Runtime store; never a second task-tracking implementation.
 */
import { taskStore } from '../services';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export function handleTaskQuery(requestId: string, projectId: string | null): JarvisResponse {
  const response = baseResponse(requestId, 'TASK_QUERY', projectId);
  const tasks = taskStore.listTasks().filter(t => !projectId || t.projectId === projectId);
  const waiting = tasks.filter(t => t.status === 'WAITING_APPROVAL' || t.status === 'READY');

  if (tasks.length === 0) {
    response.status = 'ANSWERED';
    response.answer = projectId ? 'No tasks found for this project.' : 'No tasks found.';
    return response;
  }

  response.answer = [
    `${tasks.length} task(s)${projectId ? ' for this project' : ''}, ${waiting.length} waiting on you.`,
    ...tasks.slice(0, 20).map(t => `- [${t.status}] ${t.userRequest}`),
  ].join('\n');
  response.facts = tasks.slice(0, 20).map(t => ({ kind: 'FACT' as const, statement: `Task "${t.userRequest}" is ${t.status}.` }));
  response.evidenceRefs = tasks.slice(0, 20).map(t => `task:${t.id}`);
  return response;
}
