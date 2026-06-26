/**
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
}