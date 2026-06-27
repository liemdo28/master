import { getAllTasks } from '../../executive-coordination/task-registry';
import { detectDuplicates } from '../../executive-coordination/duplicate-detector';
import { detectAllConflicts } from '../../executive-coordination/conflict-engine';
import { buildEdges, topologicalOrder } from '../../executive-coordination/dependency-graph';
import { getPendingApprovals } from '../../executive-coordination/approval-registry';
import type { CrossDivisionCoordinationReport } from '../types';

export function buildCrossDivisionCoordinationReport(): CrossDivisionCoordinationReport {
  const tasks = getAllTasks();
  const duplicates = detectDuplicates(tasks);
  const conflicts = detectAllConflicts(tasks);
  const dependency = topologicalOrder(tasks);
  const pendingApprovals = getPendingApprovals();
  const edges = buildEdges(tasks);
  const ownerCoverage: Record<string, number> = {};
  let orphanTasks = 0;

  for (const task of tasks) {
    if (!task.owner || !task.division || !task.objectiveId) orphanTasks++;
    ownerCoverage[task.owner] = (ownerCoverage[task.owner] || 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    duplicateTasks: duplicates.length,
    orphanTasks,
    conflictingOwners: conflicts.length,
    workflowDuplicates: duplicates.filter(d => d.reason.toLowerCase().includes('workflow')).length,
    dependencyChains: edges.length + (dependency.order.length > 0 ? 1 : 0),
    pendingApprovals: pendingApprovals.length,
    ownerCoverage,
    healthy: orphanTasks === 0 && !dependency.hasCycle,
  };
}

export function buildDependencyGraphProof() {
  const tasks = getAllTasks();
  const edges = buildEdges(tasks);
  const topo = topologicalOrder(tasks);
  return {
    taskCount: tasks.length,
    edgeCount: edges.length,
    hasCycle: topo.hasCycle,
    topologicalOrder: topo.order,
    proof: topo.hasCycle ? 'BLOCKED_DEPENDENCY_CYCLE' : 'DEPENDENCY_GRAPH_VALID',
  };
}

export function buildDedupEngineProof() {
  const tasks = getAllTasks();
  const duplicates = detectDuplicates(tasks);
  return {
    taskCount: tasks.length,
    duplicatePairs: duplicates.length,
    duplicates,
    proof: duplicates.length === 0 ? 'NO_DUPLICATES_DETECTED' : 'DUPLICATES_DETECTED_FOR_REVIEW',
  };
}
