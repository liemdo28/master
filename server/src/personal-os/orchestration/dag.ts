// Deterministic dependency-graph validation for Phase 5H action plans.
// Pure functions only — no LLM is ever consulted for DAG correctness (directive §7).

export interface DagNode {
  key: string;
  dependsOnKeys: string[];
}

export interface DagValidationResult {
  valid: boolean;
  /** Topological order of step keys, valid only when `valid` is true. */
  order: string[];
  /** Step keys involved in a cycle, if any. */
  cycleKeys: string[];
  /** Dependency keys referenced by some step but not present in the plan. */
  unknownDependencyKeys: string[];
}

/**
 * Kahn's algorithm: builds a topological order and detects both cycles and
 * dangling dependency references in one pass. Deterministic for a given input —
 * ties are broken by input order, not by any heuristic.
 */
export function validateDag(nodes: DagNode[]): DagValidationResult {
  const known = new Set(nodes.map(n => n.key));
  const unknownDependencyKeys: string[] = [];
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.key, 0);
    adjacency.set(node.key, []);
  }
  for (const node of nodes) {
    for (const dep of node.dependsOnKeys) {
      if (!known.has(dep)) {
        unknownDependencyKeys.push(dep);
        continue;
      }
      adjacency.get(dep)!.push(node.key);
      inDegree.set(node.key, (inDegree.get(node.key) ?? 0) + 1);
    }
  }

  if (unknownDependencyKeys.length > 0) {
    return { valid: false, order: [], cycleKeys: [], unknownDependencyKeys };
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.key) ?? 0) === 0) queue.push(node.key);
  }
  const order: string[] = [];
  const remainingInDegree = new Map(inDegree);
  let cursor = 0;
  while (cursor < queue.length) {
    const key = queue[cursor];
    cursor += 1;
    order.push(key);
    for (const next of adjacency.get(key) ?? []) {
      const remaining = (remainingInDegree.get(next) ?? 0) - 1;
      remainingInDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (order.length !== nodes.length) {
    const cycleKeys = nodes.map(n => n.key).filter(key => !order.includes(key));
    return { valid: false, order: [], cycleKeys, unknownDependencyKeys: [] };
  }

  return { valid: true, order, cycleKeys: [], unknownDependencyKeys: [] };
}

/**
 * A dependency is "satisfied" only when the dependency step COMPLETED.
 * WAITING_APPROVAL, RUNNING, PENDING never count as satisfied (directive §7).
 * FAILED or CANCELLED dependencies permanently block the dependent step.
 */
export function dependencyBlockState(
  dependencyStatuses: string[],
): 'SATISFIED' | 'WAITING' | 'BLOCKED_FAILED' | 'BLOCKED_CANCELLED' {
  if (dependencyStatuses.some(s => s === 'FAILED')) return 'BLOCKED_FAILED';
  if (dependencyStatuses.some(s => s === 'CANCELLED')) return 'BLOCKED_CANCELLED';
  if (dependencyStatuses.every(s => s === 'COMPLETED')) return 'SATISFIED';
  return 'WAITING';
}
