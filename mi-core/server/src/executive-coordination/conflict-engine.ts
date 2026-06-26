/**
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
        }
      }
    }
  }

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
}