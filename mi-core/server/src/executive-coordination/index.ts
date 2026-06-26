/**
 * Phase 0 — Executive Coordination Division (Main Entry)
<<<<<<< a471ef81
 *
 * The missing management layer between CEO/Mi and all future divisions.
 *
 * Pipeline: Objective → Tasks → Ownership → Duplicates → Dependencies →
 *           Priority → Conflicts → Approvals → Evidence → Dashboard
 */
// ── Types first (type-only re-exports) ────────────────────────────────────
export type {
  Objective, ObjectiveStatus, Task, TaskStatus, TaskSeverity, TaskPriority,
  ExecutionLogEntry, OwnershipRule, OwnershipResolution,
  DuplicateCheck, DuplicateRecord, DependencyType, DependencyEdge, BlockerInfo,
  PriorityResult, ConflictType, ConflictRecord,
  ApprovalType, ApprovalStatus, ApprovalRecord,
  EvidenceType, EvidenceRecord, DivisionDefinition, RouteResult,
  StateTransition, TransitionResult, DashboardSnapshot,
} from './types';

export { PRIORITY_WEIGHT } from './types';

// ── Engines (explicit re-exports to avoid naming collisions) ───────────────
export {
  loadCollection, saveRecord, loadRecord, deleteRecord,
  genId, nowIso,
} from './persistence';

export {
  createRegisteredObjective, getRegisteredObjectives, getRegisteredObjective,
  updateRegisteredObjective, closeObjective, linkTask, deleteRegisteredObjective,
} from './objective-registry';
export type { CreateObjectiveInput } from './objective-registry';

export {
  createTask, getTask, getAllTasks, getBlockedTasks, getPendingApprovals,
  getBlockingDependencies, getTasksByObjective, getTasksByDivision,
  addEvidence, updateTaskStatus, getTaskHistory, deleteTask,
} from './task-registry';
export type { CreateTaskInput } from './task-registry';

export {
  resolveOwnership, getOwnershipRules, updateOwnershipRules,
  resolveOwnerEscalation,
} from './ownership-engine';

export {
  detectDuplicates, checkDuplicate, markDuplicate, getDuplicateSummary,
  HIGH_CONFIDENCE, REVIEW_THRESHOLD,
} from './duplicate-detector';

export {
  addEdge, removeEdge, getAllEdges, getEdgesForTask, getEdgesForObjective,
  topologicalOrder, getUpstream, getDownstream, findCycles,
  describeChain, checkBlockers, buildEdges, getBlockingDependencies as getBlockingDeps,
} from './dependency-graph';
export type { AddEdgeInput } from './dependency-graph';

export {
  autoClassify, prioritizeTask, sortByPriority, priorityBreakdown,
  ceoOverridePriority, getOverrideLog,
} from './priority-engine';

export {
  detectAllConflicts, hasActiveConflict, resolveConflict, summarizeConflicts,
} from './conflict-engine';

export {
  createApproval, getApproval, getAllApprovals, approveApproval,
  rejectApproval, cancelApproval, getPendingApprovals as getPendingApprovalRecords,
  getApprovalSummary, linkEvidenceToApproval,
} from './approval-registry';
export type { CreateApprovalInput } from './approval-registry';

export {
  addEvidenceRecord, getEvidenceRecord, getEvidenceRecords,
  getAllEvidenceRecords, verifyEvidence, getUnverifiedEvidence,
  getEvidenceSummary, taskCanClose, missingEvidenceForObjective,
} from './evidence-registry';
export type { AddEvidenceInput as AddEvidenceRecordInput } from './evidence-registry';

export {
  routeTask, getDivisions, getDivisionById, DIVISIONS,
} from './division-router';

export {
  buildDashboard, renderAsciiDashboard, getRisks,
} from './executive-dashboard';

import {
  createRegisteredObjective, getRegisteredObjectives,
} from './objective-registry';
import { createTask as createRegTask } from './task-registry';
import { detectDuplicates } from './duplicate-detector';
import { detectAllConflicts } from './conflict-engine';
import { autoClassify } from './priority-engine';
import { buildDashboard, renderAsciiDashboard } from './executive-dashboard';
import { routeTask } from './division-router';
import { linkTask } from './objective-registry';
import type { Task } from './types';

/**
 * Full coordination pipeline — one call does everything.
 *
=======
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
>>>>>>> origin/seo/phase-29-revenue-execution-loop
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
<<<<<<< a471ef81
  tasks: Array<{
    title: string; description?: string;
    division?: string; owner?: string;
    dependencies?: string[];
  }>,
): {
  objective: ReturnType<typeof createRegisteredObjective>;
  tasks: Task[];
  duplicates: ReturnType<typeof detectDuplicates>;
  conflicts: ReturnType<typeof detectAllConflicts>;
  dashboard: ReturnType<typeof buildDashboard>;
  dashboardAscii: string;
} {
=======
  tasks: Array<{ title: string; description: string; division: import('./types').Division; owner: string; dependencies?: string[] }>
): import('./types').DashboardSnapshot {
  const { createRegisteredObjective } = require('./objective-registry');
  const { createTask: createRegTask } = require('./task-registry');
  const { detectDuplicates } = require('./duplicate-detector');
  const { detectAllConflicts } = require('./conflict-engine');
  const { autoClassify } = require('./priority-engine');
  const { buildDashboard } = require('./executive-dashboard');

>>>>>>> origin/seo/phase-29-revenue-execution-loop
  // 1. Create objective
  const obj = createRegisteredObjective(objectiveTitle, 'ceo');

  // 2. Create tasks
<<<<<<< a471ef81
  const allTasks: Task[] = [];
  for (const t of tasks) {
    const priority = autoClassify(t.title, t.description ?? '');
=======
  const allTasks: any[] = [];
  for (const t of tasks) {
    const priority = autoClassify(t.title, t.description);
>>>>>>> origin/seo/phase-29-revenue-execution-loop
    const created = createRegTask({
      objectiveId: obj.id,
      title: t.title,
      description: t.description,
      division: t.division,
      owner: t.owner,
      priority: priority.priority,
<<<<<<< a471ef81
      dependencies: t.dependencies,
    });
    allTasks.push(created);
    linkTask(obj.id, created.id);
=======
      dependencies: t.dependencies || [],
    });
    allTasks.push(created);
>>>>>>> origin/seo/phase-29-revenue-execution-loop
  }

  // 3. Detect duplicates
  const duplicates = detectDuplicates(allTasks);

  // 4. Detect conflicts
  const conflicts = detectAllConflicts(allTasks);

  // 5. Build dashboard
<<<<<<< a471ef81
  const dash = buildDashboard(allTasks, objectiveTitle);
  const dashboardAscii = renderAsciiDashboard(dash);

  return {
    objective: obj,
    tasks: allTasks,
    duplicates,
    conflicts,
    dashboard: dash,
    dashboardAscii,
  };
}
=======
  return buildDashboard(allTasks, objectiveTitle);
}
>>>>>>> origin/seo/phase-29-revenue-execution-loop
