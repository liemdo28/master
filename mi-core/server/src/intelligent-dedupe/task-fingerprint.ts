/**
 * task-fingerprint.ts
 * Fingerprints tasks to detect duplicate task creation.
 */
import { createHash } from 'crypto';

export interface TaskFingerprintInput {
  task_text: string;
  owner_department: string;
  objective_id?: string;
  parent_task_id?: string;
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, '');
}

export function buildTaskFingerprint(input: TaskFingerprintInput): string {
  const parts = [
    normalize(input.task_text),
    normalize(input.owner_department),
    input.objective_id ?? '',
    input.parent_task_id ?? '',
  ];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function buildTaskFingerprintKey(input: TaskFingerprintInput): string {
  const parts = [
    normalize(input.task_text),
    normalize(input.owner_department),
  ];
  return parts.join('|');
}

export function areTasksDuplicate(a: TaskFingerprintInput, b: TaskFingerprintInput): boolean {
  return buildTaskFingerprintKey(a) === buildTaskFingerprintKey(b);
}
