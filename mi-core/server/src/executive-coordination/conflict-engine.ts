/**
<<<<<<< a471ef81
 * Phase 0H — Conflict Engine
 *
 * Detect tasks that should not run together.
 *
 * Conflict types:
 *   resource_contention       — same owner, multiple in-flight tasks
 *   simultaneous_modify       — two tasks modifying same target (same file, workflow, etc.)
 *   dependency_cycle           — circular dependency detected
 *   same_deployment_target     — two tasks deploying to same target
 *   same_workflow_target       — two tasks modifying same n8n workflow
 *   production_freeze          — production task during freeze window
 *   approval_conflict          — conflicting approval requests
 *   contradictory_objective    — objectives with contradictory goals
 */
import { Task, ConflictRecord } from './types';
import {
  loadCollection, saveRecord, loadRecord, genId, nowIso,
} from './persistence';
import { getAllEdges } from './dependency-graph';

const SUBDIR = 'conflicts';

export function detectAllConflicts(tasks: Task[]): ConflictRecord[] {
  const newConflicts: ConflictRecord[] = [];

  const activeTasks = tasks.filter(t =>
    t.status !== 'DONE' && t.status !== 'CANCELLED' && t.status !== 'FAILED',
  );

  // 1. Resource contention — same owner with multiple in-flight tasks
  const byOwner = new Map<string, Task[]>();
  for (const t of activeTasks) {
    if (!t.owner || t.owner === 'unassigned') continue;
    if (!byOwner.has(t.owner)) byOwner.set(t.owner, []);
    byOwner.get(t.owner)!.push(t);
  }
  for (const [owner, ownerTasks] of byOwner) {
    if (ownerTasks.length > 1) {
      const ids = ownerTasks.map(t => t.id);
      const conf: ConflictRecord = {
        id: genId('CFR'),
        taskIds: ids,
        conflictType: 'resource_contention',
        description: `Owner '${owner}' has ${ownerTasks.length} tasks in-flight`,
        severity: ownerTasks.some(t => t.priority === 'P0') ? 'critical' : 'medium',
        blockedTaskId: ids[1] || null,
        resolved: false,
        createdAt: nowIso(),
        resolvedAt: null,
      };
      // Avoid creating duplicates
      const existing = loadCollection<ConflictRecord>(SUBDIR);
      const alreadyExists = existing.some(e =>
        !e.resolved &&
        e.conflictType === 'resource_contention' &&
        e.taskIds.length === ids.length &&
        ids.every(id => e.taskIds.includes(id)),
      );
      if (!alreadyExists) {
        saveRecord(SUBDIR, conf);
        newConflicts.push(conf);
      }
    }
  }

  // 2. Simultaneous modify — two tasks touching same target (derived from title/description)
  const taskTargets = new Map<string, string[]>();
  for (const t of activeTasks) {
    const text = `${t.title} ${t.description}`.toLowerCase();
    const targets: string[] = [];
    // Extract potential target references
    const fileRefs = text.match(/(?:file|page|component|config|workflow|api)[\s:]+(\S+)/g) || [];
    targets.push(...fileRefs);
    // Also check if they share keywords that indicate same target
    if (t.title.match(/(deploy|push|merge)/i) && t.title.match(/dashboard/i)) targets.push('dashboard');
    taskTargets.set(t.id, targets);
  }

  const targetTasks = new Map<string, string[]>();
  for (const [taskId, targets] of taskTargets) {
    for (const tgt of targets) {
      if (!targetTasks.has(tgt)) targetTasks.set(tgt, []);
      targetTasks.get(tgt)!.push(taskId);
    }
  }
  for (const [target, taskIds] of targetTasks) {
    if (taskIds.length >= 2) {
      const conf: ConflictRecord = {
        id: genId('CFR'),
        taskIds,
        conflictType: 'simultaneous_modify',
        description: `Multiple tasks targeting same entity: ${target}`,
        severity: 'high',
        blockedTaskId: taskIds[1] || null,
        resolved: false,
        createdAt: nowIso(),
        resolvedAt: null,
      };
      const existing = loadCollection<ConflictRecord>(SUBDIR);
      const alreadyExists = existing.some(e =>
        !e.resolved &&
        e.conflictType === 'simultaneous_modify' &&
        e.taskIds.length === taskIds.length &&
        taskIds.every(id => e.taskIds.includes(id)),
      );
      if (!alreadyExists) {
        saveRecord(SUBDIR, conf);
        newConflicts.push(conf);
      }
    }
  }

  // 3. Dependency cycles
  const adj = new Map<string, string[]>();
  for (const t of activeTasks) adj.set(t.id, []);
  const edges = getAllEdges().filter(e => e.type === 'blocks' || e.type === 'depends_on');
  for (const e of edges) {
    if (adj.has(e.fromTaskId)) adj.get(e.fromTaskId)!.push(e.toTaskId);
  }
  const visited = new Set<string>();
  const stack = new Set<string>();
  function findCycle(node: string, path: string[]): string[] | null {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      return idx >= 0 ? path.slice(idx) : [];
    }
    if (visited.has(node)) return null;
    visited.add(node);
    stack.add(node);
    for (const nxt of adj.get(node) ?? []) {
      const cyc = findCycle(nxt, [...path, node]);
      if (cyc) { stack.delete(node); return cyc; }
    }
    stack.delete(node);
    return null;
  }
  for (const t of activeTasks) {
    if (!visited.has(t.id)) {
      const cycle = findCycle(t.id, []);
      if (cycle && cycle.length > 0) {
        const conf: ConflictRecord = {
          id: genId('CFR'),
          taskIds: cycle,
          conflictType: 'dependency_cycle',
          description: `Dependency cycle detected: ${cycle.join(' → ')} → ${cycle[0]}`,
          severity: 'critical',
          blockedTaskId: cycle[cycle.length - 1] || null,
          resolved: false,
          createdAt: nowIso(),
          resolvedAt: null,
        };
        const existing = loadCollection<ConflictRecord>(SUBDIR);
        const alreadyExists = existing.some(e =>
          !e.resolved && e.conflictType === 'dependency_cycle',
        );
        if (!alreadyExists) {
          saveRecord(SUBDIR, conf);
          newConflicts.push(conf);
=======
 * Phase 0 — Conflict Detection Engine
 *
 * Detects simultaneous work conflicts:
 *  1. Two tasks modifying the same target at the same time
 *  2. Resource contention (same owner, both in-progress, both high-priority)
 *  3. Dependency cycles
 */

import type { CoordinatedTask, TaskConflict } from './types';
import { findCycles } from './dependency-graph';

// ── Resource Contention ────────────────────────────────────────────────────

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
>>>>>>> origin/seo/phase-29-revenue-execution-loop
        }
      }
    }
  }
