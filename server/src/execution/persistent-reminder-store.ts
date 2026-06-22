/**
 * DEV5 — Phase M5: Persistent Reminder Store
 * 
 * SQLite-backed reminder storage that survives PM2 restarts.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export type ReminderStatus = 'scheduled' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface PersistentReminder {
  reminder_id: string;
  workflow_id: string | null;
  approval_id: string | null;
  sender: string;
  message: string;
  remind_at: string;
  status: ReminderStatus;
  retries: number;
  max_retries: number;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Database ───────────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || path.resolve(__dirname, '../../..');
const DB_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'reminder-store');
const DB_PATH = path.join(DB_DIR, 'reminders.db');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('synchronous = NORMAL');
  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      reminder_id TEXT PRIMARY KEY,
      workflow_id TEXT,
      approval_id TEXT,
      sender TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      remind_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      retries INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      last_sent_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
    CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);
    CREATE INDEX IF NOT EXISTS idx_reminders_sender ON reminders(sender);
  `);
}

// ── CRUD ───────────────────────────────────────────────────────────────────

function genReminderId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 5);
  return `RMD-${ts}-${rand}`;
}

export function createPersistentReminder(params: {
  workflow_id?: string;
  approval_id?: string;
  sender: string;
  message: string;
  remind_at: string;
  max_retries?: number;
}): PersistentReminder {
  const db = getDb();
  const now = new Date().toISOString();
  const id = genReminderId();

  db.prepare(`
    INSERT INTO reminders (reminder_id, workflow_id, approval_id, sender, message, remind_at, status, retries, max_retries, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 0, ?, ?, ?)
  `).run(id, params.workflow_id || null, params.approval_id || null, params.sender, params.message, params.remind_at, params.max_retries || 3, now, now);

  return getPersistentReminder(id)!;
}

export function getPersistentReminder(id: string): PersistentReminder | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM reminders WHERE reminder_id = ?').get(id) as any;
  return row ? rowToReminder(row) : null;
}

export function getDueReminders(): PersistentReminder[] {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db.prepare(
    "SELECT * FROM reminders WHERE status = 'scheduled' AND remind_at <= ? ORDER BY remind_at ASC"
  ).all(now) as any[];
  return rows.map(rowToReminder);
}

export function getPendingReminders(): PersistentReminder[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT * FROM reminders WHERE status = 'scheduled' ORDER BY remind_at ASC"
  ).all() as any[];
  return rows.map(rowToReminder);
}

export function markReminderSent(id: string): PersistentReminder | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE reminders SET status = 'sent', last_sent_at = ?, retries = retries + 1, updated_at = ? WHERE reminder_id = ?"
  ).run(now, now, id);
  return getPersistentReminder(id);
}

export function markReminderDelivered(id: string): PersistentReminder | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE reminders SET status = 'delivered', updated_at = ? WHERE reminder_id = ?"
  ).run(now, id);
  return getPersistentReminder(id);
}

export function markReminderFailed(id: string): PersistentReminder | null {
  const db = getDb();
  const now = new Date().toISOString();
  const reminder = getPersistentReminder(id);
  if (!reminder) return null;
  
  if (reminder.retries >= reminder.max_retries) {
    db.prepare("UPDATE reminders SET status = 'failed', updated_at = ? WHERE reminder_id = ?").run(now, id);
  } else {
    db.prepare("UPDATE reminders SET status = 'scheduled', retries = retries + 1, updated_at = ? WHERE reminder_id = ?").run(now, id);
  }
  return getPersistentReminder(id);
}

export function cancelReminder(id: string): PersistentReminder | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE reminder_id = ?").run(now, id);
  return getPersistentReminder(id);
}

export function cancelRemindersByWorkflow(workflowId: string): number {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(
    "UPDATE reminders SET status = 'cancelled', updated_at = ? WHERE workflow_id = ? AND status = 'scheduled'"
  ).run(now, workflowId);
  return result.changes;
}

export function getReminderCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM reminders').get() as any;
  return row?.cnt || 0;
}

export function getReminderCountByStatus(status: ReminderStatus): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM reminders WHERE status = ?').get(status) as any;
  return row?.cnt || 0;
}

function rowToReminder(row: any): PersistentReminder {
  return {
    reminder_id: row.reminder_id,
    workflow_id: row.workflow_id,
    approval_id: row.approval_id,
    sender: row.sender,
    message: row.message,
    remind_at: row.remind_at,
    status: row.status,
    retries: row.retries,
    max_retries: row.max_retries,
    last_sent_at: row.last_sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
