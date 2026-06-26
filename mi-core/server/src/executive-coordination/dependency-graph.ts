/**
<<<<<<< a471ef81
 * Phase 0F — Dependency Graph
 *
 * Track dependency relationships between objectives, tasks, systems, credentials, approvals.
 *
 * Types: blocks | depends_on | related_to | duplicates | conflicts_with
 *        requires_approval | requires_credentials | requires_human
 *        produces_evidence | triggers
 */
import { Task, DependencyEdge, DependencyType, BlockerInfo } from './types';
import {
  loadCollection, saveRecord, deleteRecord, genId, nowIso,
} from './persistence';

const SUBDIR = 'dependencies';

export interface AddEdgeInput {
  fromTaskId: string;
  toTaskId: string;
  type: DependencyType;
}

export function buildEdges(inputs: AddEdgeInput[]): DependencyEdge[] {
  const created: DependencyEdge[] = [];
  for (const input of inputs) {
    const edge: DependencyEdge = {
      id: genId('EDG'),
      fromTaskId: input.fromTaskId,
      toTaskId: input.toTaskId,
      type: input.type,
      createdAt: nowIso(),
    };
    saveRecord(SUBDIR, edge);
    created.push(edge);
  }
  return created;
}

export function addEdge(input: AddEdgeInput): DependencyEdge {
  const edge: DependencyEdge = {
    id: genId('EDG'),
    fromTaskId: input.fromTaskId,
    toTaskId: input.toTaskId,
    type: input.type,
    createdAt: nowIso(),
  };
  saveRecord(SUBDIR, edge);
  return edge;
}

export function removeEdge(id: string): boolean {
  return deleteRecord(SUBDIR, id);
}

export function getAllEdges(): DependencyEdge[] {
  return loadCollection<DependencyEdge>(SUBDIR);
}

export function getEdgesForTask(taskId: string): DependencyEdge[] {
  return getAllEdges().filter(e =>
    e.fromTaskId === taskId || e.toTaskId === taskId,
  );
}

export function getEdgesForObjective(objectiveId: string, tasks: Task[]): DependencyEdge[] {
  const taskIds = new Set(tasks.filter(t => t.objectiveId === objectiveId).map(t => t.id));
  return getAllEdges().filter(e => taskIds.has(e.fromTaskId) || taskIds.has(e.toTaskId));
}

/**
 * Topological sort: returns task IDs in execution order.
 */
export function topologicalOrder(tasks: Task[]): string[] {
  const ids = new Set(tasks.map(t => t.id));
  const inDeg = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const t of tasks) { inDeg.set(t.id, 0); adj.set(t.id, []); }

  const edges = getAllEdges().filter(e =>
    e.type === 'blocks' || e.type === 'depends_on' || e.type === 'triggers',
  );
  for (const e of edges) {
    if (!ids.has(e.fromTaskId) || !ids.has(e.toTaskId)) continue;
    adj.get(e.fromTaskId)!.push(e.toTaskId);
    inDeg.set(e.toTaskId, (inDeg.get(e.toTaskId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, d] of inDeg) if (d === 0) queue.push(id);
  const out: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    out.push(id);
    for (const nxt of adj.get(id) ?? []) {
      const d = (inDeg.get(nxt) ?? 0) - 1;
      inDeg.set(nxt, d);
      if (d === 0) queue.push(nxt);
    }
  }
  return out;
}

export function getUpstream(taskId: string, tasks: Task[]): string[] {
  const ids = new Set(tasks.map(t => t.id));
  const out: string[] = [];
  const edges = getAllEdges().filter(e => e.type === 'blocks' || e.type === 'depends_on');
  for (const e of edges) {
    if (e.toTaskId === taskId && ids.has(e.fromTaskId)) out.push(e.fromTaskId);
  }
  return out;
}

export function getDownstream(taskId: string, tasks: Task[]): string[] {
  const ids = new Set(tasks.map(t => t.id));
  const out: string[] = [];
  const edges = getAllEdges().filter(e => e.type === 'blocks' || e.type === 'triggers');
  for (const e of edges) {
    if (e.fromTaskId === taskId && ids.has(e.toTaskId)) out.push(e.toTaskId);
  }
  return out;
}

export function findCycles(tasks: Task[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const t of tasks) adj.set(t.id, []);
  const edges = getAllEdges().filter(e => e.type === 'blocks' || e.type === 'depends_on');
  for (const e of edges) {
    if (adj.has(e.fromTaskId)) adj.get(e.fromTaskId)!.push(e.toTaskId);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]): void {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      if (idx >= 0) cycles.push([...path.slice(idx), node]);
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const nxt of adj.get(node) ?? []) dfs(nxt, [...path, node]);
    stack.delete(node);
  }

  for (const t of tasks) dfs(t.id, []);
  return cycles;
}

export function describeChain(taskId: string, tasks: Task[]): string {
  const upstream = getUpstream(taskId, tasks);
  const downstream = getDownstream(taskId, tasks);
  return `${upstream.join(' → ')} → ${taskId} → ${downstream.join(' → ')}`.replace(/\s+→\s+/g, ' → ');
}

