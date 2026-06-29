/**
 * task-contamination-guard.ts
 * Prevents task evidence from being attached to wrong tasks.
 */
import type { DepartmentId } from '../department-map/department-registry';

export interface EvidenceAttachment {
  evidence_id: string;
  task_id: string;
  attached_by: DepartmentId;
  attached_at: string;
}

const evidenceTaskMap = new Map<string, string>(); // evidence_id -> task_id
const taskEvidenceMap = new Map<string, string[]>(); // task_id -> evidence_ids

export function attachEvidence(evidenceId: string, taskId: string, dept: DepartmentId): { allowed: boolean; reason: string } {
  const existing = evidenceTaskMap.get(evidenceId);
  if (existing && existing !== taskId) {
    return { allowed: false, reason: `Evidence ${evidenceId} already attached to task ${existing}` };
  }

  evidenceTaskMap.set(evidenceId, taskId);
  const existingEvidence = taskEvidenceMap.get(taskId) ?? [];
  taskEvidenceMap.set(taskId, [...existingEvidence, evidenceId]);

  return { allowed: true, reason: `Evidence ${evidenceId} attached to task ${taskId}` };
}

export function detachEvidence(evidenceId: string): void {
  const taskId = evidenceTaskMap.get(evidenceId);
  if (taskId) {
    const evidenceList = taskEvidenceMap.get(taskId) ?? [];
    taskEvidenceMap.set(taskId, evidenceList.filter((e) => e !== evidenceId));
    evidenceTaskMap.delete(evidenceId);
  }
}

export function getEvidenceForTask(taskId: string): string[] {
  return taskEvidenceMap.get(taskId) ?? [];
}

export function getTaskForEvidence(evidenceId: string): string | null {
  return evidenceTaskMap.get(evidenceId) ?? null;
}
