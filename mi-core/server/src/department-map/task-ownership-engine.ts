/**
 * task-ownership-engine.ts
 * Assigns and tracks task ownership per department.
 */
import type { DepartmentId } from './department-registry';
import { resolveOwner } from './department-registry';

export interface TaskOwnership {
  task_id: string;
  description: string;
  owner: DepartmentId;
  supporters: DepartmentId[];
  created_at: string;
  updated_at: string;
  status: 'owned' | 'handoff_pending' | 'completed';
}

const taskOwnershipMap = new Map<string, TaskOwnership>();

export function assignTaskOwnership(
  taskId: string,
  description: string,
  owner?: DepartmentId,
  supporters: DepartmentId[] = []
): TaskOwnership {
  const resolvedOwner = owner ?? resolveOwner(description);
  const now = new Date().toISOString();

  const entry: TaskOwnership = {
    task_id: taskId,
    description,
    owner: resolvedOwner,
    supporters,
    created_at: now,
    updated_at: now,
    status: 'owned',
  };

  taskOwnershipMap.set(taskId, entry);
  return entry;
}

export function getTaskOwnership(taskId: string): TaskOwnership | null {
  return taskOwnershipMap.get(taskId) ?? null;
}

export function updateTaskOwnership(taskId: string, updates: Partial<TaskOwnership>): TaskOwnership | null {
  const existing = taskOwnershipMap.get(taskId);
  if (!existing) return null;
  const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
  taskOwnershipMap.set(taskId, updated);
  return updated;
}

export function handoffTask(taskId: string, from: DepartmentId, to: DepartmentId): TaskOwnership | null {
  const existing = taskOwnershipMap.get(taskId);
  if (!existing) return null;
  if (existing.owner !== from) return null; // only current owner can handoff

  const updated: TaskOwnership = {
    ...existing,
    owner: to,
    supporters: [...new Set([...existing.supporters, from])],
    updated_at: new Date().toISOString(),
    status: 'handoff_pending',
  };

  taskOwnershipMap.set(taskId, updated);
  return updated;
}

export function listTasksByDepartment(dept: DepartmentId): TaskOwnership[] {
  return [...taskOwnershipMap.values()].filter((t) => t.owner === dept);
}