export function checkBlockers(tasks: Task[]): BlockerInfo[] {
  const blockers: BlockerInfo[] = [];
  const byId = new Map(tasks.map(t => [t.id, t]));
  for (const t of tasks) {
    if (t.status === 'BLOCKED' || t.status === 'WAITING_DEPENDENCY') {
      const upstream = getUpstream(t.id, tasks);
      blockers.push({
        taskId: t.id,
        blockedBy: upstream.filter(id => {
          const u = byId.get(id);
          return u && u.status !== 'DONE' && u.status !== 'CANCELLED';
        }),
        reason: t.blockedReason ?? 'dependency-not-satisfied',
      });
    }
  }
  return blockers;
}

export function getBlockingDependencies(): BlockerInfo[] {
  return checkBlockers(loadCollection<Task>('tasks'));
=======
 * Phase 0 — Dependency Graph Engine
 *
 * Builds dependency graph from task.dependencies arrays.
 * Provides: topological order, downstream/upstream impact, cycle detection.
 */

import type { CoordinatedTask, DependencyEdge } from './types';

// ── Build Edges ─────────────────────────────────────────────────────────────

export function buildEdges(tasks: CoordinatedTask[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      edges.push({ from: dep, to: task.id });
    }
  }
  return edges;
}

// ── Adjacency Map ──────────────────────────────────────────────────────────
//
// outgoing[id] = tasks that `id` depends on (parents — must complete first)
// incoming[id] = tasks that depend on `id` (children — will run after `id`)

function buildAdjacency(tasks: CoordinatedTask[]): {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  nodeSet: Set<string>;
} {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const nodeSet = new Set<string>();

  for (const task of tasks) {
    nodeSet.add(task.id);
    outgoing.set(task.id, task.dependencies || []);
    incoming.set(task.id, []);
  }

  // Build reverse edges
  for (const task of tasks) {
    for (const dep of task.dependencies || []) {
      if (!nodeSet.has(dep)) {
        nodeSet.add(dep);
        outgoing.set(dep, []);
        incoming.set(dep, []);
      }
      incoming.get(dep)!.push(task.id);
    }
  }

  return { outgoing, incoming, nodeSet };
}

// ── Topological Sort (Kahn's Algorithm) ────────────────────────────────────

export function topologicalOrder(tasks: CoordinatedTask[]): { order: string[]; hasCycle: boolean } {
  const { outgoing, incoming, nodeSet } = buildAdjacency(tasks);
  const inDegree = new Map<string, number>();
  const queue: string[] = [];
  const order: string[] = [];

  // inDegree = number of outgoing edges (tasks this node depends on)
  for (const id of nodeSet) {
    const degree = (outgoing.get(id) || []).length;
    inDegree.set(id, degree);
    if (degree === 0) queue.push(id);
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    order.push(node);

    // When `node` is done, decrement inDegree of each child in `incoming[node]`
    const dependents = incoming.get(node) || [];
    for (const dep of dependents) {
      const degree = inDegree.get(dep)! - 1;
      inDegree.set(dep, degree);
      if (degree === 0) queue.push(dep);
    }
  }

  const hasCycle = order.length !== nodeSet.size;
  return { order, hasCycle };
}

// ── Downstream Impact ───────────────────────────────────────────────────────

export function getDownstream(tasks: CoordinatedTask[], taskId: string, maxDepth = 6): string[] {
  const { incoming } = buildAdjacency(tasks);
  const visited = new Set<string>();
  const result: string[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: taskId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (id !== taskId) result.push(id);
    if (depth >= maxDepth) continue;
    for (const child of incoming.get(id) || []) {
      queue.push({ id: child, depth: depth + 1 });
    }
  }

  return result;
}

// ── Upstream Blockers ───────────────────────────────────────────────────────

export function getUpstream(tasks: CoordinatedTask[], taskId: string): string[] {
  const task = tasks.find(t => t.id === taskId);
  return task ? [...task.dependencies] : [];
}

// ── Cycle Detection ─────────────────────────────────────────────────────────

export function findCycles(tasks: CoordinatedTask[]): string[][] {
  const { outgoing } = buildAdjacency(tasks);
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const pathStack: string[] = [];

  function dfs(node: string) {
    visited.add(node);
    inStack.add(node);
    pathStack.push(node);

    for (const child of outgoing.get(node) || []) {
      // Walk outgoing (dependencies) to detect cycles
      if (!visited.has(child)) {
        dfs(child);
      } else if (inStack.has(child)) {
        const cycleStart = pathStack.indexOf(child);
        cycles.push([...pathStack.slice(cycleStart), child]);
      }
    }

    pathStack.pop();
    inStack.delete(node);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) dfs(task.id);
  }

  return cycles;
}

// ── Chain Description ──────────────────────────────────────────────────────

export function describeChain(tasks: CoordinatedTask[], taskId: string): string {
  const taskMap = new Map(tasks.map(t => [t.id, t]));
  const visited = new Set<string>();
  const parts: string[] = [];

  function walk(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = taskMap.get(id);
    if (!task) return;
    parts.push(task.title);
    for (const dep of task.dependencies || []) walk(dep);
  }

  walk(taskId);
  return parts.reverse().join(' → ');
>>>>>>> origin/seo/phase-29-revenue-execution-loop
}