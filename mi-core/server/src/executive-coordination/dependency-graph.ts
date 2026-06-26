 * Phase 0 â€” Dependency Graph Engine
 *
 * Builds dependency graph from task.dependencies arrays.
 * Provides: topological order, downstream/upstream impact, cycle detection.
 */

import type { CoordinatedTask, DependencyEdge } from './types';

// â”€â”€ Build Edges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function buildEdges(tasks: CoordinatedTask[]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      edges.push({ from: dep, to: task.id });
    }
  }
  return edges;
}

// â”€â”€ Adjacency Map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// outgoing[id] = tasks that `id` depends on (parents â€” must complete first)
// incoming[id] = tasks that depend on `id` (children â€” will run after `id`)

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

// â”€â”€ Topological Sort (Kahn's Algorithm) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Downstream Impact â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Upstream Blockers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function getUpstream(tasks: CoordinatedTask[], taskId: string): string[] {
  const task = tasks.find(t => t.id === taskId);
  return task ? [...task.dependencies] : [];
}

// â”€â”€ Cycle Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Chain Description â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  return parts.reverse().join(' â†’ ');