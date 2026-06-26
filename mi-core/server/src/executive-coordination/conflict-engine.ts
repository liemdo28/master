 * Phase 0 â€” Conflict Detection Engine
 *
 * Detects simultaneous work conflicts:
 *  1. Two tasks modifying the same target at the same time
 *  2. Resource contention (same owner, both in-progress, both high-priority)
 *  3. Dependency cycles
 */

import type { CoordinatedTask, TaskConflict } from './types';
import { findCycles } from './dependency-graph';

// â”€â”€ Resource Contention â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function detectResourceContention(tasks: CoordinatedTask[]): TaskConflict[] {
  const conflicts: TaskConflict[] = [];
  const inProgress = tasks.filter(t => t.status === 'in-progress' || t.status === 'assigned');

  const byOwner = new Map<string, CoordinatedTask[]>();
  for (const t of inProgress) {
    if (!byOwner.has(t.owner)) byOwner.set(t.owner, []);
    byOwner.get(t.owner)!.push(t);
  }

  for (const [owner, ownerTasks] of byOwner.entries()) {
    if (ownerTasks.length < 2) continue;
    for (let i = 0; i < ownerTasks.length; i++) {
      for (let j = i + 1; j < ownerTasks.length; j++) {
        const a = ownerTasks[i];
        const b = ownerTasks[j];
        if (a.priority === 'P0' || b.priority === 'P0' || a.priority === 'P1') {
          conflicts.push({
            taskA: a.id,
            taskB: b.id,
            conflictType: 'resource-contention',
            description: `Owner "${owner}" has ${ownerTasks.length} tasks in-flight simultaneously`,
          });
  return conflicts;
}

// â”€â”€ Same-Target Conflict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Check if both tasks share a "targetable" content noun and both modify it.
// Shared noun = meaningful 5+ char word that both titles contain.

function extractSharedNouns(a: string, b: string): string[] {
  const stop = new Set(['the', 'a', 'an', 'and', 'for', 'with', 'from', 'this', 'that']);
  const getTokens = (t: string) => t.toLowerCase().split(/\s+/).filter(w => w.length >= 4 && !stop.has(w));
  const tokensA = new Set(getTokens(a));
  const tokensB = new Set(getTokens(b));
  return [...tokensA].filter(t => tokensB.has(t));
}

function detectSameTargetConflict(tasks: CoordinatedTask[]): TaskConflict[] {
  const conflicts: TaskConflict[] = [];
  const inProgress = tasks.filter(t => t.status === 'in-progress' || t.status === 'assigned');

  for (let i = 0; i < inProgress.length; i++) {
    for (let j = i + 1; j < inProgress.length; j++) {
      const a = inProgress[i];
      const b = inProgress[j];

      const modifyKeywords = /(deploy|modify|update|change|edit|push|merge|rollback|build|create|fix)/i;
      if (!modifyKeywords.test(a.title) || !modifyKeywords.test(b.title)) continue;

      const sharedNouns = extractSharedNouns(a.title, b.title);
      if (sharedNouns.length > 0) {
        conflicts.push({
          taskA: a.id,
          taskB: b.id,
          conflictType: 'simultaneous-modify',
          description: `Both tasks modifying "${sharedNouns[0]}": ${a.title} + ${b.title}`,
        });
      }
    }
  }
  return conflicts;
}

// â”€â”€ Cycle Conflict â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function detectCycleConflicts(tasks: CoordinatedTask[]): TaskConflict[] {
  const cycles = findCycles(tasks);
  return cycles.map(cycle => ({
    taskA: cycle[0],
    taskB: cycle[cycle.length - 2] || cycle[0],
    conflictType: 'dependency-cycle' as const,
    description: `Dependency cycle: ${cycle.join(' -> ')}`,
  }));
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function detectAllConflicts(tasks: CoordinatedTask[]): TaskConflict[] {
  return [
    ...detectResourceContention(tasks),
    ...detectSameTargetConflict(tasks),
    ...detectCycleConflicts(tasks),
  ];
}

export function hasActiveConflict(taskId: string, conflicts: TaskConflict[]): boolean {
  return conflicts.some(c => c.taskA === taskId || c.taskB === taskId);
}

export function summarizeConflicts(conflicts: TaskConflict[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const c of conflicts) summary[c.conflictType] = (summary[c.conflictType] || 0) + 1;
  return summary;