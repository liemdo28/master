/**
 * Phase 5C intelligence service — assembles agendas and reviews from read-only sources.
 *
 * Everything it emits is separated into facts (retrieved state), suggestions (Mi's
 * proposals) and unknowns (what could not be established). Nothing here writes to
 * Gmail or Calendar, and nothing here starts a task.
 */

import { PersonalOsStore } from '../personal-os/store';
import { TaskStore } from '../task-runtime/store';
import { ProjectRegistryService } from '../project-registry/service';
import { IntelligenceStore } from './store';
import { computeFocusWindows, detectFollowUps, linkToProjects, type LinkableGoal, type LinkableProject } from './analysis';
import type {
  CalendarEventContext, ConnectorStatus, DailyAgenda, EmailContext, FollowUpCandidate,
  GoogleReadCapabilities, WeeklyReview,
} from './types';

const AGENDA_VERSION = 1;
const REVIEW_VERSION = 1;

function today(): string {
  return process.env.MI_TEST_TODAY || new Date().toISOString().slice(0, 10);
}

function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun
  const delta = day === 0 ? 6 : day - 1; // ISO weeks start Monday
  d.setUTCDate(d.getUTCDate() - delta);
  return d.toISOString().slice(0, 10);
}

export interface IntelligenceDeps {
  capabilities: GoogleReadCapabilities;
  personal?: PersonalOsStore;
  tasks?: TaskStore;
  registry?: ProjectRegistryService;
  store?: IntelligenceStore;
  ownerAddresses?: string[];
  timezone?: string;
}

export class IntelligenceService {
  readonly capabilities: GoogleReadCapabilities;
  readonly personal: PersonalOsStore;
  readonly tasks: TaskStore;
  readonly store: IntelligenceStore;
  private readonly registry: ProjectRegistryService | null;
  private readonly ownerAddresses: string[];
  private readonly timezone: string;

  constructor(deps: IntelligenceDeps) {
    this.capabilities = deps.capabilities;
    this.personal = deps.personal ?? new PersonalOsStore();
    this.tasks = deps.tasks ?? new TaskStore();
    this.store = deps.store ?? new IntelligenceStore();
    this.registry = deps.registry ?? safeRegistry();
    this.ownerAddresses = (deps.ownerAddresses ?? splitEnvList(process.env.MI_OWNER_EMAILS)).map(a => a.toLowerCase());
    this.timezone = deps.timezone ?? process.env.MI_TIMEZONE ?? 'UTC';
  }

  close(): void {
    this.personal.close();
    this.tasks.close();
    this.store.close();
    this.registry?.close();
  }

