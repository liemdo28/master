/**
 * Phase 5C persistence — derived records only.
 *
 * This extends the existing Personal OS database rather than introducing a second
 * store. Only Mi's own derived output is persisted: agendas, reviews, follow-up
 * candidates and sync bookkeeping. Gmail and Calendar payloads are never cached here;
 * what survives a run is a bounded summary plus an opaque evidence reference.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import type { DailyAgenda, FollowUpCandidate, WeeklyReview } from './types';

export const PHASE5C_SCHEMA_VERSION = 3;
/** Derived records older than this are pruned on open; external data is not archival. */
export const RETENTION_DAYS = 120;

function dataDir(): string {
  return process.env.MI_PERSONAL_OS_DIR
    ? path.resolve(process.env.MI_PERSONAL_OS_DIR)
    : path.resolve(process.cwd(), '.local-agent-global', 'personal-os');
}

function now(): string {
  return new Date().toISOString();
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function assertIntelligenceId(id: string, label: string): void {
  if (!/^(agenda|review|followup)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error(`invalid ${label}`);
  }
}

export class IntelligenceStore {
  private db: Database.Database;

  constructor(readonly root = dataDir()) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new Database(path.join(root, 'personal-os.db'));
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        appliedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS daily_agendas (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        timezone TEXT NOT NULL,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_agendas_date ON daily_agendas(date);
      CREATE INDEX IF NOT EXISTS idx_daily_agendas_hash ON daily_agendas(contentHash);

      CREATE TABLE IF NOT EXISTS weekly_reviews (
        id TEXT PRIMARY KEY,
        weekStart TEXT NOT NULL,
        timezone TEXT NOT NULL,
        version INTEGER NOT NULL,
        contentHash TEXT NOT NULL,
        payloadJson TEXT NOT NULL,
        generatedAt TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_week ON weekly_reviews(weekStart);

      CREATE TABLE IF NOT EXISTS follow_up_candidates (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        summary TEXT NOT NULL,
        sourceId TEXT NOT NULL,
        sourceType TEXT NOT NULL,
        reason TEXT NOT NULL,
        confidence REAL NOT NULL,
        dueAt TEXT,
        projectIds TEXT NOT NULL,
        goalIds TEXT NOT NULL,
        linkConfidence TEXT NOT NULL,
        evidenceReference TEXT NOT NULL,
        status TEXT NOT NULL,
        contentHash TEXT NOT NULL UNIQUE,
        createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_follow_ups_status ON follow_up_candidates(status);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_up_candidates(dueAt);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_source ON follow_up_candidates(sourceType, sourceId);

      CREATE TABLE IF NOT EXISTS connector_sync_state (
        connector TEXT PRIMARY KEY,
        account TEXT NOT NULL,
        lastSyncedAt TEXT NOT NULL,
        lastStatus TEXT NOT NULL,
        recordCount INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_sync_account ON connector_sync_state(account);
    `);
    this.db.prepare(`INSERT OR IGNORE INTO schema_migrations (version, appliedAt) VALUES (?, ?)`)
      .run(PHASE5C_SCHEMA_VERSION, now());
    this.pruneExpired();
  }

  close(): void { this.db.close(); }

  private pruneExpired(): void {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
    this.db.prepare(`DELETE FROM daily_agendas WHERE date < ?`).run(cutoff);
    this.db.prepare(`DELETE FROM weekly_reviews WHERE weekStart < ?`).run(cutoff);
    this.db.prepare(`DELETE FROM follow_up_candidates WHERE createdAt < ?`)
      .run(new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString());
  }

  /** Generation is idempotent per date: a same-day regeneration returns the stored agenda. */
  saveAgenda(agenda: DailyAgenda): DailyAgenda {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(agenda.date)) throw new Error('invalid agenda date');
    const existing = this.getAgendaByDate(agenda.date);
    if (existing) return existing;
    this.db.prepare(`
      INSERT INTO daily_agendas (id, date, timezone, version, contentHash, payloadJson, generatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(agenda.id, agenda.date, agenda.timezone, agenda.version, hash(agenda.date), JSON.stringify(agenda), agenda.generatedAt);
    return agenda;
  }

  getAgendaByDate(date: string): DailyAgenda | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid agenda date');
    const row = this.db.prepare(`SELECT payloadJson FROM daily_agendas WHERE date = ?`).get(date) as { payloadJson: string } | undefined;
    return row ? readJson<DailyAgenda | null>(row.payloadJson, null) : null;
  }

  getAgenda(id: string): DailyAgenda | null {
    assertIntelligenceId(id, 'agenda id');
    const row = this.db.prepare(`SELECT payloadJson FROM daily_agendas WHERE id = ?`).get(id) as { payloadJson: string } | undefined;
    return row ? readJson<DailyAgenda | null>(row.payloadJson, null) : null;
  }

  saveWeeklyReview(review: WeeklyReview): WeeklyReview {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(review.weekStart)) throw new Error('invalid weekStart');
    const existing = this.getWeeklyReview(review.weekStart);
    if (existing) return existing;
    this.db.prepare(`
      INSERT INTO weekly_reviews (id, weekStart, timezone, version, contentHash, payloadJson, generatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(review.id, review.weekStart, review.timezone, review.version, hash(review.weekStart), JSON.stringify(review), review.generatedAt);
    return review;
  }

  getWeeklyReview(weekStart: string): WeeklyReview | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('invalid weekStart');
    const row = this.db.prepare(`SELECT payloadJson FROM weekly_reviews WHERE weekStart = ?`).get(weekStart) as { payloadJson: string } | undefined;
    return row ? readJson<WeeklyReview | null>(row.payloadJson, null) : null;
  }

  /** Re-detecting the same follow-up returns the stored candidate rather than a duplicate. */
  saveFollowUps(candidates: FollowUpCandidate[]): FollowUpCandidate[] {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO follow_up_candidates
        (id, kind, summary, sourceId, sourceType, reason, confidence, dueAt, projectIds, goalIds,
         linkConfidence, evidenceReference, status, contentHash, createdAt)
      VALUES (@id, @kind, @summary, @sourceId, @sourceType, @reason, @confidence, @dueAt, @projectIds,
              @goalIds, @linkConfidence, @evidenceReference, @status, @contentHash, @createdAt)
    `);
    const lookup = this.db.prepare(`SELECT * FROM follow_up_candidates WHERE contentHash = ?`);
    const out: FollowUpCandidate[] = [];
    const run = this.db.transaction((items: FollowUpCandidate[]) => {
      for (const candidate of items) {
        if (candidate.status !== 'SUGGESTION' && candidate.status !== 'WAITING_APPROVAL') {
          throw new Error('follow-up candidates may only be SUGGESTION or WAITING_APPROVAL');
        }
        const contentHash = hash({
          kind: candidate.kind, sourceId: candidate.sourceId, sourceType: candidate.sourceType, summary: candidate.summary,
        });
        insert.run({
          ...candidate,
          projectIds: JSON.stringify(candidate.projectIds),
          goalIds: JSON.stringify(candidate.goalIds),
          contentHash,
        });
        out.push(this.parseFollowUp(lookup.get(contentHash)));
      }
    });
    run(candidates);
    return out;
  }

  listFollowUps(limit = 50): FollowUpCandidate[] {
    const rows = this.db.prepare(
      `SELECT * FROM follow_up_candidates ORDER BY confidence DESC, createdAt DESC LIMIT ?`,
    ).all(Math.max(1, Math.min(200, limit))) as any[];
    return rows.map(row => this.parseFollowUp(row));
  }

  private parseFollowUp(row: any): FollowUpCandidate {
    return {
      ...row,
      projectIds: readJson<string[]>(row.projectIds, []),
      goalIds: readJson<string[]>(row.goalIds, []),
    } as FollowUpCandidate;
  }

  recordSync(connector: string, account: string, status: string, recordCount: number): void {
    this.db.prepare(`
      INSERT INTO connector_sync_state (connector, account, lastSyncedAt, lastStatus, recordCount)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(connector) DO UPDATE SET
        account=excluded.account, lastSyncedAt=excluded.lastSyncedAt,
        lastStatus=excluded.lastStatus, recordCount=excluded.recordCount
    `).run(connector, account, now(), status, recordCount);
  }

  listSyncState(): Array<{ connector: string; account: string; lastSyncedAt: string; lastStatus: string; recordCount: number }> {
    return this.db.prepare(`SELECT * FROM connector_sync_state ORDER BY connector`).all() as any[];
  }

  /** Disconnecting a connector removes its derived output; nothing lingers. */
  purgeConnector(connector: string): number {
    const removed = this.db.prepare(
      `DELETE FROM follow_up_candidates WHERE sourceType = ?`,
    ).run(connector === 'gmail' ? 'EMAIL' : 'CALENDAR').changes;
    this.db.prepare(`DELETE FROM connector_sync_state WHERE connector = ?`).run(connector);
    return removed;
  }

  integrity(): { integrityCheck: string; foreignKeyViolations: unknown[]; schemaVersion: number } {
    const integrity = this.db.prepare(`PRAGMA integrity_check`).get() as Record<string, string>;
    const foreignKeyViolations = this.db.prepare(`PRAGMA foreign_key_check`).all();
    const row = this.db.prepare(`SELECT MAX(version) AS version FROM schema_migrations`).get() as { version: number | null };
    return { integrityCheck: Object.values(integrity)[0], foreignKeyViolations, schemaVersion: row.version ?? 0 };
  }

  static newAgendaId(): string { return `agenda-${randomUUID()}`; }
  static newReviewId(): string { return `review-${randomUUID()}`; }
}
