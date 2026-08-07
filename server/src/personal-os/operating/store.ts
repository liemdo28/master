/**
 * Phase 5D-3 persistence — schema v6 inside the existing Personal OS database.
 *
 * Additive only, same database file as Phase 5A-5D2 (`personal-os.db`), same shared
 * `schema_migrations` table. Idempotency is enforced at the store layer: a brief/EOD
 * review/weekly review is keyed uniquely per date (or week), so generating twice
 * returns the existing record rather than creating a duplicate — the same pattern
 * Phase 5C already uses for `daily_agendas`/`weekly_reviews`. Refreshes and loop runs
 * are content-hash deduped instead, since more than one can legitimately exist per day.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { applyPhase5d2Migration, PHASE5D2_SCHEMA_VERSION } from '../documents/store';
import type {
  DailyOperatingBrief, DailyPlan, DailyPlanStatus, DailyRefresh, EndOfDayReview,
  OperatingLoopPhase, OperatingLoopRun, WeeklyOperatingReview,
} from './types';

export const PHASE5D3_SCHEMA_VERSION = 6;

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

const now = (): string => new Date().toISOString();

function contentHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function currentSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare(`SELECT MAX(version) AS version FROM schema_migrations`).get() as { version: number | null };
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Applies schema v6. Additive and idempotent — a second run applies nothing and a
 * production copy at any earlier version migrates without losing a row. Split out from
 * the class so the migration test can run it against a database copy directly.
 */
