/**
 * Midday refresh — detects meaningful changes since the morning brief without
 * rebuilding everything blindly. Never creates a second brief, never activates a plan;
 * `DailyRefresh` is purely additive, additive-only diagnostic output.
 */

import { randomUUID } from 'crypto';
import { IntelligenceService } from '../../intelligence/service';
import type { TaskStore } from '../../task-runtime/store';
import { computeProjectHealth, computeServiceHealth } from './health';
import { listPendingApprovals } from './approvals';
import type { OperatingStore } from './store';
import type { DailyOperatingBrief, DailyRefresh } from './types';
import type { PersonalOsStore } from '../store';
import type { ProjectRegistryService } from '../../project-registry/service';
import type { DocumentStore } from '../documents/store';

export interface RefreshDeps {
  personalStore: PersonalOsStore;
  taskStore: TaskStore;
  registry: ProjectRegistryService | null;
  documentStore: DocumentStore;
  operatingStore: OperatingStore;
  intelligence: IntelligenceService;
}

/** The only code path allowed to build a DailyRefresh. Deduped by content hash (§17). */
export async function buildDailyRefresh(deps: RefreshDeps, brief: DailyOperatingBrief): Promise<{ refresh: DailyRefresh; created: boolean }> {
  const changedFacts: string[] = [];
  const newRisks: string[] = [];
  const resolvedBlockers: string[] = [];
  const planAdjustments: string[] = [];

  // Task status changes since the brief was generated.
  const briefTaskStatus = new Map((brief.priorityTasks as Array<{ id: string; status: string }>).map(t => [t.id, t.status]));
  const liveTasks = deps.taskStore.listTasks();
  for (const task of liveTasks) {
    const before = briefTaskStatus.get(task.id);
    if (before && before !== task.status) {
      if (task.status === 'COMPLETED') changedFacts.push(`task ${task.id} completed (was ${before}).`);
      else if (task.status === 'FAILED') { changedFacts.push(`task ${task.id} failed (was ${before}).`); newRisks.push(`task ${task.id} failed since morning`); }
      else if (before === 'BLOCKED' && task.status !== 'BLOCKED') resolvedBlockers.push(`task ${task.id} is no longer blocked (now ${task.status}).`);
      else changedFacts.push(`task ${task.id} moved from ${before} to ${task.status}.`);
    }
  }

  // Approval changes.
  const liveApprovals = listPendingApprovals(deps);
  const briefApprovalIds = new Set((brief.pendingApprovals as Array<{ id: string }>).map(a => a.id));
  const liveApprovalIds = new Set(liveApprovals.map(a => a.id));
  for (const id of briefApprovalIds) if (!liveApprovalIds.has(id)) changedFacts.push(`approval ${id} was granted or denied since morning.`);
  for (const id of liveApprovalIds) if (!briefApprovalIds.has(id)) changedFacts.push(`new approval requested: ${id}.`);

  // Service health changes.
  const liveServiceHealth = await computeServiceHealth();
  const briefServiceStatus = new Map((brief.serviceHealth as Array<{ service: string; status: string }>).map(s => [s.service, s.status]));
  for (const s of liveServiceHealth) {
    const before = briefServiceStatus.get(s.service);
    if (before && before !== s.status) {
      changedFacts.push(`service ${s.service} is now ${s.status} (was ${before}).`);
      if (s.status === 'UNHEALTHY') newRisks.push(`service ${s.service} became unhealthy`);
      else resolvedBlockers.push(`service ${s.service} recovered`);
    }
  }

  // Project health / map staleness changes.
  const briefProjectHealth = new Map((brief.projectHealth as Array<{ projectId: string; mapStatus: string; status: string }>).map(p => [p.projectId, p]));
  for (const [projectId, before] of briefProjectHealth) {
    const live = computeProjectHealth(projectId, deps);
    if (live.mapStatus !== before.mapStatus) changedFacts.push(`project ${projectId} map status changed from ${before.mapStatus} to ${live.mapStatus}.`);
    if (live.status !== before.status) {
      changedFacts.push(`project ${projectId} health changed from ${before.status} to ${live.status}.`);
      if (live.status === 'BLOCKED' || live.status === 'ATTENTION') newRisks.push(`project ${projectId} now needs attention (${live.reasons.join('; ')})`);
    }
  }

  // Meeting changes (cancelled or newly added), read live — never from the cached agenda.
  const newFollowUps: unknown[] = [];
  try {
    const dayStart = `${brief.date}T00:00:00.000Z`;
    const dayEnd = `${brief.date}T23:59:59.999Z`;
    const liveEvents = await deps.intelligence.calendarEvents(dayStart, dayEnd);
    const briefMeetingIds = new Set((brief.meetings as Array<{ eventId: string }>).map(m => m.eventId));
    const liveActiveIds = new Set(liveEvents.filter(e => e.status !== 'CANCELLED').map(e => e.eventId));
    for (const id of briefMeetingIds) if (!liveActiveIds.has(id)) changedFacts.push(`meeting ${id} was cancelled or rescheduled off today.`);
    for (const e of liveEvents) if (e.status !== 'CANCELLED' && !briefMeetingIds.has(e.eventId)) changedFacts.push(`new meeting added: ${e.title} at ${e.start}.`);
  } catch { /* connector unavailable — no meeting-change signal this refresh, not fabricated */ }

  if (changedFacts.length) planAdjustments.push('Review the daily plan — meaningful changes were detected since it was generated. No task was activated automatically.');

  const refresh: DailyRefresh = {
    id: `oprefresh-${randomUUID()}`,
    date: brief.date, previousBriefId: brief.id,
    changedFacts, newRisks, resolvedBlockers, newFollowUps, planAdjustments,
    suggestions: changedFacts.length ? ['Consider a plan review given the changes above.'] : ['No meaningful change since the morning brief.'],
    generatedAt: new Date().toISOString(),
  };

  const result = deps.operatingStore.saveRefreshIfNew(refresh);
  if (result.created) deps.operatingStore.updateBriefRefreshedAt(brief.id, refresh.generatedAt);
  return result;
}