  private linkables(): { projects: LinkableProject[]; goals: LinkableGoal[] } {
    let projects: LinkableProject[] = [];
    try {
      projects = (this.registry?.listProjects() ?? []).map(p => ({
        id: p.id,
        displayName: p.displayName,
        confirmedDomains: splitEnvList(process.env[`MI_PROJECT_DOMAINS_${p.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]),
        tags: [p.id],
      }));
    } catch { projects = []; }
    const goals: LinkableGoal[] = this.personal.listGoals().map(g => ({ id: g.id, title: g.title, projectIds: g.projectIds }));
    return { projects, goals };
  }

  private applyLinks<T extends CalendarEventContext | EmailContext>(items: T[], textOf: (item: T) => string, fromOf: (item: T) => string | null): T[] {
    const { projects, goals } = this.linkables();
    return items.map(item => {
      const link = linkToProjects(textOf(item), fromOf(item), projects, goals);
      return {
        ...item,
        // An uncertain link is recorded as uncertain and carries no project ids, so no
        // downstream consumer can mistake it for a confirmed association.
        projectIds: link.confidence === 'CONFIRMED' ? link.projectIds : [],
        goalIds: link.confidence === 'CONFIRMED' ? link.goalIds : [],
        linkConfidence: link.confidence,
      };
    });
  }

  async calendarEvents(timeMin: string, timeMax: string, calendarIds?: string[]): Promise<CalendarEventContext[]> {
    const events = await this.capabilities.calendarListEvents({ timeMin, timeMax, calendarIds, timezone: this.timezone });
    return this.applyLinks(events, e => `${e.title}\n${e.descriptionSummary}\n${e.location ?? ''}`, e => e.organizer);
  }

  async searchEmail(query: string, maxResults = 10): Promise<EmailContext[]> {
    const emails = await this.capabilities.gmailSearch({ query, maxResults });
    return this.applyLinks(emails, e => `${e.subject}\n${e.bodySummary}`, e => e.from);
  }

  async emailThread(threadId: string): Promise<EmailContext[]> {
    const emails = await this.capabilities.gmailGetThread(threadId);
    return this.applyLinks(emails, e => `${e.subject}\n${e.bodySummary}`, e => e.from);
  }

  async connectorStatus(): Promise<ConnectorStatus> {
    try { return await this.capabilities.status(); } catch { return 'UNAVAILABLE'; }
  }

  async generateDailyAgenda(date = today()): Promise<DailyAgenda> {
    const existing = this.store.getAgendaByDate(date);
    if (existing) return existing;

    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;
    const facts: string[] = [];
    const unknowns: string[] = [];
    const suggestions: string[] = [];
    const risks: string[] = [];
    const evidenceReferences: string[] = [];

    const status = await this.connectorStatus();
    let events: CalendarEventContext[] = [];
    let emails: EmailContext[] = [];
    let busy: Awaited<ReturnType<GoogleReadCapabilities['calendarFreeBusy']>> = [];

    if (status === 'READY') {
      try {
        events = await this.calendarEvents(dayStart, dayEnd);
        busy = await this.capabilities.calendarFreeBusy({ timeMin: dayStart, timeMax: dayEnd });
        emails = await this.searchEmail(`newer_than:3d`, 10);
      } catch (err) {
        unknowns.push(`Calendar or Gmail read failed: ${classify(err)}. Agenda built from local state only.`);
      }
    } else {
      unknowns.push(`Google connectors are ${status}; calendar and email facts are unavailable.`);
    }

    const meetings = events.filter(e => e.status !== 'CANCELLED');
    const cancelled = events.filter(e => e.status === 'CANCELLED');
    if (cancelled.length) facts.push(`${cancelled.length} event(s) on this date are cancelled and excluded from the agenda.`);
    if (events.some(e => !e.timezone)) unknowns.push('One or more events did not carry a timezone.');

    const goals = this.personal.listGoals().filter(g => ['DRAFT', 'ACTIVE', 'PAUSED', 'BLOCKED'].includes(g.status));
    const tasks = this.tasks.listTasks().filter(t => ['WAITING_APPROVAL', 'READY', 'BLOCKED'].includes(t.status)).slice(0, 20);

    const followUps = this.store.saveFollowUps(detectFollowUps({
      emails, events: meetings, ownerAddresses: this.ownerAddresses, now: new Date().toISOString(),
    }));

    const deadlines = followUps
      .filter(f => f.kind === 'EXPLICIT_DEADLINE' && f.dueAt)
      .map(f => ({ summary: f.summary, dueAt: f.dueAt as string, sourceId: f.sourceId }));

    const focusWindows = computeFocusWindows({ busy, dayStart, dayEnd });
    if (!busy.length && status === 'READY') {
      unknowns.push('Free/busy returned no intervals; focus windows assume the whole day is free.');
    }

    // Memory: confirmed working-hour and workflow preferences only.
    const memory = this.personal.buildMemoryPack({
      query: 'working hours communication preference meeting preparation',
      projectIds: goals.flatMap(g => g.projectIds),
      policy: 'PERSONAL_AND_PROJECT',
      maxRecords: 6,
      maxBytes: 4000,
    });
    for (const record of memory.confirmedPreferences) suggestions.push(`Confirmed preference: ${record.summary}`);
    for (const warning of memory.staleWarnings) risks.push(warning);

    facts.push(`${meetings.length} meeting(s) on the calendar for ${date}.`);
    facts.push(`${emails.length} recent email(s) inspected.`);
    facts.push(`${goals.length} active or draft goal(s).`);
    facts.push(`${tasks.length} task(s) awaiting attention.`);
    suggestions.push('Review follow-up candidates before approving any task; none run automatically.');
    if (meetings.length >= 5) risks.push('Five or more meetings today leaves little contiguous focus time.');
    if (followUps.some(f => f.linkConfidence === 'UNCERTAIN')) {
      unknowns.push('Some follow-ups matched a project only weakly and are left unlinked.');
    }

    evidenceReferences.push(...meetings.map(e => e.evidenceReference));
    evidenceReferences.push(...emails.map(e => e.evidenceReference));

    const agenda: DailyAgenda = {
      id: IntelligenceStore.newAgendaId(),
      date,
      timezone: this.timezone,
      meetings,
      deadlines,
      followUps,
      activeGoals: goals.map(g => ({ id: g.id, title: g.title, status: g.status })),
      priorityTasks: tasks.map(t => ({ id: t.id, status: t.status, userRequest: String(t.userRequest || '').slice(0, 200) })),
      availableFocusWindows: focusWindows,
      risks,
      facts,
      suggestions,
      unknowns,
      evidenceReferences: [...new Set(evidenceReferences)].slice(0, 50),
      generatedAt: new Date().toISOString(),
      version: AGENDA_VERSION,
    };

    this.store.recordSync('calendar', 'primary', status, meetings.length);
    this.store.recordSync('gmail', 'primary', status, emails.length);
    return this.store.saveAgenda(agenda);
  }

  async generateWeeklyReview(weekStart = weekStartOf(today())): Promise<WeeklyReview> {
    const existing = this.store.getWeeklyReview(weekStart);
    if (existing) return existing;

    const facts: string[] = [];
    const unknowns: string[] = [];
    const weekEnd = new Date(`${weekStart}T00:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const weekEndIso = weekEnd.toISOString();

    const status = await this.connectorStatus();
    let events: CalendarEventContext[] = [];
    if (status === 'READY') {
      try {
        events = await this.calendarEvents(`${weekStart}T00:00:00.000Z`, weekEndIso);
      } catch (err) {
        unknowns.push(`Calendar read failed: ${classify(err)}.`);
      }
    } else {
      unknowns.push(`Google connectors are ${status}; meeting load is unknown.`);
    }

    const goals = this.personal.listGoals();
    const completedGoals = goals.filter(g => g.status === 'COMPLETED' && (g.completedAt || '') >= weekStart);
    const allTasks = this.tasks.listTasks();
    const completedTasks = allTasks.filter(t => t.status === 'COMPLETED' && String(t.updatedAt || '') >= weekStart);

    const meetings = events.filter(e => e.status !== 'CANCELLED');
    const meetingComplete = status === 'READY';
    const totalMinutes = meetings.reduce((sum, e) => {
      const start = Date.parse(e.start);
      const end = Date.parse(e.end);
      return Number.isFinite(start) && Number.isFinite(end) && end > start ? sum + Math.round((end - start) / 60000) : sum;
    }, 0);
    if (!meetingComplete) unknowns.push('Meeting load and focus-time estimates are incomplete without calendar access.');

    const followUps = this.store.listFollowUps(50);
    const unresolved = followUps.filter(f => f.status === 'SUGGESTION');
    const missed = unresolved
      .filter(f => f.dueAt && f.dueAt < today())
      .map(f => ({ summary: f.summary, sourceId: f.sourceId, dueAt: f.dueAt }));

    const memory = this.personal.buildMemoryPack({
      query: 'lessons learned recurring issues project conventions',
      policy: 'PERSONAL_AND_PROJECT',
      maxRecords: 8,
      maxBytes: 5000,
    });

    let projectHealth: WeeklyReview['projectHealth'] = [];
    try {
      projectHealth = (this.registry?.listProjects() ?? []).slice(0, 10).map(p => ({
        projectId: p.id,
        mapStatus: String(p.mapStatus),
        note: p.mapStatus === 'FRESH' ? 'map is current' : 'map needs regeneration before coding work',
      }));
    } catch { unknowns.push('Project registry unavailable; project health is unknown.'); }

    facts.push(`${completedGoals.length} goal(s) completed this week.`);
    facts.push(`${completedTasks.length} task(s) completed this week.`);
    facts.push(meetingComplete ? `${meetings.length} meeting(s), ${totalMinutes} minutes total.` : 'Meeting totals unavailable.');

    const review: WeeklyReview = {
      id: IntelligenceStore.newReviewId(),
      weekStart,
      timezone: this.timezone,
      completedGoals: completedGoals.map(g => ({ id: g.id, title: g.title })),
      completedTasks: completedTasks.map(t => ({ id: t.id, userRequest: String(t.userRequest || '').slice(0, 200) })),
      missedCommitments: missed,
      unresolvedFollowUps: unresolved.slice(0, 20),
      recurringIssues: memory.recurringIssues.map(r => ({ id: r.id, title: r.title })),
      projectHealth,
      // Never present a derived number as complete when the source data was not.
      meetingLoad: { meetingCount: meetings.length, totalMinutes, complete: meetingComplete },
      focusTimeEstimate: { minutes: meetingComplete ? Math.max(0, 5 * 8 * 60 - totalMinutes) : 0, complete: meetingComplete },
      lessons: memory.previousLessons.map(l => ({ id: l.id, title: l.title })),
      suggestedNextWeekPriorities: unresolved.slice(0, 5).map(f => `Resolve: ${f.summary}`),
      facts,
      unknowns,
      evidenceReferences: [...new Set(meetings.map(e => e.evidenceReference))].slice(0, 50),
      generatedAt: new Date().toISOString(),
      version: REVIEW_VERSION,
    };
    return this.store.saveWeeklyReview(review);
  }

  listFollowUps(limit = 50): FollowUpCandidate[] {
    return this.store.listFollowUps(limit);
  }
}

function classify(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Provider payloads are never surfaced; only the leading classified reason.
  return message.split(':')[0].slice(0, 60);
}

function splitEnvList(value: string | undefined): string[] {
  return (value || '').split(',').map(v => v.trim()).filter(Boolean);
}

function safeRegistry(): ProjectRegistryService | null {
  try { return new ProjectRegistryService(); } catch { return null; }
}

export { weekStartOf, today };