export function applyPhase5d3Migration(db: Database.Database): { from: number; to: number; applied: boolean } {
  const before = currentSchemaVersion(db);
  // Chain through 5D-2 first, same pattern 5D-2 used for 5D-1: a database opened for the
  // first time via OperatingStore, at any earlier version, must still pass through every
  // intermediate migration rather than jumping straight to v6's tables alone.
  if (before < PHASE5D2_SCHEMA_VERSION) applyPhase5d2Migration(db);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS daily_operating_briefs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        timezone TEXT NOT NULL,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL,
        refreshedAt TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_operating_briefs_date ON daily_operating_briefs(date);

      CREATE TABLE IF NOT EXISTS daily_plans (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        timezone TEXT NOT NULL,
        briefId TEXT NOT NULL,
        status TEXT NOT NULL,
        version INTEGER NOT NULL,
        payloadJson TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(date);

      CREATE TABLE IF NOT EXISTS daily_refreshes (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        previousBriefId TEXT NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_daily_refreshes_date ON daily_refreshes(date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_refreshes_date_hash ON daily_refreshes(date, contentHash);

      CREATE TABLE IF NOT EXISTS end_of_day_reviews (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        planId TEXT,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_end_of_day_reviews_date ON end_of_day_reviews(date);

      CREATE TABLE IF NOT EXISTS weekly_operating_reviews (
        id TEXT PRIMARY KEY,
        weekStart TEXT NOT NULL,
        weekEnd TEXT NOT NULL,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_operating_reviews_week ON weekly_operating_reviews(weekStart);

      CREATE TABLE IF NOT EXISTS operating_loop_runs (
        id TEXT PRIMARY KEY,
        phase TEXT NOT NULL,
        date TEXT NOT NULL,
        operationId TEXT NOT NULL,
        resultId TEXT NOT NULL,
        contentHash TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_operating_loop_runs_phase_date ON operating_loop_runs(phase, date);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_operating_loop_runs_operation ON operating_loop_runs(phase, operationId);
    `);
    db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`)
      .run(PHASE5D3_SCHEMA_VERSION, now());
  });
  migrate();

  return { from: before, to: currentSchemaVersion(db), applied: before < PHASE5D3_SCHEMA_VERSION };
}

export class OperatingStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    applyPhase5d3Migration(this.db);
  }

  close(): void { this.db.close(); }
  get handle(): Database.Database { return this.db; }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    return {
      integrityCheck: Object.values(integrity)[0],
      foreignKeyViolations: this.db.prepare(`PRAGMA foreign_key_check`).all(),
      schemaVersion: currentSchemaVersion(this.db),
    };
  }

  // ── Daily Operating Brief ──────────────────────────────────────────────────────
  saveBrief(brief: DailyOperatingBrief): DailyOperatingBrief {
    this.db.prepare(`
      INSERT INTO daily_operating_briefs (id, date, timezone, version, contentHash, payloadJson, generatedAt, refreshedAt)
      VALUES (@id, @date, @timezone, @version, @contentHash, @payloadJson, @generatedAt, @refreshedAt)
    `).run({
      id: brief.id, date: brief.date, timezone: brief.timezone, version: brief.version,
      contentHash: contentHash(brief), payloadJson: JSON.stringify(brief),
      generatedAt: brief.generatedAt, refreshedAt: brief.refreshedAt,
    });
    return brief;
  }

  latestBriefForDate(date: string): DailyOperatingBrief | null {
    const row = this.db.prepare(`SELECT payloadJson FROM daily_operating_briefs WHERE date = ?`).get(date) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as DailyOperatingBrief) : null;
  }

  getBrief(id: string): DailyOperatingBrief | null {
    const row = this.db.prepare(`SELECT payloadJson FROM daily_operating_briefs WHERE id = ?`).get(id) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as DailyOperatingBrief) : null;
  }

  updateBriefRefreshedAt(id: string, refreshedAt: string): void {
    const brief = this.getBrief(id);
    if (!brief) return;
    brief.refreshedAt = refreshedAt;
    this.db.prepare(`UPDATE daily_operating_briefs SET payloadJson = ?, refreshedAt = ? WHERE id = ?`)
      .run(JSON.stringify(brief), refreshedAt, id);
  }

  // ── Daily Plan ──────────────────────────────────────────────────────────────
  savePlan(plan: DailyPlan): DailyPlan {
    this.db.prepare(`
      INSERT INTO daily_plans (id, date, timezone, briefId, status, version, payloadJson, createdAt, updatedAt)
      VALUES (@id, @date, @timezone, @briefId, @status, @version, @payloadJson, @createdAt, @updatedAt)
    `).run({
      id: plan.id, date: plan.date, timezone: plan.timezone, briefId: plan.briefId,
      status: plan.status, version: plan.version, payloadJson: JSON.stringify(plan),
      createdAt: plan.createdAt, updatedAt: plan.updatedAt,
    });
    return plan;
  }

  latestPlanForDate(date: string): DailyPlan | null {
    const row = this.db.prepare(`SELECT payloadJson FROM daily_plans WHERE date = ?`).get(date) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as DailyPlan) : null;
  }

  getPlan(id: string): DailyPlan | null {
    const row = this.db.prepare(`SELECT payloadJson FROM daily_plans WHERE id = ?`).get(id) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as DailyPlan) : null;
  }

  /** The only mutation a plan ever receives: a status change. Never touches tasks. */
  setPlanStatus(id: string, status: DailyPlanStatus): DailyPlan | null {
    const plan = this.getPlan(id);
    if (!plan) return null;
    plan.status = status;
    plan.updatedAt = now();
    this.db.prepare(`UPDATE daily_plans SET payloadJson = ?, status = ?, updatedAt = ? WHERE id = ?`)
      .run(JSON.stringify(plan), status, plan.updatedAt, id);
    return plan;
  }

  // ── Daily Refresh ───────────────────────────────────────────────────────────
  saveRefreshIfNew(refresh: DailyRefresh): { refresh: DailyRefresh; created: boolean } {
    const hash = contentHash({ date: refresh.date, changedFacts: refresh.changedFacts, newRisks: refresh.newRisks, resolvedBlockers: refresh.resolvedBlockers, newFollowUps: refresh.newFollowUps, planAdjustments: refresh.planAdjustments });
    const existing = this.db.prepare(`SELECT payloadJson FROM daily_refreshes WHERE date = ? AND contentHash = ?`).get(refresh.date, hash) as { payloadJson: string } | undefined;
    if (existing) return { refresh: JSON.parse(existing.payloadJson) as DailyRefresh, created: false };
    this.db.prepare(`
      INSERT INTO daily_refreshes (id, date, previousBriefId, contentHash, payloadJson, generatedAt)
      VALUES (@id, @date, @previousBriefId, @contentHash, @payloadJson, @generatedAt)
    `).run({ id: refresh.id, date: refresh.date, previousBriefId: refresh.previousBriefId, contentHash: hash, payloadJson: JSON.stringify(refresh), generatedAt: refresh.generatedAt });
    return { refresh, created: true };
  }

  listRefreshesForDate(date: string): DailyRefresh[] {
    const rows = this.db.prepare(`SELECT payloadJson FROM daily_refreshes WHERE date = ? ORDER BY generatedAt ASC`).all(date) as Array<{ payloadJson: string }>;
    return rows.map(r => JSON.parse(r.payloadJson) as DailyRefresh);
  }

  // ── End of Day Review ───────────────────────────────────────────────────────
  saveReview(review: EndOfDayReview): EndOfDayReview {
    this.db.prepare(`
      INSERT INTO end_of_day_reviews (id, date, planId, version, contentHash, payloadJson, generatedAt)
      VALUES (@id, @date, @planId, @version, @contentHash, @payloadJson, @generatedAt)
    `).run({ id: review.id, date: review.date, planId: review.planId, version: review.version, contentHash: contentHash(review), payloadJson: JSON.stringify(review), generatedAt: review.generatedAt });
    return review;
  }

  latestReviewForDate(date: string): EndOfDayReview | null {
    const row = this.db.prepare(`SELECT payloadJson FROM end_of_day_reviews WHERE date = ?`).get(date) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as EndOfDayReview) : null;
  }

  // ── Weekly Operating Review ─────────────────────────────────────────────────
  saveWeeklyReview(review: WeeklyOperatingReview): WeeklyOperatingReview {
    this.db.prepare(`
      INSERT INTO weekly_operating_reviews (id, weekStart, weekEnd, version, contentHash, payloadJson, generatedAt)
      VALUES (@id, @weekStart, @weekEnd, @version, @contentHash, @payloadJson, @generatedAt)
    `).run({ id: review.id, weekStart: review.weekStart, weekEnd: review.weekEnd, version: review.version, contentHash: contentHash(review), payloadJson: JSON.stringify(review), generatedAt: review.generatedAt });
    return review;
  }

  latestWeeklyReview(weekStart: string): WeeklyOperatingReview | null {
    const row = this.db.prepare(`SELECT payloadJson FROM weekly_operating_reviews WHERE weekStart = ?`).get(weekStart) as { payloadJson: string } | undefined;
    return row ? (JSON.parse(row.payloadJson) as WeeklyOperatingReview) : null;
  }

  // ── Operating Loop Runs (audit trail, idempotency marker) ──────────────────
  recordRun(phase: OperatingLoopPhase, date: string, operationId: string, resultId: string): OperatingLoopRun | null {
    const run: OperatingLoopRun = { id: `run-${randomUUID()}`, phase, date, operationId, resultId, contentHash: contentHash({ phase, date, operationId, resultId }), createdAt: now() };
    try {
      this.db.prepare(`
        INSERT INTO operating_loop_runs (id, phase, date, operationId, resultId, contentHash, createdAt)
        VALUES (@id, @phase, @date, @operationId, @resultId, @contentHash, @createdAt)
      `).run(run);
      return run;
    } catch {
      return null; // operationId already recorded for this phase — not an error, just a no-op
    }
  }

  findRunByOperation(phase: OperatingLoopPhase, operationId: string): OperatingLoopRun | null {
    const row = this.db.prepare(`SELECT * FROM operating_loop_runs WHERE phase = ? AND operationId = ?`).get(phase, operationId) as OperatingLoopRun | undefined;
    return row ?? null;
  }
}
