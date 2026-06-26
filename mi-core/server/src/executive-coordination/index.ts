/**
 * The missing management layer between CEO/Mi and all future divisions.
 * 
 * Pipeline: Objective â†’ Tasks â†’ Ownership â†’ Duplicates â†’ Dependencies â†’ 
 *           Priority â†’ Conflicts â†’ Approvals â†’ Evidence â†’ Dashboard
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
 * Full coordination pipeline â€” one call does everything.
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

  const allTasks: any[] = [];
  const objective = createRegisteredObjective(objectiveTitle, 'ceo');
  for (const t of tasks) {
    const priority = autoClassify(t.title, t.description);
    const created = createRegTask({
      objectiveId: objective.id,
      title: t.title,
      description: t.description,
      division: t.division,
      owner: t.owner,
      priority: priority.priority,
      dependencies: t.dependencies || [],
    });
    allTasks.push(created);
  }
  detectDuplicates(allTasks);
  detectAllConflicts(allTasks);
  return buildDashboard(allTasks, objectiveTitle);
}
