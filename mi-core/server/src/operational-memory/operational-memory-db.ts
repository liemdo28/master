/**
 * Operational Memory Store — Phase 15.1
 * SQLite database that normalizes historical execution data from:
 *   - ledger.jsonl (all agent action records)
 *   - work-orders/*.json (structured work orders)
 * into queryable tables for incident, execution, owner, and temporal analysis.
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'D:/Project/Master/mi-core';
const GLOBAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global');
const MEM_DIR = path.join(GLOBAL_DIR, 'operational-memory');
const MEM_DB = path.join(MEM_DIR, 'memory.db');
const LEDGER_FILE = path.join(GLOBAL_DIR, 'execution-ledger/ledger.jsonl');
const WO_DIR = path.join(GLOBAL_DIR, 'work-orders');

// ── DB init ──────────────────────────────────────────────────────────────────

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(MEM_DIR, { recursive: true });
  _db = new Database(MEM_DB);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- One row per completed/failed work order
    CREATE TABLE IF NOT EXISTS executions (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      completed_at TEXT,
      source       TEXT DEFAULT 'api',
      requested_by TEXT DEFAULT 'ceo',
      intent       TEXT,
      target_project TEXT,
      priority     TEXT DEFAULT 'P2',
      final_verdict TEXT,
      duration_ms  INTEGER,
      step_count   INTEGER DEFAULT 0,
      pass_count   INTEGER DEFAULT 0,
      fail_count   INTEGER DEFAULT 0,
      agent_roles  TEXT DEFAULT '[]',
      raw_request  TEXT DEFAULT ''
    );

    -- One row per FAIL or APPROVAL_REQUIRED ledger entry
    CREATE TABLE IF NOT EXISTS incidents (
      id               TEXT PRIMARY KEY,
      work_order_id    TEXT,
      ts               TEXT NOT NULL,
      target           TEXT,
      agent_role       TEXT,
      action_type      TEXT,
      error_summary    TEXT,
      verdict          TEXT,
      resolved         INTEGER DEFAULT 0,
      resolution_notes TEXT DEFAULT '',
      recur_count      INTEGER DEFAULT 0
    );

    -- One row per ledger entry (all verdicts), tagged by owner/role
    CREATE TABLE IF NOT EXISTS owner_actions (
      id            TEXT PRIMARY KEY,
      work_order_id TEXT,
      ts            TEXT NOT NULL,
      owner         TEXT,
      agent_role    TEXT,
      action_type   TEXT,
      target        TEXT,
      verdict       TEXT,
      duration_ms   INTEGER DEFAULT 0
    );

    -- Pre-aggregated period summaries (rebuilt on each sync)
    CREATE TABLE IF NOT EXISTS period_summaries (
      id              TEXT PRIMARY KEY,
      period          TEXT NOT NULL,
      period_start    TEXT NOT NULL,
      period_end      TEXT NOT NULL,
      target_project  TEXT NOT NULL,
      total_execs     INTEGER DEFAULT 0,
      pass_count      INTEGER DEFAULT 0,
      fail_count      INTEGER DEFAULT 0,
      incident_count  INTEGER DEFAULT 0,
      avg_duration_ms REAL DEFAULT 0,
      UNIQUE(period, period_start, target_project)
    );

    -- Sync state — track last synced ledger line count
    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_exec_project   ON executions(target_project);
    CREATE INDEX IF NOT EXISTS idx_exec_verdict   ON executions(final_verdict);
    CREATE INDEX IF NOT EXISTS idx_exec_created   ON executions(created_at);
    CREATE INDEX IF NOT EXISTS idx_inc_target     ON incidents(target);
    CREATE INDEX IF NOT EXISTS idx_inc_ts         ON incidents(ts);
    CREATE INDEX IF NOT EXISTS idx_oa_owner       ON owner_actions(owner);
    CREATE INDEX IF NOT EXISTS idx_oa_role        ON owner_actions(agent_role);
    CREATE INDEX IF NOT EXISTS idx_oa_target      ON owner_actions(target);
  `);
}

// ── Sync from ledger + work orders ──────────────────────────────────────────

export interface LedgerEntry {
  entry_id: string;
  ts: string;
  work_order_id?: string;
  requested_by: string;
  agent_role: string;
  action_type: string;
  target: string;
  evidence?: string;
  verdict: string;
  detail?: string;
  test_result?: string;
}

export interface WorkOrderRecord {
  request_id: string;
  created_at: string;
  updated_at: string;
  source?: string;
  requested_by?: string;
  raw_request?: string;
  intent?: { intent?: string; target_project?: string };
  target_project?: string;
  priority?: string;
  status?: string;
}

function readLedger(): LedgerEntry[] {
  try {
    const content = fs.readFileSync(LEDGER_FILE, 'utf8');
    return content.split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean) as LedgerEntry[];
  } catch { return []; }
}

function readWorkOrders(): WorkOrderRecord[] {
  try {
    return fs.readdirSync(WO_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(WO_DIR, f), 'utf8')); }
        catch { return null; }
      }).filter(Boolean) as WorkOrderRecord[];
  } catch { return []; }
}

export function syncMemory(): { synced_entries: number; synced_work_orders: number } {
  const db = getDb();
  const entries = readLedger();
  const workOrders = readWorkOrders();

  const insertExec = db.prepare(`
    INSERT OR REPLACE INTO executions
      (id, created_at, completed_at, source, requested_by, intent, target_project, priority, final_verdict, duration_ms, step_count, pass_count, fail_count, agent_roles, raw_request)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  const insertIncident = db.prepare(`
    INSERT OR IGNORE INTO incidents (id, work_order_id, ts, target, agent_role, action_type, error_summary, verdict)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  const insertOA = db.prepare(`
    INSERT OR IGNORE INTO owner_actions (id, work_order_id, ts, owner, agent_role, action_type, target, verdict)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  // Group ledger entries by work_order_id
  const byWO = new Map<string, LedgerEntry[]>();
  for (const e of entries) {
    const key = e.work_order_id || 'standalone';
    if (!byWO.has(key)) byWO.set(key, []);
    byWO.get(key)!.push(e);
  }

  const syncAll = db.transaction(() => {
    // Sync work orders → executions table
    for (const wo of workOrders) {
      const woEntries = byWO.get(wo.request_id) || [];
      const passes = woEntries.filter(e => e.verdict === 'PASS').length;
      const fails = woEntries.filter(e => e.verdict === 'FAIL').length;
      const roles = [...new Set(woEntries.map(e => e.agent_role))];
      const lastEntry = woEntries[woEntries.length - 1];
      const finalVerdict = lastEntry?.verdict ?? 'PENDING';

      let durationMs = 0;
      if (wo.created_at && wo.updated_at) {
        durationMs = new Date(wo.updated_at).getTime() - new Date(wo.created_at).getTime();
      }

      insertExec.run(
        wo.request_id, wo.created_at, wo.updated_at || null,
        wo.source || 'api', wo.requested_by || 'ceo',
        wo.intent?.intent || null,
        wo.target_project || wo.intent?.target_project || null,
        wo.priority || 'P2',
        finalVerdict, durationMs, woEntries.length, passes, fails,
        JSON.stringify(roles), wo.raw_request || ''
      );
    }

    // Sync all ledger entries → incidents + owner_actions
    for (const e of entries) {
      // owner_actions: every entry
      insertOA.run(e.entry_id, e.work_order_id || null, e.ts,
        e.requested_by, e.agent_role, e.action_type, e.target, e.verdict);

      // incidents: only FAIL entries
      if (e.verdict === 'FAIL' || e.verdict === 'APPROVAL_REQUIRED') {
        const summary = e.evidence || e.detail || `${e.action_type} failed`;
        insertIncident.run(e.entry_id, e.work_order_id || null, e.ts,
          e.target, e.agent_role, e.action_type, summary, e.verdict);
      }
    }

    // Update sync state
    db.prepare(`INSERT OR REPLACE INTO sync_state (key,value) VALUES ('last_sync', ?)`)
      .run(new Date().toISOString());
    db.prepare(`INSERT OR REPLACE INTO sync_state (key,value) VALUES ('entry_count', ?)`)
      .run(String(entries.length));
  });

  syncAll();
  rebuildPeriodSummaries(db);

  return { synced_entries: entries.length, synced_work_orders: workOrders.length };
}

// ── Period summaries rebuild ─────────────────────────────────────────────────

function rebuildPeriodSummaries(db: Database.Database): void {
  db.prepare('DELETE FROM period_summaries').run();

  const periods: Array<{ period: string; days: number }> = [
    { period: 'week', days: 7 },
    { period: 'month', days: 30 },
    { period: 'quarter', days: 90 },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO period_summaries
      (id, period, period_start, period_end, target_project, total_execs, pass_count, fail_count, incident_count, avg_duration_ms)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);

  const rebuild = db.transaction(() => {
    for (const { period, days } of periods) {
      const cutoff = new Date(Date.now() - days * 86400_000).toISOString();
      const now = new Date().toISOString();

      const rows = db.prepare(`
        SELECT target_project,
               COUNT(*) as total,
               SUM(CASE WHEN final_verdict='PASS' THEN 1 ELSE 0 END) as passes,
               SUM(CASE WHEN final_verdict='FAIL' THEN 1 ELSE 0 END) as fails,
               AVG(duration_ms) as avg_dur
        FROM executions
        WHERE created_at >= ? AND target_project IS NOT NULL
        GROUP BY target_project
      `).all(cutoff) as any[];

      for (const row of rows) {
        // Count incidents for this project in this period
        const incCount = (db.prepare(`
          SELECT COUNT(*) as c FROM incidents
          WHERE ts >= ? AND target = ?
        `).get(cutoff, row.target_project) as any).c;

        const id = `${period}__${row.target_project}`;
        insert.run(id, period, cutoff, now, row.target_project,
          row.total, row.passes, row.fails, incCount, row.avg_dur || 0);
      }
    }
  });
  rebuild();
}

// ── Accessors ────────────────────────────────────────────────────────────────

export function getLastSyncTime(): string | null {
  const row = getDb().prepare(`SELECT value FROM sync_state WHERE key='last_sync'`).get() as any;
  return row?.value || null;
}

export function getMemoryStats() {
  const db = getDb();
  return {
    executions: (db.prepare('SELECT COUNT(*) as c FROM executions').get() as any).c,
    incidents: (db.prepare('SELECT COUNT(*) as c FROM incidents').get() as any).c,
    owner_actions: (db.prepare('SELECT COUNT(*) as c FROM owner_actions').get() as any).c,
    period_summaries: (db.prepare('SELECT COUNT(*) as c FROM period_summaries').get() as any).c,
    last_sync: getLastSyncTime(),
  };
}

export function insertSyntheticExecution(exec: {
  id: string; created_at: string; completed_at: string; source?: string;
  requested_by?: string; intent?: string; target_project?: string; priority?: string;
  final_verdict: string; duration_ms?: number; step_count?: number;
  pass_count?: number; fail_count?: number; agent_roles?: string[]; raw_request?: string;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO executions
      (id, created_at, completed_at, source, requested_by, intent, target_project, priority, final_verdict, duration_ms, step_count, pass_count, fail_count, agent_roles, raw_request)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    exec.id, exec.created_at, exec.completed_at,
    exec.source || 'api', exec.requested_by || 'ceo',
    exec.intent || null, exec.target_project || null,
    exec.priority || 'P2', exec.final_verdict,
    exec.duration_ms || 0, exec.step_count || 0,
    exec.pass_count || 0, exec.fail_count || 0,
    JSON.stringify(exec.agent_roles || []), exec.raw_request || ''
  );
}

export function insertSyntheticIncident(inc: {
  id: string; work_order_id?: string; ts: string; target: string;
  agent_role: string; action_type: string; error_summary: string;
  verdict?: string; resolved?: boolean; resolution_notes?: string; recur_count?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO incidents
      (id, work_order_id, ts, target, agent_role, action_type, error_summary, verdict, resolved, resolution_notes, recur_count)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    inc.id, inc.work_order_id || null, inc.ts, inc.target,
    inc.agent_role, inc.action_type, inc.error_summary,
    inc.verdict || 'FAIL', inc.resolved ? 1 : 0,
    inc.resolution_notes || '', inc.recur_count || 0
  );
}

export function insertSyntheticOwnerAction(oa: {
  id: string; work_order_id?: string; ts: string; owner: string;
  agent_role: string; action_type: string; target: string;
  verdict: string; duration_ms?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT OR REPLACE INTO owner_actions
      (id, work_order_id, ts, owner, agent_role, action_type, target, verdict, duration_ms)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    oa.id, oa.work_order_id || null, oa.ts, oa.owner,
    oa.agent_role, oa.action_type, oa.target,
    oa.verdict, oa.duration_ms || 0
  );
}
