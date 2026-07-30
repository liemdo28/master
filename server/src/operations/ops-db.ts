/**
 * Operations DB — shared SQLite foundation for O1-O9
 * Single WAL-mode database at .local-agent-global/ops/ops.db
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const OPS_DIR = process.env.MI_DATA_DIR
  ? join(process.env.MI_DATA_DIR, 'ops')
  : join(process.cwd(), '..', '..', '.local-agent-global', 'ops');

if (!existsSync(OPS_DIR)) mkdirSync(OPS_DIR, { recursive: true });

const DB_PATH = join(OPS_DIR, 'ops.db');

let _db: InstanceType<typeof Database> | null = null;

export function getOpsDb(): InstanceType<typeof Database> {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  _db.exec(`
    -- O1: Incidents
    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT,
      source TEXT,
      resolved INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_resolved ON incidents(resolved);
    CREATE INDEX IF NOT EXISTS idx_incidents_created ON incidents(created_at);

    -- O2/O7: Workflows
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      owner TEXT,
      target TEXT,
      intent TEXT,
      entity TEXT,
      category TEXT,
      status TEXT DEFAULT 'pending_approval',
      approval_id TEXT,
      evidence TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
    CREATE INDEX IF NOT EXISTS idx_workflows_created ON workflows(created_at);
    CREATE INDEX IF NOT EXISTS idx_workflows_category ON workflows(category);

    -- O3: AI Decision Audit Trail
    CREATE TABLE IF NOT EXISTS audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      user_request TEXT NOT NULL,
      intent TEXT,
      entity TEXT,
      workflow_id TEXT,
      model TEXT,
      latency_ms INTEGER,
      approval_decision TEXT,
      execution_decision TEXT,
      sources TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_trail(session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_trail(created_at);

    -- O4: Latency Events
    CREATE TABLE IF NOT EXISTS latency_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      threshold_status TEXT NOT NULL,
      source TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_latency_category ON latency_events(category);
    CREATE INDEX IF NOT EXISTS idx_latency_created ON latency_events(created_at);

    -- O6: Conversation Quality Events
    CREATE TABLE IF NOT EXISTS quality_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT,
      event_type TEXT NOT NULL,
      score INTEGER NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quality_type ON quality_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_quality_created ON quality_events(created_at);

    -- O5: Burn-In Snapshots
    CREATE TABLE IF NOT EXISTS burnin_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uptime_seconds INTEGER,
      pm2_restarts INTEGER,
      connector_failures INTEGER,
      ai_failures INTEGER,
      workflow_failures INTEGER,
      active_incidents INTEGER,
      avg_latency_ms INTEGER,
      quality_score REAL,
      created_at TEXT NOT NULL
    );
  `);
  return _db;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function shortId(prefix = 'op'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
