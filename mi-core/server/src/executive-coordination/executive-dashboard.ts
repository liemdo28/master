/**
 * Phase 0M — Executive Coordination Dashboard
 *
 * Expose coordination status to CEO.
 * Builds a unified snapshot from all coordination engines.
 */
import {
  DashboardSnapshot, Task, Objective, TaskPriority, ConflictRecord,
} from './types';
import { loadCollection } from './persistence';
import { getAllTasks, getBlockedTasks, getAllTasks as getAllTasksRaw } from './task-registry';
import { getRegisteredObjectives } from './objective-registry';
import { getAllApprovals, getPendingApprovals } from './approval-registry';
import { getAllEvidenceRecords } from './evidence-registry';
import { sortByPriority, priorityBreakdown } from './priority-engine';
import { summarizeConflicts } from './conflict-engine';

export function buildDashboard(
  tasksOverride?: Task[],
  objectiveTitle?: string,
): DashboardSnapshot {
  const tasks = tasksOverride ?? loadCollection<Task>('tasks');
  const objectives = getRegisteredObjectives();
  const approvals = getAllApprovals();
  const evidence = getAllEvidenceRecords();

  const activeObjectives = objectives.filter(o =>
    !['COMPLETED', 'CANCELLED', 'FAILED'].includes(o.status),
  );
  const completedObjectives = objectives.filter(o => o.status === 'COMPLETED');
  const blockedObjectives = objectives.filter(o => o.status === 'BLOCKED');

  const activeTasks = tasks.filter(t =>
    !['DONE', 'CANCELLED', 'FAILED', 'DUPLICATE'].includes(t.status),
  );
  const completedTasks = tasks.filter(t => t.status === 'DONE');
  const blockedTasks = tasks.filter(t => t.status === 'BLOCKED' || t.status === 'WAITING_DEPENDENCY');
  const duplicateTasks = tasks.filter(t => t.status === 'DUPLICATE' || t.duplicateOf);

  const pendingApprovals = approvals.filter(a => a.status === 'REQUESTED');
  const approvedApprovals = approvals.filter(a => a.status === 'APPROVED');
  const rejectedApprovals = approvals.filter(a => a.status === 'REJECTED');

  const verifiedEvidence = evidence.filter(e => e.verified);
  const tasksWithNoEvidence = activeTasks.filter(t =>
    t.evidenceRequired && t.evidenceIds.length === 0,
  );

  // Division load
  const divisionLoad: Record<string, number> = {};
  for (const t of activeTasks) {
    divisionLoad[t.division] = (divisionLoad[t.division] ?? 0) + 1;
  }

  // Priority queue: top 10 active by priority
  const priorityQueue = sortByPriority(activeTasks).slice(0, 10);

  // Recent completed
  const recentCompleted = completedTasks
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, 5);

  // At risk objectives: active + blocked + has overdue tasks
  const now = new Date();
  const atRiskObjectives = activeObjectives.filter(o => {
    if (o.status === 'BLOCKED') return true;
    if (o.targetDate) {
      const target = new Date(o.targetDate);
      if (target < now) return true;
    }
    // Check if any linked tasks are blocked
    const objTasks = tasks.filter(t => t.objectiveId === o.id);
    if (objTasks.some(t => t.status === 'BLOCKED' || t.status === 'FAILED')) return true;
    return false;
  });

  return {
    timestamp: new Date().toISOString(),
    objectives: {
      total: objectives.length,
      active: activeObjectives.length,
      completed: completedObjectives.length,
      blocked: blockedObjectives.length,
    },
    tasks: {
      total: tasks.length,
      active: activeTasks.length,
      blocked: blockedTasks.length,
      completed: completedTasks.length,
      duplicate: duplicateTasks.length,
    },
    conflicts: summarizeConflicts(tasks),
    approvals: {
      total: approvals.length,
      pending: pendingApprovals.length,
      approved: approvedApprovals.length,
      rejected: rejectedApprovals.length,
    },
    evidence: {
      total: evidence.length,
      verified: verifiedEvidence.length,
      missing: tasksWithNoEvidence.length,
    },
    divisionLoad,
    priorityQueue,
    recentCompleted,
    atRiskObjectives,
  };
}

export function renderAsciiDashboard(snap: DashboardSnapshot): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  EXECUTIVE COORDINATION DASHBOARD');
  lines.push(`  ${snap.timestamp}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`  Objectives:  ${snap.objectives.active} active / ${snap.objectives.total} total / ${snap.objectives.blocked} blocked`);
  lines.push(`  Tasks:       ${snap.tasks.active} active / ${snap.tasks.blocked} blocked / ${snap.tasks.completed} done / ${snap.tasks.duplicate} duplicates`);
  lines.push(`  Conflicts:   ${snap.conflicts.unresolved} unresolved / ${snap.conflicts.total} total`);
  lines.push(`  Approvals:   ${snap.approvals.pending} pending / ${snap.approvals.approved} approved / ${snap.approvals.rejected} rejected`);
  lines.push(`  Evidence:    ${snap.evidence.verified} verified / ${snap.evidence.missing} missing`);
  lines.push('');
  lines.push('  Division Load:');
  for (const [div, count] of Object.entries(snap.divisionLoad).sort((a, b) => b[1] - a[1])) {
    lines.push(`    ${div}: ${count} tasks`);
  }
  lines.push('');
  if (snap.priorityQueue.length > 0) {
    lines.push('  Priority Queue:');
    for (const t of snap.priorityQueue.slice(0, 5)) {
      lines.push(`    [${t.priority}] ${t.title} (${t.division}) — ${t.status}`);
    }
  }
  if (snap.atRiskObjectives.length > 0) {
    lines.push('');
    lines.push('  ⚠ At Risk Objectives:');
    for (const o of snap.atRiskObjectives) {
      lines.push(`    ${o.title} (${o.status})`);
    }
  }
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}

export function getRisks(): Array<{
  type: string; description: string; severity: string;
  objectiveId?: string; taskId?: string;
}> {
  const risks: Array<{
    type: string; description: string; severity: string;
    objectiveId?: string; taskId?: string;
  }> = [];

  const tasks = loadCollection<Task>('tasks');
  const objectives = getRegisteredObjectives();

  // Overdue tasks
  const now = new Date();
  for (const t of tasks) {
    if (t.dueDate && t.status !== 'DONE' && t.status !== 'CANCELLED') {
      if (new Date(t.dueDate) < now) {
        risks.push({
          type: 'overdue_task',
          description: `Task "${t.title}" is overdue (due: ${t.dueDate})`,
          severity: t.priority === 'P0' ? 'critical' : 'high',
          taskId: t.id,
          objectiveId: t.objectiveId,
        });
      }
    }
  }

  // Blocked objectives
  for (const o of objectives) {
    if (o.status === 'BLOCKED') {
      risks.push({
        type: 'blocked_objective',
        description: `Objective "${o.title}" is blocked`,
        severity: 'high',
        objectiveId: o.id,
      });
    }
  }

  // Tasks without required evidence
  for (const t of tasks) {
    if (t.evidenceRequired && t.evidenceIds.length === 0 && t.status === 'IN_PROGRESS') {
      risks.push({
        type: 'missing_evidence',
        description: `Task "${t.title}" is in progress but has no evidence`,
        severity: 'medium',
        taskId: t.id,
        objectiveId: t.objectiveId,
      });
    }
  }

  return risks;
}