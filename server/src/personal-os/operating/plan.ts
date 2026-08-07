/**
 * Daily planner — the single canonical, date-scoped, focus-block-aware planner.
 *
 * Bounded deterministic ranking runs before any LLM reasoning could touch the result:
 * every candidate is scored from data already on hand (deadlines, task status, goal
 * priority) and ordered by a fixed tier scheme (§6). Nothing here executes a task,
 * writes a calendar event, or activates anything — a DailyPlan is created DRAFT and
 * only ever changes status.
 */

import { randomUUID } from 'crypto';
import type { TaskStore } from '../../task-runtime/store';
import type { DailyOperatingBrief, DailyPlan, FocusBlockSuggestion, PlanTaskRef } from './types';
import { OPERATING_BOUNDS } from './types';
import type { OperatingStore } from './store';

const NEVER_EXECUTABLE_STATUSES = new Set(['BLOCKED', 'WAITING_APPROVAL', 'CANCELLED', 'COMPLETED']);

interface Candidate {
  ref: PlanTaskRef;
  tier: 'high' | 'medium' | 'low';
  rank: number;
}

/**
 * The only code path allowed to build a DailyPlan. Idempotent per date (§17): a second
 * call on the same day returns the existing plan, whatever its current status.
 */
export function buildDailyPlan(deps: { taskStore: TaskStore; operatingStore: OperatingStore }, brief: DailyOperatingBrief): DailyPlan {
  const existing = deps.operatingStore.latestPlanForDate(brief.date);
  if (existing) return existing;

  const candidates: Candidate[] = [];

  // FIXED: meetings and deadlines from the brief — never reordered, never skipped.
  for (const meeting of brief.meetings as Array<{ eventId: string; title: string; start: string }>) {
    candidates.push({
      ref: { id: meeting.eventId, kind: 'FIXED', title: meeting.title, reason: 'scheduled meeting', tier: 'high', sourceId: meeting.eventId, sourceType: 'MEETING' },
      tier: 'high', rank: 100,
    });
  }
  for (const deadline of brief.deadlines as Array<{ summary: string; dueAt: string; sourceId: string }>) {
    candidates.push({
      ref: { id: deadline.sourceId, kind: 'FIXED', title: deadline.summary, reason: `deadline today (${deadline.dueAt})`, tier: 'high', sourceId: deadline.sourceId, sourceType: 'DEADLINE' },
      tier: 'high', rank: 95,
    });
  }

  // FLEXIBLE: executable tasks, ranked. Never a BLOCKED/WAITING_APPROVAL/CANCELLED/COMPLETED task.
  const tasks = deps.taskStore.listTasks().filter(t => !NEVER_EXECUTABLE_STATUSES.has(t.status));
  for (const task of tasks) {
    const isBlocker = task.status === 'FAILED';
    const tier: Candidate['tier'] = isBlocker ? 'high' : task.status === 'READY' ? 'medium' : 'low';
    candidates.push({
      ref: {
        id: task.id, kind: 'FLEXIBLE', title: (task.userRequest || task.id).slice(0, 160),
        reason: isBlocker ? 'failed task blocking other priorities' : `task is ${task.status.toLowerCase()}`,
        tier, sourceId: task.id, sourceType: 'TASK',
      },
      tier, rank: isBlocker ? 90 : task.status === 'READY' ? 60 : 30,
    });
  }

  // FLEXIBLE: active goal contribution.
  for (const goal of brief.activeGoals as Array<{ id: string; title: string; priority: number }>) {
    candidates.push({
      ref: { id: goal.id, kind: 'FLEXIBLE', title: goal.title, reason: 'active goal contribution', tier: 'medium', sourceId: goal.id, sourceType: 'GOAL' },
      tier: 'medium', rank: 50 + Math.min(9, goal.priority),
    });
  }

  // OPTIONAL: follow-ups and suggestions — lower tier, never auto-selected as fixed work.
  for (const followUp of (brief.followUps as Array<{ id: string; summary: string }>).slice(0, 5)) {
    candidates.push({
      ref: { id: followUp.id, kind: 'OPTIONAL', title: followUp.summary.slice(0, 160), reason: 'follow-up candidate', tier: 'low', sourceId: followUp.id, sourceType: 'FOLLOW_UP' },
      tier: 'low', rank: 10,
    });
  }

  candidates.sort((a, b) => b.rank - a.rank || a.ref.id.localeCompare(b.ref.id));

  const selectedGoals = [...new Set(candidates.filter(c => c.ref.sourceType === 'GOAL').map(c => c.ref.sourceId!))].slice(0, OPERATING_BOUNDS.maxPlanGoals);
  const selectedTasks = candidates.slice(0, OPERATING_BOUNDS.maxPlanTasks).map(c => c.ref);

  const requiredApprovals = deps.taskStore.listTasks('WAITING_APPROVAL').slice(0, 10).map(t => t.id);

  const focusBlocks: FocusBlockSuggestion[] = brief.focusWindows as FocusBlockSuggestion[];

  const plan: DailyPlan = {
    id: `plan-${randomUUID()}`,
    date: brief.date, timezone: brief.timezone, briefId: brief.id,
    objective: selectedGoals.length ? `Advance ${selectedGoals.length} active goal(s) and clear blocking work.` : 'Clear pending work; no active goals require attention today.',
    selectedGoals, selectedTasks,
    proposedOrder: selectedTasks.map(t => t.id),
    dependencies: [],
    focusBlocks,
    meetings: brief.meetings,
    requiredApprovals,
    risks: brief.risks.slice(0, 10),
    successCriteria: selectedGoals.length
      ? ['Each selected FIXED item is attended or explicitly rescheduled.', 'No WAITING_APPROVAL or BLOCKED task is treated as active work.']
      : ['All FIXED items for the day are attended.'],
    evidenceReferences: brief.evidenceReferences.slice(0, 30),
    status: 'DRAFT', version: 1,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };

  return deps.operatingStore.savePlan(plan);
}