<<<<<<< a471ef81

  return newConflicts;
}

export function hasActiveConflict(taskId: string): boolean {
  const all = loadCollection<ConflictRecord>(SUBDIR);
  return all.some(c => !c.resolved && c.taskIds.includes(taskId));
}

export function resolveConflict(conflictId: string, resolvedBy: string = 'system'): ConflictRecord | null {
  const rec = loadRecord<ConflictRecord>(SUBDIR, conflictId);
  if (!rec) return null;
  rec.resolved = true;
  rec.resolvedAt = nowIso();
  saveRecord(SUBDIR, rec);
  return rec;
}

export function summarizeConflicts(tasks: Task[]): {
  total: number; unresolved: number; byType: Record<string, number>;
} {
  const all = loadCollection<ConflictRecord>(SUBDIR);
  const unresolved = all.filter(c => !c.resolved);
  const byType: Record<string, number> = {};
  for (const c of unresolved) byType[c.conflictType] = (byType[c.conflictType] ?? 0) + 1;
  return { total: all.length, unresolved: unresolved.length, byType };
=======
  return conflicts;
}

// ── Same-Target Conflict ────────────────────────────────────────────────────
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

// ── Cycle Conflict ──────────────────────────────────────────────────────────

function detectCycleConflicts(tasks: CoordinatedTask[]): TaskConflict[] {
  const cycles = findCycles(tasks);
  return cycles.map(cycle => ({
    taskA: cycle[0],
    taskB: cycle[cycle.length - 2] || cycle[0],
    conflictType: 'dependency-cycle' as const,
    description: `Dependency cycle: ${cycle.join(' -> ')}`,
  }));
}

// ── Main ───────────────────────────────────────────────────────────────────

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
>>>>>>> origin/seo/phase-29-revenue-execution-loop
}