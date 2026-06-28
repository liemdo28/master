/**
 * duplicate-task-resolver.ts — reuse the proven coordination duplicate detector.
 *
 * Wraps `executive-coordination/duplicate-detector` so the semantic workflow
 * avoids creating overlapping tasks (single source of dedup truth).
 */
import { detectDuplicates } from '../executive-coordination/duplicate-detector';
import type { CoordinatedTask } from '../executive-coordination/types';

export interface DedupResult {
  kept: CoordinatedTask[];
  merged: Array<{ duplicate: string; canonical: string; reason: string }>;
}

export function resolveDuplicates(tasks: CoordinatedTask[]): DedupResult {
  const matches = detectDuplicates(tasks);
  const merged: DedupResult['merged'] = [];
  const droppedIds = new Set<string>();
  for (const m of matches) {
    // Keep the first task as canonical, mark the second as a merge.
    if (droppedIds.has(m.taskB)) continue;
    merged.push({ duplicate: m.taskB, canonical: m.taskA, reason: m.reason });
    droppedIds.add(m.taskB);
  }
  return { kept: tasks.filter((t) => !droppedIds.has(t.id)), merged };
}
