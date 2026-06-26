/**
 * Phase 0 — Executive Dashboard Engine
 * 
 * Generates unified dashboard snapshot from all coordination data.
 */

import type {
  CoordinatedTask, Division, DashboardSnapshot, DashboardObjective, DashboardSummary,
  DuplicateMatch, TaskConflict,
} from './types';
import { detectDuplicates } from './duplicate-detector';
import { detectAllConflicts } from './conflict-engine';
import { getBlockingDependencies } from './task-registry';

// ── Division grouping ──────────────────────────────────────────────────────

const ALL_DIVISIONS: Division[] = ['engineering', 'computer-operator', 'finance', 'marketing', 'it', 'creative', 'seo', 'operations'];

export function buildDashboard(tasks: CoordinatedTask[], objectiveTitle: string): DashboardSnapshot {
  const duplicates = detectDuplicates(tasks);
  const conflicts = detectAllConflicts(tasks);
  const today = new Date().toISOString().split('T')[0];

  const activeTasks = tasks.filter(t => t.status !== 'cancelled');

  // Group by division
  const tasksByDivision: Record<Division, CoordinatedTask[]> = {} as any;
  for (const d of ALL_DIVISIONS) tasksByDivision[d] = [];
  for (const t of activeTasks) {
    if (tasksByDivision[t.division]) tasksByDivision[t.division].push(t);
  }

  // Blocked = tasks with uncompleted dependencies
  const blockedTasks = activeTasks.filter(t =>
    getBlockingDependencies(t.id).length > 0
  );

  const pendingApprovals = tasks.filter(t => t.status === 'awaiting-approval');
  const completedToday = tasks.filter(t => t.completedAt && t.completedAt.startsWith(today));
  const completedCount = tasks.filter(t => t.status === 'completed').length;

  // Objective summary
  const objectives: DashboardObjective[] = [{
    id: 'OBJ-001',
    title: objectiveTitle,
    taskCount: tasks.length,
    completedCount,
    blockedCount: blockedTasks.length,
    progress: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
  }];

  const summary: DashboardSummary = {
    totalObjectives: 1,
    totalTasks: tasks.length,
    completedTasks: completedCount,
    blockedTasks: blockedTasks.length,
    pendingApprovals: pendingApprovals.length,
    activeConflicts: conflicts.length,
    activeDuplicates: duplicates.length,
    overallProgress: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
  };

  return {
    generatedAt: new Date().toISOString(),
    objectives,
    tasksByDivision,
    blockedTasks,
    pendingApprovals,
    duplicates,
    conflicts,
    completedToday,
    summary,
  };
}

// ── ASCII Dashboard ────────────────────────────────────────────────────────

export function renderAsciiDashboard(snapshot: DashboardSnapshot): string {
  const lines: string[] = [];
  const bar = '═'.repeat(60);
  lines.push(`╔${bar}╗`);
  lines.push(`║  EXECUTIVE COORDINATION DASHBOARD — ${snapshot.generatedAt.split('T')[0]}  ║`);
  lines.push(`╚${bar}╝`);
  lines.push('');

  // Summary
  const s = snapshot.summary;
  lines.push(`📊 SUMMARY`);
  lines.push(`  Objectives:   ${s.totalObjectives}`);
  lines.push(`  Tasks:        ${s.completedTasks} completed / ${s.totalTasks} total`);
  lines.push(`  Progress:     ${s.overallProgress}%`);
  lines.push(`  Blocked:      ${s.blockedTasks}`);
  lines.push(`  Approvals:    ${s.pendingApprovals}`);
  lines.push(`  Conflicts:    ${s.activeConflicts}`);
  lines.push(`  Duplicates:   ${s.activeDuplicates}`);
  lines.push('');

  // Tasks by division
  lines.push(`📋 TASKS BY DIVISION`);
  const divOrder: Division[] = ['engineering', 'computer-operator', 'finance', 'marketing', 'it', 'creative', 'seo', 'operations'];
  for (const d of divOrder) {
    const divTasks = snapshot.tasksByDivision[d] || [];
    if (divTasks.length === 0) continue;
    const completed = divTasks.filter(t => t.status === 'completed').length;
    lines.push(`  ${d.toUpperCase().padEnd(18)} ${completed}/${divTasks.length} done`);
  }
  lines.push('');

  // Blocked
  if (snapshot.blockedTasks.length > 0) {
    lines.push(`🔴 BLOCKED TASKS`);
    for (const t of snapshot.blockedTasks) {
      lines.push(`  [${t.id}] ${t.title} — division: ${t.division}`);
    }
    lines.push('');
  }

  // Conflicts
  if (snapshot.conflicts.length > 0) {
    lines.push(`⚠️  CONFLICTS`);
    for (const c of snapshot.conflicts) {
      lines.push(`  ${c.taskA} ↔ ${c.taskB} (${c.conflictType})`);
    }
    lines.push('');
  }

  // Duplicates
  if (snapshot.duplicates.length > 0) {
    lines.push(`🔁 DUPLICATES`);
    for (const d of snapshot.duplicates) {
      lines.push(`  ${d.taskA} ↔ ${d.taskB} (${(d.similarity * 100).toFixed(0)}%)`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
