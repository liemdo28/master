/**
 * B1 — 7-Day Burn-In Tracker
 * Records every Jarvis action across 7 domains with SQLite persistence.
 * Architecture freeze: no new major features, observability only.
 */

import Database from 'better-sqlite3';
import fs   from 'fs';
import path from 'path';

const GLOBAL = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const DB_PATH = path.join(GLOBAL, 'coo-v4', 'burn-in.db');

// ══════════════════════════════════════════════════════════════════════════
// Domain action types
// ══════════════════════════════════════════════════════════════════════════

export type BurnInDomain =
  | 'work_order'
  | 'approval'
  | 'gmail'
  | 'drive'
  | 'browser'
  | 'website'
  | 'finance';

export type ActionStatus = 'success' | 'failure' | 'retry' | 'pending' | 'skipped';

export interface BurnInEvent {
  id?:         number;
  domain:      BurnInDomain;
  action:      string;
  status:      ActionStatus;
  duration_ms: number;
  error?:      string;
  metadata?:   Record<string, unknown>;
  day:         number;        // 1–7
  recorded_at: string;
}

export interface BurnInDay {
  day:          number;
  date:         string;
  total:        number;
  success:      number;
  failure:      number;
  retry:        number;
  pending:      number;
  success_rate: number;
  failure_rate: number;
  retry_rate:   number;
  avg_ms:       number;
  orphans:      number;
  missing_ev:   number;
  by_domain:    Record<BurnInDomain, { total: number; success: number; failure: number }>;
}

// ══════════════════════════════════════════════════════════════════════════
// DB init
// ══════════════════════════════════════════════════════════════════════════

function openDb(): Database.Database {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      domain      TEXT    NOT NULL,
      action      TEXT    NOT NULL,
      status      TEXT    NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      error       TEXT,
      metadata    TEXT,
      day         INTEGER NOT NULL,
      recorded_at TEXT    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_day    ON events(day);
    CREATE INDEX IF NOT EXISTS idx_events_domain ON events(domain);
    CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

    CREATE TABLE IF NOT EXISTS burn_in_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Record start date if not set
  const existing = db.prepare("SELECT value FROM burn_in_meta WHERE key='start_date'").get() as any;
  if (!existing) {
    db.prepare("INSERT INTO burn_in_meta(key,value) VALUES('start_date',?)").run(new Date().toISOString());
  }
  return db;
}

function getCurrentDay(): number {
  const db = openDb();
  const row = db.prepare("SELECT value FROM burn_in_meta WHERE key='start_date'").get() as any;
  db.close();
  if (!row) return 1;
  const startMs  = new Date(row.value).getTime();
  const day      = Math.floor((Date.now() - startMs) / 86_400_000) + 1;
  return Math.min(Math.max(day, 1), 7);
}

// ══════════════════════════════════════════════════════════════════════════
// Public API
// ══════════════════════════════════════════════════════════════════════════

