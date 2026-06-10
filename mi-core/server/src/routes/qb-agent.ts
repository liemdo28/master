/**
 * QB Agent routes — receives heartbeats, events, results, and errors from QB desktop agents.
 * Stores data in SQLite via better-sqlite3 (same pattern as other mi-core routes).
 * Dashboard available at /qb-agent (served via static UI).
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import * as sheetSync from '../services/qbAgentSheetSyncService';

const DATA_DIR = process.env.MI_DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'qb-agent.db'));

// ── Schema ───────────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS machines (
    machine_id       TEXT PRIMARY KEY,
    machine_name     TEXT,
    store_code       TEXT,
    store_name       TEXT,
    location         TEXT,
    app_version      TEXT,
    os_version       TEXT,
    hostname         TEXT,
    status           TEXT DEFAULT 'unknown',
    registered_at    TEXT,
    last_heartbeat   TEXT,
    last_seen_at     TEXT,
    meta_json        TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS heartbeats (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id       TEXT NOT NULL,
    store_code       TEXT,
    status           TEXT,
    qb_open          INTEGER DEFAULT 0,
    qb_company       TEXT,
    app_version      TEXT,
    uptime_seconds   INTEGER,
    received_at      TEXT,
    meta_json        TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS events (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id       TEXT NOT NULL,
    store_code       TEXT,
    event_type       TEXT,
    event_key        TEXT,
    message          TEXT,
    severity         TEXT DEFAULT 'info',
    occurred_at      TEXT,
    received_at      TEXT,
    payload_json     TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS activity_log_results (
    id                           INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id                   TEXT NOT NULL,
    store_code                   TEXT,
    file_id                      TEXT,
    business_date                TEXT,
    total_transactions           INTEGER DEFAULT 0,
    total_amount                 REAL DEFAULT 0,
    latest_sales_receipt_date    TEXT,
    latest_sales_receipt_ref     TEXT,
    latest_sales_receipt_amount  REAL,
    latest_bank_transaction_date TEXT,
    latest_reconcile_date        TEXT,
    local_json_path              TEXT,
    local_markdown_path          TEXT,
    metrics_json                 TEXT DEFAULT '{}',
    warnings_json                TEXT DEFAULT '[]',
    errors_json                  TEXT DEFAULT '[]',
    duration_ms                  INTEGER,
    generated_at                 TEXT,
    received_at                  TEXT
  );

  CREATE TABLE IF NOT EXISTS timeline_results (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id       TEXT NOT NULL,
    store_code       TEXT,
    file_id          TEXT,
    business_date    TEXT,
    events_json      TEXT DEFAULT '[]',
    generated_at     TEXT,
    received_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_results (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id           TEXT NOT NULL,
    store_code           TEXT,
    file_id              TEXT,
    business_date        TEXT,
    status               TEXT,
    transactions_synced  INTEGER DEFAULT 0,
    errors_json          TEXT DEFAULT '[]',
    result_json          TEXT DEFAULT '{}',
    generated_at         TEXT,
    received_at          TEXT
  );

  CREATE TABLE IF NOT EXISTS error_reports (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id   TEXT NOT NULL,
    store_code   TEXT,
    severity     TEXT,
    component    TEXT,
    message      TEXT,
    exception    TEXT,
    context_json TEXT DEFAULT '{}',
    occurred_at  TEXT,
    received_at  TEXT
  );

  CREATE TABLE IF NOT EXISTS qb_files (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    machine_id            TEXT NOT NULL,
    file_id               TEXT NOT NULL,
    store_code            TEXT,
    company_file_path     TEXT,
    expected_company_name TEXT,
    enabled               INTEGER DEFAULT 1,
    last_status           TEXT,
    last_synced_at        TEXT,
    next_sync_at          TEXT,
    last_error            TEXT,
    registered_at         TEXT,
    updated_at            TEXT,
    UNIQUE(machine_id, file_id)
  );

  CREATE TABLE IF NOT EXISTS sync_cycles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    cycle_id         TEXT UNIQUE NOT NULL,
    machine_id       TEXT NOT NULL,
    started_at       TEXT,
    finished_at      TEXT,
    total_files      INTEGER DEFAULT 0,
    pass_count       INTEGER DEFAULT 0,
    warning_count    INTEGER DEFAULT 0,
    error_count      INTEGER DEFAULT 0,
    next_cycle_at    TEXT,
    received_at      TEXT
  );

  CREATE TABLE IF NOT EXISTS commands (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    command_id    TEXT UNIQUE NOT NULL,
    machine_id    TEXT NOT NULL,
    command_type  TEXT NOT NULL,
    payload_json  TEXT DEFAULT '{}',
    status        TEXT DEFAULT 'pending',
    created_at    TEXT,
    acked_at      TEXT,
    result_json   TEXT DEFAULT '{}',
    completed_at  TEXT,
    error         TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_machines_last_seen ON machines(last_seen_at);
  CREATE INDEX IF NOT EXISTS idx_heartbeats_machine ON heartbeats(machine_id, received_at);
  CREATE INDEX IF NOT EXISTS idx_events_machine ON events(machine_id, received_at);
  CREATE INDEX IF NOT EXISTS idx_activity_machine_date ON activity_log_results(machine_id, business_date);
  CREATE INDEX IF NOT EXISTS idx_commands_machine_status ON commands(machine_id, status);
  CREATE INDEX IF NOT EXISTS idx_qb_files_machine ON qb_files(machine_id);
`);

// ── Auth middleware ───────────────────────────────────────────────────────────
function requireAgentAuth(req: Request, res: Response, next: () => void) {
  const MI_CORE_API_KEY = process.env.MI_CORE_API_KEY || process.env.AGENT_CODING_API_KEY || '';
  if (!MI_CORE_API_KEY) return next(); // not configured → open
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token !== MI_CORE_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

function now() { return new Date().toISOString(); }
function cid() { return crypto.randomUUID(); }

export const qbAgentRouter = Router();
qbAgentRouter.use(requireAgentAuth);

// ── Ping ─────────────────────────────────────────────────────────────────────
qbAgentRouter.get('/ping', (_req, res) => {
  res.json({ ok: true, server: 'mi-core', timestamp: now() });
});

// ── Register ──────────────────────────────────────────────────────────────────
qbAgentRouter.post('/register', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  if (!machineId) { res.status(400).json({ error: 'machine_id required' }); return; }

  const existing = db.prepare('SELECT machine_id FROM machines WHERE machine_id = ?').get(machineId);
  if (existing) {
    db.prepare(`UPDATE machines SET machine_name=?, store_code=?, store_name=?, location=?,
      app_version=?, os_version=?, hostname=?, status='online', last_seen_at=? WHERE machine_id=?`)
      .run(b.machine_name, b.store_code, b.store_name, b.location,
           b.app_version, b.os_version, b.hostname, now(), machineId);
  } else {
    db.prepare(`INSERT INTO machines (machine_id, machine_name, store_code, store_name, location,
      app_version, os_version, hostname, status, registered_at, last_seen_at)
      VALUES (?,?,?,?,?,?,?,?,'online',?,?)`)
      .run(machineId, b.machine_name, b.store_code, b.store_name, b.location,
           b.app_version, b.os_version, b.hostname, now(), now());
  }
  sheetSync.onRegister({ ...b, machine_id: machineId });
  res.json({ ok: true, machine_id: machineId, registered_at: now() });
});

// ── Heartbeat ─────────────────────────────────────────────────────────────────
qbAgentRouter.post('/heartbeat', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  if (!machineId) { res.status(400).json({ error: 'machine_id required' }); return; }

  const ts = now();
  db.prepare(`INSERT INTO heartbeats (machine_id, store_code, status, qb_open, qb_company,
    app_version, uptime_seconds, received_at, meta_json)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.status || 'ok',
         b.qb_open ? 1 : 0, b.qb_company, b.app_version,
         b.uptime_seconds, ts, JSON.stringify(b.meta || {}));

  db.prepare(`UPDATE machines SET status='online', last_heartbeat=?, last_seen_at=? WHERE machine_id=?`)
    .run(ts, ts, machineId);

  sheetSync.onHeartbeat({ ...b, machine_id: machineId, received_at: ts });
  res.json({ ok: true, received_at: ts });
});

// ── Event ─────────────────────────────────────────────────────────────────────
qbAgentRouter.post('/event', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  db.prepare(`INSERT INTO events (machine_id, store_code, event_type, event_key, message,
    severity, occurred_at, received_at, payload_json)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.event_type, b.event_key, b.message,
         b.severity || 'info', b.occurred_at, now(), JSON.stringify(b.payload || {}));
  res.json({ ok: true });
});

// ── Activity Log Result ───────────────────────────────────────────────────────
qbAgentRouter.post('/activity-log-result', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  db.prepare(`INSERT INTO activity_log_results
    (machine_id, store_code, file_id, business_date, total_transactions, total_amount,
     latest_sales_receipt_date, latest_sales_receipt_ref, latest_sales_receipt_amount,
     latest_bank_transaction_date, latest_reconcile_date, local_json_path, local_markdown_path,
     metrics_json, warnings_json, errors_json, duration_ms, generated_at, received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.file_id, b.business_date,
         b.total_transactions || 0, b.total_amount || 0,
         b.latest_sales_receipt_date, b.latest_sales_receipt_ref, b.latest_sales_receipt_amount,
         b.latest_bank_transaction_date, b.latest_reconcile_date,
         b.local_json_path, b.local_markdown_path,
         b.metrics_json || '{}', b.warnings_json || '[]', b.errors_json || '[]',
         b.duration_ms, b.generated_at, now());
  sheetSync.onActivityLogResult({ ...b, machine_id: machineId, received_at: now() });
  res.json({ ok: true });
});

// ── Timeline Result ───────────────────────────────────────────────────────────
qbAgentRouter.post('/timeline-result', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  db.prepare(`INSERT INTO timeline_results (machine_id, store_code, file_id, business_date,
    events_json, generated_at, received_at) VALUES (?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.file_id, b.business_date,
         JSON.stringify(b.events || []), b.generated_at, now());
  sheetSync.onTimelineResult({ ...b, machine_id: machineId, received_at: now() });
  res.json({ ok: true });
});

// ── Sync Result ───────────────────────────────────────────────────────────────
qbAgentRouter.post('/sync-result', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  db.prepare(`INSERT INTO sync_results (machine_id, store_code, file_id, business_date,
    status, transactions_synced, errors_json, result_json, generated_at, received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.file_id, b.business_date, b.status,
         b.transactions_synced || 0, b.errors_json || '[]',
         b.result_json || '{}', b.generated_at, now());
  res.json({ ok: true });
});

// ── Error Report ──────────────────────────────────────────────────────────────
qbAgentRouter.post('/error', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  db.prepare(`INSERT INTO error_reports (machine_id, store_code, severity, component, message,
    exception, context_json, occurred_at, received_at)
    VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(machineId, b.store_code, b.severity, b.component, b.message,
         b.exception, b.context_json || '{}', b.occurred_at, now());
  sheetSync.onError({ ...b, machine_id: machineId, received_at: now() });
  res.json({ ok: true });
});

// ── QB Files ──────────────────────────────────────────────────────────────────
qbAgentRouter.post('/qb-files', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  const files: any[] = b.files || [];
  const ts = now();
  for (const f of files) {
    db.prepare(`INSERT INTO qb_files (machine_id, file_id, store_code, company_file_path,
      expected_company_name, enabled, last_status, last_synced_at, next_sync_at, last_error,
      registered_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(machine_id, file_id) DO UPDATE SET
        store_code=excluded.store_code, company_file_path=excluded.company_file_path,
        expected_company_name=excluded.expected_company_name, enabled=excluded.enabled,
        last_status=excluded.last_status, last_synced_at=excluded.last_synced_at,
        next_sync_at=excluded.next_sync_at, last_error=excluded.last_error, updated_at=excluded.updated_at`)
      .run(machineId, f.file_id, f.store_code, f.company_file_path,
           f.expected_company_name, f.enabled ? 1 : 0,
           f.last_status, f.last_synced_at, f.next_sync_at, f.last_error, ts, ts);
  }
  res.json({ ok: true, upserted: files.length });
});

// ── Sync Cycle ────────────────────────────────────────────────────────────────
qbAgentRouter.post('/sync-cycle', (req: Request, res: Response) => {
  const b = req.body || {};
  const machineId = b.machine_id || req.headers['x-machine-id'] as string;
  const cycleId = b.cycle_id || cid();
  db.prepare(`INSERT INTO sync_cycles (cycle_id, machine_id, started_at, finished_at,
    total_files, pass_count, warning_count, error_count, next_cycle_at, received_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(cycle_id) DO UPDATE SET
      finished_at=excluded.finished_at, total_files=excluded.total_files,
      pass_count=excluded.pass_count, warning_count=excluded.warning_count,
      error_count=excluded.error_count, next_cycle_at=excluded.next_cycle_at`)
    .run(cycleId, machineId, b.started_at, b.finished_at,
         b.total_files || 0, b.pass_count || 0, b.warning_count || 0,
         b.error_count || 0, b.next_cycle_at, now());
  sheetSync.onSyncCycle({ ...b, cycle_id: cycleId, machine_id: machineId });
  res.json({ ok: true, cycle_id: cycleId });
});

// ── Machines list ─────────────────────────────────────────────────────────────
qbAgentRouter.get('/machines', (_req, res) => {
  const rows = db.prepare('SELECT * FROM machines ORDER BY last_seen_at DESC').all();
  res.json({ machines: rows });
});

// ── Status ────────────────────────────────────────────────────────────────────
qbAgentRouter.get('/status', (_req, res) => {
  const machines = db.prepare('SELECT COUNT(*) as c FROM machines').get() as any;
  const online = db.prepare("SELECT COUNT(*) as c FROM machines WHERE status='online'").get() as any;
  const pending_cmds = db.prepare("SELECT COUNT(*) as c FROM commands WHERE status='pending'").get() as any;
  const recent_errors = db.prepare(
    "SELECT * FROM error_reports ORDER BY received_at DESC LIMIT 10"
  ).all();
  res.json({
    total_machines: machines.c, online_machines: online.c,
    pending_commands: pending_cmds.c, recent_errors,
    timestamp: now(),
  });
});

// ── QB Files list ─────────────────────────────────────────────────────────────
qbAgentRouter.get('/qb-files', (req: Request, res: Response) => {
  const { machine_id } = req.query;
  const rows = machine_id
    ? db.prepare('SELECT * FROM qb_files WHERE machine_id = ? ORDER BY file_id').all(machine_id as string)
    : db.prepare('SELECT * FROM qb_files ORDER BY machine_id, file_id').all();
  res.json({ files: rows });
});

// ── Sync Cycles list ──────────────────────────────────────────────────────────
qbAgentRouter.get('/sync-cycles', (req: Request, res: Response) => {
  const { machine_id } = req.query;
  const rows = machine_id
    ? db.prepare('SELECT * FROM sync_cycles WHERE machine_id = ? ORDER BY started_at DESC LIMIT 50').all(machine_id as string)
    : db.prepare('SELECT * FROM sync_cycles ORDER BY started_at DESC LIMIT 100').all();
  res.json({ cycles: rows });
});

// ── Commands: poll ────────────────────────────────────────────────────────────
qbAgentRouter.get('/commands', (req: Request, res: Response) => {
  const { machine_id } = req.query;
  if (!machine_id) { res.status(400).json({ error: 'machine_id required' }); return; }
  const rows = db.prepare(
    "SELECT * FROM commands WHERE machine_id=? AND status='pending' ORDER BY created_at ASC LIMIT 20"
  ).all(machine_id as string);
  res.json({ commands: rows });
});

// ── Commands: create ──────────────────────────────────────────────────────────
qbAgentRouter.post('/commands', (req: Request, res: Response) => {
  const b = req.body || {};
  if (!b.machine_id || !b.command_type) {
    res.status(400).json({ error: 'machine_id and command_type required' }); return;
  }
  const commandId = cid();
  db.prepare(`INSERT INTO commands (command_id, machine_id, command_type, payload_json, status, created_at)
    VALUES (?,?,?,?,?,?)`)
    .run(commandId, b.machine_id, b.command_type,
         JSON.stringify(b.payload || {}), 'pending', now());
  res.json({ ok: true, command_id: commandId });
});

// ── Commands: ack ─────────────────────────────────────────────────────────────
qbAgentRouter.post('/commands/:command_id/ack', (req: Request, res: Response) => {
  const { command_id } = req.params;
  db.prepare("UPDATE commands SET status='acked', acked_at=? WHERE command_id=?")
    .run(now(), command_id);
  res.json({ ok: true });
});

// ── Commands: result ──────────────────────────────────────────────────────────
qbAgentRouter.post('/commands/:command_id/result', (req: Request, res: Response) => {
  const { command_id } = req.params;
  const b = req.body || {};
  db.prepare(`UPDATE commands SET status=?, result_json=?, completed_at=?, error=? WHERE command_id=?`)
    .run(b.status || 'completed', JSON.stringify(b.result || {}), now(), b.error || null, command_id);
  res.json({ ok: true });
});

// ── Recent activity (for dashboard) ──────────────────────────────────────────
qbAgentRouter.get('/recent-activity', (_req, res) => {
  const logs = db.prepare('SELECT * FROM activity_log_results ORDER BY received_at DESC LIMIT 20').all();
  const timelines = db.prepare('SELECT * FROM timeline_results ORDER BY received_at DESC LIMIT 20').all();
  const errors = db.prepare('SELECT * FROM error_reports ORDER BY received_at DESC LIMIT 20').all();
  res.json({ activity_logs: logs, timelines, errors });
});
