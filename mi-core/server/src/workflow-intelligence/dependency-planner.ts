/**
 * dependency-planner.ts — order workflow steps into a dependency-safe plan.
 *
 * Reuses the coordination dependency-graph (topological order + cycle check) so
 * the workflow runs steps in the correct sequence (e.g. baseline before action).
 */
import { buildEdges, topologicalOrder } from '../executive-coordination/dependency-graph';
import type { CoordinatedTask } from '../executive-coordination/types';

export interface DependencyPlan {
  order: string[];
  hasCycle: boolean;
  edges: number;
}

export function planDependencies(tasks: CoordinatedTask[]): DependencyPlan {
  const edges = buildEdges(tasks);
  const topo = topologicalOrder(tasks);
  return { order: topo.order, hasCycle: topo.hasCycle, edges: edges.length };
}
