/**
 * Phase 0 — Executive Coordination Division (Main Entry)
 * 
 * The missing management layer between CEO/Mi and all future divisions.
 * 
 * Pipeline: Objective → Tasks → Ownership → Duplicates → Dependencies → 
 *           Priority → Conflicts → Approvals → Evidence → Dashboard
 */

export { createTask, updateTaskStatus, addEvidence, getTask, getAllTasks, getBlockedTasks, getPendingApprovals, getBlockingDependencies, getTasksByObjective, getTasksByDivision } from './task-registry';
export { detectDuplicates, markDuplicate, getDuplicateSummary } from './duplicate-detector';
export { buildEdges, topologicalOrder, getDownstream, getUpstream, findCycles, describeChain } from './dependency-graph';
export { autoClassify, sortByPriority, prioritizeTask, priorityBreakdown } from './priority-engine';
export { detectAllConflicts, hasActiveConflict, summarizeConflicts } from './conflict-engine';
export { routeTask } from './division-router';
export { createRegisteredObjective, getRegisteredObjectives } from './objective-registry';
export { addEvidenceRecord, getEvidenceRecords, getAllEvidenceRecords } from './evidence-registry';
export { buildDashboard, renderAsciiDashboard } from './executive-dashboard';
export type { CoordinatedTask, Division, Priority, TaskStatus, DashboardSnapshot, DuplicateMatch, TaskConflict, EvidenceRef } from './types';

/**
 * Full coordination pipeline — one call does everything.
 * 
 * CEO says: "Increase Raw Sushi Revenue 10%"
 * This function:
 *   1. Creates objective
 *   2. Decomposes into tasks (auto-routed to divisions)
 *   3. Detects duplicates
 *   4. Builds dependency graph
 *   5. Classifies priorities
 *   6. Detects conflicts
 *   7. Generates dashboard
 */
export function runCoordinationPipeline(
  objectiveTitle: string,
  tasks: Array<{ title: string; description: string; division: import('./types').Division; owner: string; dependencies?: string[] }>
): import('./types').DashboardSnapshot {
  const { createRegisteredObjective } = require('./objective-registry');
  const { createTask: createRegTask } = require('./task-registry');
  const { detectDuplicates } = require('./duplicate-detector');
  const { detectAllConflicts } = require('./conflict-engine');
  const { autoClassify } = require('./priority-engine');
  const { buildDashboard } = require('./executive-dashboard');

  // 1. Create objective
  const obj = createRegisteredObjective(objectiveTitle, 'ceo');

  // 2. Create tasks
  const allTasks: any[] = [];
  for (const t of tasks) {
    const priority = autoClassify(t.title, t.description);
    const created = createRegTask({
      objectiveId: obj.id,
      title: t.title,
      description: t.description,
      division: t.division,
      owner: t.owner,
      priority: priority.priority,
      dependencies: t.dependencies || [],
    });
    allTasks.push(created);
  }

  // 3. Detect duplicates
  const duplicates = detectDuplicates(allTasks);

  // 4. Detect conflicts
  const conflicts = detectAllConflicts(allTasks);

  // 5. Build dashboard
  return buildDashboard(allTasks, objectiveTitle);
}
