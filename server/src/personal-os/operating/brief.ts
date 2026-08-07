/**
 * Morning brief builder — the single canonical DailyOperatingBrief builder.
 *
 * Truth priority (§4) is enforced structurally, not by a runtime merge step:
 * ServiceHealth/ProjectHealth are always read from live probes (SelfHeal, Task Runtime,
 * Project Registry) directly into their own fields, and a knowledge- or memory-derived
 * statement is never written into those fields — it stays in `relevantKnowledge`/
 * `relevantMemory`, clearly separate. Two knowledge sources that disagree surface via
 * `conflicts` (Phase 5D-2's conflict engine); nothing here silently picks a winner.
 */

import { randomUUID } from 'crypto';
import { GoogleReadClient, inspectToken } from '../../intelligence/google-read-client';
import { createFixtureTransport, createLiveTransport, defaultTokenFile } from '../../intelligence/transports';
import { IntelligenceService, today } from '../../intelligence/service';
import { PersonalOsStore } from '../store';
import { TaskStore } from '../../task-runtime/store';
import { ProjectRegistryService } from '../../project-registry/service';
import { DocumentStore } from '../documents/store';
import { KnowledgeRetrievalService } from '../documents/retrieval';
import { KNOWLEDGE_QUERY_LIMITS } from '../documents/types';
import { computeProjectHealth, computeServiceHealth } from './health';
import { listPendingApprovals } from './approvals';
import { OperatingStore } from './store';
import { OPERATING_BOUNDS, type DailyOperatingBrief } from './types';

export interface BriefDeps {
  personalStore: PersonalOsStore;
  taskStore: TaskStore;
  registry: ProjectRegistryService | null;
  documentStore: DocumentStore;
  operatingStore: OperatingStore;
  intelligence?: IntelligenceService;
}

function buildIntelligenceService(deps: BriefDeps): IntelligenceService {
  if (deps.intelligence) return deps.intelligence;
  const tokenState = inspectToken();
  const transport = tokenState.status === 'READY' ? createLiveTransport(defaultTokenFile()) : createFixtureTransport({});
  return new IntelligenceService({
    capabilities: new GoogleReadClient(transport, tokenState),
    personal: deps.personalStore, tasks: deps.taskStore, registry: deps.registry ?? undefined,
  });
}

const ACTIVE_GOAL_STATUSES = new Set(['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED']);

/**
 * The only code path allowed to build a DailyOperatingBrief. Idempotent per date: a
 * second call on the same day returns the existing brief unchanged (§17) — call
 * `refreshBrief` (refresh.ts) to layer in what has changed since.
 */