export function recordEvent(
  domain:      BurnInDomain,
  action:      string,
  status:      ActionStatus,
  duration_ms: number,
  error?:      string,
  metadata?:   Record<string, unknown>,
): void {
  const db = openDb();
  db.prepare(`
    INSERT INTO events(domain,action,status,duration_ms,error,metadata,day,recorded_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(
    domain, action, status, duration_ms,
    error || null,
    metadata ? JSON.stringify(metadata) : null,
    getCurrentDay(),
    new Date().toISOString(),
  );
  db.close();
}

export function getDayMetrics(day: number): BurnInDay {
  const db     = openDb();
  const events = db.prepare('SELECT * FROM events WHERE day=?').all(day) as any[];
  const meta   = db.prepare("SELECT value FROM burn_in_meta WHERE key='start_date'").get() as any;
  db.close();

  const date = meta
    ? new Date(new Date(meta.value).getTime() + (day - 1) * 86_400_000).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const total   = events.length;
  const success = events.filter(e => e.status === 'success').length;
  const failure = events.filter(e => e.status === 'failure').length;
  const retry   = events.filter(e => e.status === 'retry').length;
  const pending = events.filter(e => e.status === 'pending').length;
  const avgMs   = total > 0 ? Math.round(events.reduce((s, e) => s + e.duration_ms, 0) / total) : 0;

  const domains: BurnInDomain[] = ['work_order','approval','gmail','drive','browser','website','finance'];
  const by_domain = Object.fromEntries(domains.map(d => {
    const de = events.filter(e => e.domain === d);
    return [d, {
      total:   de.length,
      success: de.filter(e => e.status === 'success').length,
      failure: de.filter(e => e.status === 'failure').length,
    }];
  })) as Record<BurnInDomain, { total: number; success: number; failure: number }>;

  // Orphan: pending > 30 min
  const thirtyMin = 30 * 60 * 1000;
  const orphans   = events.filter(e => {
    if (e.status !== 'pending') return false;
    const age = Date.now() - new Date(e.recorded_at).getTime();
    return age > thirtyMin;
  }).length;

  return {
    day, date, total, success, failure, retry, pending,
    success_rate: total > 0 ? success / total : 0,
    failure_rate: total > 0 ? failure / total : 0,
    retry_rate:   total > 0 ? retry   / total : 0,
    avg_ms:       avgMs,
    orphans,
    missing_ev:   0, // populated by metrics engine
    by_domain,
  };
}

export function getAllDays(): BurnInDay[] {
  const days: BurnInDay[] = [];
  const current = getCurrentDay();
  for (let d = 1; d <= current; d++) {
    days.push(getDayMetrics(d));
  }
  return days;
}

export function getBurnInStartDate(): string {
  const db  = openDb();
  const row = db.prepare("SELECT value FROM burn_in_meta WHERE key='start_date'").get() as any;
  db.close();
  return row?.value || new Date().toISOString();
}

export function getCurrentBurnInDay(): number {
  return getCurrentDay();
}

export function getBurnInSummary(): {
  days_elapsed: number;
  days_remaining: number;
  total_events: number;
  overall_success_rate: number;
  overall_failure_rate: number;
  overall_retry_rate: number;
  avg_ms: number;
  total_orphans: number;
  status: 'IN_PROGRESS' | 'COMPLETE' | 'NOT_STARTED';
} {
  const db     = openDb();
  const all    = db.prepare('SELECT * FROM events').all() as any[];
  const day    = getCurrentDay();
  db.close();

  const total   = all.length;
  const success = all.filter(e => e.status === 'success').length;
  const failure = all.filter(e => e.status === 'failure').length;
  const retry   = all.filter(e => e.status === 'retry').length;
  const avgMs   = total > 0 ? Math.round(all.reduce((s, e) => s + e.duration_ms, 0) / total) : 0;

  const thirtyMin = 30 * 60 * 1000;
  const orphans = all.filter(e => {
    if (e.status !== 'pending') return false;
    return Date.now() - new Date(e.recorded_at).getTime() > thirtyMin;
  }).length;

  return {
    days_elapsed:         day,
    days_remaining:       Math.max(0, 7 - day),
    total_events:         total,
    overall_success_rate: total > 0 ? success / total : 0,
    overall_failure_rate: total > 0 ? failure / total : 0,
    overall_retry_rate:   total > 0 ? retry   / total : 0,
    avg_ms:               avgMs,
    total_orphans:        orphans,
    status:               total === 0 ? 'NOT_STARTED' : day >= 7 ? 'COMPLETE' : 'IN_PROGRESS',
  };
}

// Convenience wrappers for each domain
export const track = {
  workOrder: (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('work_order', action, status, ms, undefined, meta),
  approval:  (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('approval', action, status, ms, undefined, meta),
  gmail:     (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('gmail', action, status, ms, undefined, meta),
  drive:     (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('drive', action, status, ms, undefined, meta),
  browser:   (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('browser', action, status, ms, undefined, meta),
  website:   (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('website', action, status, ms, undefined, meta),
  finance:   (action: string, status: ActionStatus, ms: number, meta?: Record<string,unknown>) =>
    recordEvent('finance', action, status, ms, undefined, meta),
};
