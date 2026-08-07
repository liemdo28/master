/**
 * Pending Approval Control Center — a unified, read-only view over every place an
 * approval can currently be waiting. No action here ever approves, rejects, or
 * executes anything; the daily brief only surfaces what already exists.
 */

import type { TaskStore } from '../../task-runtime/store';
import type { PersonalOsStore } from '../store';
import type { PendingApprovalItem } from './types';

export function listPendingApprovals(deps: { taskStore: TaskStore; personalStore: PersonalOsStore }): PendingApprovalItem[] {
  const items: PendingApprovalItem[] = [];

  // Task Runtime: tasks explicitly waiting on the owner.
  for (const task of deps.taskStore.listTasks('WAITING_APPROVAL')) {
    items.push({
      id: `approval-task-${task.id}`,
      sourceType: 'TASK_RUNTIME',
      sourceId: task.id,
      title: task.userRequest.slice(0, 200) || `Task ${task.id}`,
      reason: task.resultSummary?.slice(0, 300) || 'awaiting approval before it may proceed',
      riskLevel: task.taskKind === 'coding' ? 'medium' : 'low',
      projectId: task.projectId,
      goalId: null,
      requestedAt: task.updatedAt,
      expiresAt: null,
      evidenceReferences: [`task:${task.id}`],
    });
  }

  // Personal OS: knowledge records still needing confirmation before they are trusted.
  for (const record of deps.personalStore.listKnowledge()) {
    if (record.status !== 'NEEDS_CONFIRMATION') continue;
    items.push({
      id: `approval-knowledge-${record.id}`,
      sourceType: 'KNOWLEDGE_CONFIRMATION',
      sourceId: record.id,
      title: record.title.slice(0, 200),
      reason: 'inferred knowledge candidate needs explicit confirmation before it is trusted',
      riskLevel: 'low',
      projectId: record.projectIds[0] ?? null,
      goalId: record.goalIds[0] ?? null,
      requestedAt: record.updatedAt,
      expiresAt: null,
      evidenceReferences: record.evidenceReferences.slice(0, 5),
    });
  }

  items.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
  return items;
}
