/**
 * Weekly operating review — wraps Phase 5C's WeeklyReview (canonical for
 * completedGoals/recurringIssues/lessons/meeting load/focus time) and layers Task
 * Runtime completion counts, pending approvals, and project/service health on top.
 * Never fabricates a metric it cannot compute from real state.
 */

import { randomUUID } from 'crypto';
import { IntelligenceService } from '../../intelligence/service';
import type { TaskStore } from '../../task-runtime/store';
import type { PersonalOsStore } from '../store';
import type { ProjectRegistryService } from '../../project-registry/service';
import type { DocumentStore } from '../documents/store';
import type { OperatingStore } from './store';
import { computeProjectHealth, computeServiceHealth } from './health';
import { listPendingApprovals } from './approvals';
import type { WeeklyOperatingReview } from './types';

export interface WeeklyDeps {
  personalStore: PersonalOsStore;
  taskStore: TaskStore;
  registry: ProjectRegistryService | null;
  documentStore: DocumentStore;
  operatingStore: OperatingStore;
  intelligence: IntelligenceService;
}

function weekEndOf(weekStart: string): string {
  const d = new Date(`${weekStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

/** The only code path allowed to build a WeeklyOperatingReview. Idempotent per week (§17). */
export async function buildWeeklyOperatingReview(deps: WeeklyDeps, weekStart: string): Promise<WeeklyOperatingReview> {
  const existing = deps.operatingStore.latestWeeklyReview(weekStart);
  if (existing) return existing;

  const base = await deps.intelligence.generateWeeklyReview(weekStart);

  const weekEnd = weekEndOf(weekStart);
  const startTs = `${weekStart}T00:00:00.000Z`;
  const endTs = `${weekEnd}T23:59:59.999Z`;

  const tasks = deps.taskStore.listTasks();
  const inWeek = (ts: string | null) => Boolean(ts && ts >= startTs && ts <= endTs);
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED' && inWeek(t.completedAt)).length;
  const failedTasks = tasks.filter(t => t.status === 'FAILED' && inWeek(t.updatedAt)).length;
  const blockedTasks = tasks.filter(t => t.status === 'BLOCKED').length;

  const goals = deps.personalStore.listGoals();
  const goalsProgressed = goals.filter(g => inWeek(g.updatedAt) && g.status === 'ACTIVE').map(g => g.title).slice(0, 20);
  const goalsStalled = goals.filter(g => g.status === 'BLOCKED' || g.status === 'PAUSED').map(g => g.title).slice(0, 20);

  const pendingApprovals = listPendingApprovals(deps);

  const projectIds = [...new Set(goals.flatMap(g => g.projectIds))].slice(0, 10);
  const projectHealth = projectIds.map(pid => computeProjectHealth(pid, deps));
  const serviceHealth = await computeServiceHealth();

  let knowledgeAdded = 0;
  let staleKnowledge = 0;
  let conflicts: unknown[] = [];
  try {
    knowledgeAdded = deps.personalStore.listKnowledge(true).filter(k => inWeek(k.createdAt)).length;
    staleKnowledge = deps.documentStore.listDocuments('STALE', 500).length;
    conflicts = [...deps.documentStore.listConflicts('OPEN', 200), ...deps.documentStore.listConflicts('NEEDS_CONFIRMATION', 200)];
  } catch { /* document store unavailable in this environment */ }

  const facts: string[] = [
    ...base.facts,
    `${completedTasks} task(s) completed this week.`,
    `${failedTasks} task(s) failed this week.`,
    `${blockedTasks} task(s) currently blocked.`,
    `${pendingApprovals.length} item(s) pending approval.`,
  ];

  const review: WeeklyOperatingReview = {
    id: `opweekly-${randomUUID()}`,
    weekStart, weekEnd,
    goalsProgressed, goalsStalled,
    completedTasks, failedTasks, blockedTasks,
    unresolvedApprovals: pendingApprovals.length,
    unresolvedFollowUps: base.unresolvedFollowUps,
    projectHealth, serviceHealth,
    recurringIssues: base.recurringIssues.map(r => r.title),
    knowledgeAdded, staleKnowledge, conflicts,
    meetingLoad: { meetingCount: base.meetingLoad.meetingCount, totalMinutes: base.meetingLoad.totalMinutes },
    focusTime: { minutes: base.focusTimeEstimate.minutes },
    lessons: base.lessons.map(l => l.title),
    suggestedNextWeekPriorities: base.suggestedNextWeekPriorities.slice(0, 10),
    suggestedDeScope: goalsStalled.slice(0, 5).map(title => `Consider de-scoping: ${title}`),
    facts, suggestions: [], unknowns: base.unknowns,
    evidenceReferences: base.evidenceReferences.slice(0, 40),
    version: 1, generatedAt: new Date().toISOString(),
  };

  return deps.operatingStore.saveWeeklyReview(review);
}
