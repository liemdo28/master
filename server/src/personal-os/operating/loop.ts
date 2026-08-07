/**
 * DailyOperatingLoop — the single canonical orchestrator for all four phases
 * (MORNING/MIDDAY/EVENING/WEEKLY). Every method delegates to the one canonical builder
 * for that phase (brief.ts/plan.ts/refresh.ts/review.ts/weekly.ts) and records an
 * `operating_loop_runs` audit entry. Idempotency itself lives in the builders (each
 * result type is uniquely keyed by date/week in OperatingStore) — this class adds an
 * explicit operationId audit trail on top, the same idempotency-key pattern Phase 5D-1
 * uses for document ingestion.
 */

import { GoogleReadClient, inspectToken } from '../../intelligence/google-read-client';
import { createFixtureTransport, createLiveTransport, defaultTokenFile } from '../../intelligence/transports';
import { IntelligenceService, today, weekStartOf } from '../../intelligence/service';
import { PersonalOsStore } from '../store';
import { TaskStore } from '../../task-runtime/store';
import { ProjectRegistryService } from '../../project-registry/service';
import { DocumentStore } from '../documents/store';
import { OperatingStore } from './store';
import { buildDailyOperatingBrief } from './brief';
import { buildDailyPlan } from './plan';
import { buildDailyRefresh } from './refresh';
import { buildEndOfDayReview } from './review';
import { buildWeeklyOperatingReview } from './weekly';
import type {
  DailyOperatingBrief, DailyPlan, DailyPlanStatus, DailyRefresh, EndOfDayReview, WeeklyOperatingReview,
} from './types';

export interface DailyOperatingLoopOptions {
  personalStore?: PersonalOsStore;
  taskStore?: TaskStore;
  registry?: ProjectRegistryService | null;
  documentStore?: DocumentStore;
  operatingStore?: OperatingStore;
  intelligence?: IntelligenceService;
}

function safeRegistry(): ProjectRegistryService | null {
  try { return new ProjectRegistryService(); } catch { return null; }
}

export class DailyOperatingLoop {
  readonly personalStore: PersonalOsStore;
  readonly taskStore: TaskStore;
  readonly registry: ProjectRegistryService | null;
  readonly documentStore: DocumentStore;
  readonly operatingStore: OperatingStore;
  private readonly intelligence: IntelligenceService;
  private readonly ownsIntelligence: boolean;

  constructor(options: DailyOperatingLoopOptions = {}) {
    this.personalStore = options.personalStore ?? new PersonalOsStore();
    this.taskStore = options.taskStore ?? new TaskStore();
    this.registry = options.registry !== undefined ? options.registry : safeRegistry();
    this.documentStore = options.documentStore ?? new DocumentStore();
    this.operatingStore = options.operatingStore ?? new OperatingStore();
    this.ownsIntelligence = !options.intelligence;
    this.intelligence = options.intelligence ?? buildIntelligenceService(this.personalStore, this.taskStore, this.registry);
  }

  close(): void {
    this.personalStore.close();
    this.taskStore.close();
    this.registry?.close();
    this.documentStore.close();
    this.operatingStore.close();
    if (this.ownsIntelligence) this.intelligence.close();
  }

  private deps() {
    return {
      personalStore: this.personalStore, taskStore: this.taskStore, registry: this.registry,
      documentStore: this.documentStore, operatingStore: this.operatingStore, intelligence: this.intelligence,
    };
  }

  async morning(date = today(), operationId?: string): Promise<DailyOperatingBrief> {
    const brief = await buildDailyOperatingBrief(this.deps(), date);
    this.operatingStore.recordRun('MORNING', date, operationId ?? `morning-${date}`, brief.id);
    return brief;
  }

  async midday(date = today(), operationId?: string): Promise<{ refresh: DailyRefresh; created: boolean }> {
    const brief = this.operatingStore.latestBriefForDate(date) ?? await this.morning(date);
    const result = await buildDailyRefresh(this.deps(), brief);
    this.operatingStore.recordRun('MIDDAY', date, operationId ?? `midday-${date}-${result.refresh.id}`, result.refresh.id);
    return result;
  }

  plan(date = today()): DailyPlan {
    const brief = this.operatingStore.latestBriefForDate(date);
    if (!brief) throw new Error('generate the morning brief before requesting a plan');
    const plan = buildDailyPlan({ taskStore: this.taskStore, operatingStore: this.operatingStore }, brief);
    this.operatingStore.recordRun('MORNING', date, `plan-${date}`, plan.id);
    return plan;
  }

  setPlanStatus(planId: string, status: DailyPlanStatus): DailyPlan | null {
    return this.operatingStore.setPlanStatus(planId, status);
  }

  async evening(date = today(), operationId?: string): Promise<EndOfDayReview> {
    const plan = this.operatingStore.latestPlanForDate(date);
    const review = buildEndOfDayReview({ taskStore: this.taskStore, personalStore: this.personalStore, operatingStore: this.operatingStore }, date, plan);
    this.operatingStore.recordRun('EVENING', date, operationId ?? `evening-${date}`, review.id);
    return review;
  }

  async weekly(weekStart = weekStartOf(today()), operationId?: string): Promise<WeeklyOperatingReview> {
    const review = await buildWeeklyOperatingReview(this.deps(), weekStart);
    this.operatingStore.recordRun('WEEKLY', weekStart, operationId ?? `weekly-${weekStart}`, review.id);
    return review;
  }
}

function buildIntelligenceService(personal: PersonalOsStore, tasks: TaskStore, registry: ProjectRegistryService | null): IntelligenceService {
  const tokenState = inspectToken();
  const transport = tokenState.status === 'READY' ? createLiveTransport(defaultTokenFile()) : createFixtureTransport({});
  return new IntelligenceService({
    capabilities: new GoogleReadClient(transport, tokenState),
    personal, tasks, registry: registry ?? undefined,
  });
}