export async function buildDailyOperatingBrief(deps: BriefDeps, date = today()): Promise<DailyOperatingBrief> {
  const existing = deps.operatingStore.latestBriefForDate(date);
  if (existing) return existing;

  const intelligence = buildIntelligenceService(deps);
  const ownsIntelligence = !deps.intelligence;
  try {
    const agenda = await intelligence.generateDailyAgenda(date);

    const activeGoals = deps.personalStore.listGoals().filter(g => ACTIVE_GOAL_STATUSES.has(g.status));
    const goalProjectIds = [...new Set(activeGoals.flatMap(g => g.projectIds))].slice(0, KNOWLEDGE_QUERY_LIMITS.maxProjectIds);

    const allTasks = deps.taskStore.listTasks();
    const priorityTasks = allTasks.filter(t => ['WAITING_APPROVAL', 'READY', 'RUNNING', 'BLOCKED'].includes(t.status)).slice(0, 20);
    const pendingApprovals = listPendingApprovals(deps).slice(0, 20);

    const projectHealth = goalProjectIds.map(pid => computeProjectHealth(pid, deps));
    const serviceHealth = await computeServiceHealth();

    const memoryPack = deps.personalStore.buildMemoryPack({
      query: `daily operating brief: ${activeGoals.map(g => g.title).join('; ')}`.slice(0, 500),
      projectIds: goalProjectIds,
      policy: 'PERSONAL_AND_PROJECT',
      maxRecords: 10,
      maxBytes: 8000,
      includeUnconfirmed: true,
    });

    const unknowns: string[] = [...agenda.unknowns];
    let relevantKnowledge: unknown[] = [];
    let knowledgeCitations: unknown[] = [];
    let knowledgeConflicts: unknown[] = [];
    if (goalProjectIds.length) {
      const knowledgeText = `today's priorities for: ${activeGoals.map(g => g.title).join(', ')}`.slice(0, 500);
      const pack = new KnowledgeRetrievalService(deps.documentStore)
        .buildKnowledgePack({ text: knowledgeText || 'active goal priorities', projectIds: goalProjectIds, limit: 8 });
      relevantKnowledge = pack.items.filter(i => i.factType === 'FACT');
      knowledgeCitations = pack.items.flatMap(i => i.citations);
      knowledgeConflicts = pack.conflicts;
      if (pack.warnings.length) unknowns.push(...pack.warnings);
    } else {
      unknowns.push('no project-scoped knowledge could be retrieved because no active goal has an associated project');
    }

    const blockedTasks = allTasks.filter(t => t.status === 'BLOCKED');
    const failedTasks = allTasks.filter(t => t.status === 'FAILED').slice(0, 5);
    const blockers = [
      ...blockedTasks.slice(0, OPERATING_BOUNDS.maxBlockers).map(t => `task ${t.id} is blocked: ${(t.resultSummary || 'no summary').slice(0, 160)}`),
      ...projectHealth.filter(p => p.status === 'BLOCKED').map(p => `project ${p.projectId} is blocked: ${p.reasons.join('; ')}`),
    ].slice(0, OPERATING_BOUNDS.maxBlockers);

    const risks: string[] = [
      ...agenda.risks,
      ...serviceHealth.filter(s => s.status === 'UNHEALTHY').map(s => `service unhealthy: ${s.service}`),
      ...projectHealth.filter(p => p.status === 'ATTENTION').map(p => `project ${p.projectId} needs attention: ${p.reasons.join('; ')}`),
    ];

    const priorities = buildPriorityFacts(activeGoals, priorityTasks, agenda.deadlines).slice(0, OPERATING_BOUNDS.maxPriorities);

    const facts: string[] = [
      ...agenda.facts,
      `${activeGoals.length} active goal(s).`,
      `${pendingApprovals.length} item(s) pending approval.`,
      `${serviceHealth.filter(s => s.status === 'HEALTHY').length}/${serviceHealth.length} monitored service(s) healthy.`,
      ...(failedTasks.length ? [`${failedTasks.length} task(s) recently failed.`] : []),
      ...priorities,
    ];

    const confirmationRequests = [
      ...memoryPack.uncertainRecords.slice(0, OPERATING_BOUNDS.maxConfirmationRequests).map(r => ({ id: r.id, title: r.title, kind: r.kind, type: 'knowledge' })),
    ].slice(0, OPERATING_BOUNDS.maxConfirmationRequests);

    const suggestions: string[] = [
      ...agenda.suggestions,
      'Review pending approvals before starting new work — nothing executes automatically.',
    ];

    const evidenceReferences = [
      ...agenda.evidenceReferences,
      ...allTasks.slice(0, 10).map(t => `task:${t.id}`),
      ...memoryPack.evidenceReferences,
    ].slice(0, 60);

    const brief: DailyOperatingBrief = {
      id: `opbrief-${randomUUID()}`,
      date, timezone: agenda.timezone, version: 1,
      facts, meetings: agenda.meetings, deadlines: agenda.deadlines,
      activeGoals: activeGoals.map(g => ({ id: g.id, title: g.title, status: g.status, priority: g.priority })),
      priorityTasks: priorityTasks.map(t => ({ id: t.id, status: t.status, projectId: t.projectId })),
      pendingApprovals, followUps: agenda.followUps,
      projectHealth, serviceHealth,
      relevantMemory: [
        ...memoryPack.confirmedPreferences, ...memoryPack.previousLessons, ...memoryPack.recurringIssues,
      ].map(r => ({ id: r.id, kind: r.kind, title: r.title, summary: r.summary })),
      relevantKnowledge, knowledgeCitations,
      focusWindows: agenda.availableFocusWindows.map(w => ({
        start: w.start, end: w.end, durationMinutes: w.minutes, taskIds: [], goalIds: [],
        reason: w.reason, confidence: 0.6, constraints: [], evidenceReferences: [],
      })),
      blockers, risks, suggestions, unknowns, confirmationRequests,
      conflicts: [...knowledgeConflicts, ...memoryPack.conflicts],
      evidenceReferences,
      generatedAt: new Date().toISOString(), refreshedAt: null,
    };

    return deps.operatingStore.saveBrief(brief);
  } finally {
    if (ownsIntelligence) intelligence.close();
  }
}

function buildPriorityFacts(
  goals: Array<{ id: string; title: string; priority: number; targetDate: string | null }>,
  tasks: Array<{ id: string; status: string }>,
  deadlines: Array<{ summary: string; dueAt: string }>,
): string[] {
  const out: string[] = [];
  for (const d of deadlines.slice(0, 5)) out.push(`Deadline: ${d.summary} (due ${d.dueAt}).`);
  for (const g of [...goals].sort((a, b) => b.priority - a.priority).slice(0, 5)) {
    out.push(`Goal priority: "${g.title}" (priority ${g.priority}).`);
  }
  const waiting = tasks.filter(t => t.status === 'WAITING_APPROVAL').length;
  if (waiting) out.push(`${waiting} task(s) waiting for approval.`);
  return out;
}
