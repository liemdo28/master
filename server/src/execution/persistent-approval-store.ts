/**
 * DEV5 — Phase M3: Persistent Approval Store
 * 
 * SQLite-backed approval storage that survives PM2 restarts.
 * Replaces the JSON-file approval-orchestrator for persistence-critical paths.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ── Types ──────────────────────────────────────────────────────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
export type ApprovalAction = 'approve' | 'edit' | 'cancel';

export interface PersistentApproval {
  approval_id: string;
  workflow_id: string;
  sender: string;
  action: ApprovalAction;
  risk_level: string;
  preview: string;
  status: ApprovalStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  responded_at: string | null;
  response_action: ApprovalAction | null;
  response_detail: string | null;
  response_message_id: string | null;
  summary: string;
  risk_description: string;
}

// ── Database Setup ────────────────────────────────────────────────────────

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || path.resolve(__dirname, '../../..');
const DB_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'approval-store');
const DB_PATH = path.join(DB_DIR, 'approvals.db');

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
    CREATE TABLE IF NOT EXISTS approvals (
      approval_id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      sender TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT 'approve',
      risk_level TEXT NOT NULL DEFAULT 'moderate',
      preview TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      responded_at TEXT,
      response_action TEXT,
      response_detail TEXT,
      response_message_id TEXT,
      summary TEXT NOT NULL DEFAULT '',
      risk_description TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_approvals_workflow ON approvals(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_sender ON approvals(sender);
    CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at DESC);
  `);
}

// ── CRUD Operations ───────────────────────────────────────────────────────

function genApprovalId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 5);
  return `APPR-${ts}-${rand}`;
}

export function createPersistentApproval(params: {
  workflow_id: string;
  sender: string;
  summary: string;
  risk_description: string;
  preview: string;
  action_options?: ApprovalAction[];
  risk_level?: string;
  expires_in_ms?: number;
}): PersistentApproval {
  const db = getDb();
  const now = new Date().toISOString();
  const approvalId = genApprovalId();
  const expiresAt = params.expires_in_ms
    ? new Date(Date.now() + params.expires_in_ms).toISOString()
    : null;

  const stmt = db.prepare(`
    INSERT INTO approvals (approval_id, workflow_id, sender, action, risk_level, preview, status, created_at, updated_at, expires_at, summary, risk_description)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
  `);

  stmt.run(
    approvalId,
    params.workflow_id,
    params.sender,
    params.action_options?.[0] || 'approve',
    params.risk_level || 'moderate',
    params.preview,
    now,
    now,
    expiresAt,
    params.summary,
    params.risk_description
  );

  return getPersistentApproval(approvalId)!;
}

export function getPersistentApproval(approvalId: string): PersistentApproval | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM approvals WHERE approval_id = ?').get(approvalId) as any;
  return row ? rowToApproval(row) : null;
}

export function getLatestPendingApproval(sender?: string): PersistentApproval | null {
  const db = getDb();
  let row: any;
  if (sender) {
    row = db.prepare(
      "SELECT * FROM approvals WHERE status = 'pending' AND sender = ? ORDER BY created_at DESC LIMIT 1"
    ).get(sender);
  } else {
    row = db.prepare(
      "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1"
    ).get();
  }
  return row ? rowToApproval(row) : null;
}

export function getPendingApprovalsPersistent(): PersistentApproval[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC").all() as any[];
  return rows.map(rowToApproval);
}

export function getAllApprovalsPersistent(limit?: number): PersistentApproval[] {
  const db = getDb();
  const limitClause = limit ? `LIMIT ${limit}` : '';
  const rows = db.prepare(`SELECT * FROM approvals ORDER BY created_at DESC ${limitClause}`).all() as any[];
  return rows.map(rowToApproval);
}

export function findPendingByWorkflowPersistent(workflowId: string): PersistentApproval | null {
  const db = getDb();
  const row = db.prepare(
    "SELECT * FROM approvals WHERE workflow_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"
  ).get(workflowId) as any;
  return row ? rowToApproval(row) : null;
}

export function resolvePersistentApproval(
  approvalId: string,
  action: ApprovalAction,
  detail?: string,
  messageId?: string
): PersistentApproval | null {
  const db = getDb();
  const now = new Date().toISOString();

  const existing = getPersistentApproval(approvalId);
  if (!existing || existing.status !== 'pending') return null;

  const statusMap: Record<ApprovalAction, ApprovalStatus> = {
    approve: 'approved',
    edit: 'rejected',
    cancel: 'cancelled',
  };

  const stmt = db.prepare(`
    UPDATE approvals
    SET status = ?, responded_at = ?, response_action = ?, response_detail = ?, response_message_id = ?, updated_at = ?
    WHERE approval_id = ? AND status = 'pending'
  `);

  const result = stmt.run(
    statusMap[action],
    now,
    action,
    detail || null,
    messageId || null,
    now,
    approvalId
  );

  if (result.changes === 0) return null;
  return getPersistentApproval(approvalId);
}

export function approveLatestPending(sender: string, detail?: string, messageId?: string): PersistentApproval | null {
  const latest = getLatestPendingApproval(sender);
  if (!latest) return null;
  return resolvePersistentApproval(latest.approval_id, 'approve', detail, messageId);
}

// ── Expiry Management ─────────────────────────────────────────────────────

export function expireOldApprovals(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
  const result = db.prepare(
    "UPDATE approvals SET status = 'expired', updated_at = ? WHERE status = 'pending' AND created_at < ?"
  ).run(new Date().toISOString(), cutoff);
  return result.changes;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function rowToApproval(row: any): PersistentApproval {
  return {
    approval_id: row.approval_id,
    workflow_id: row.workflow_id,
    sender: row.sender || '',
    action: row.action || 'approve',
    risk_level: row.risk_level || 'moderate',
    preview: row.preview || '',
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_at: row.expires_at,
    responded_at: row.responded_at,
    response_action: row.response_action,
    response_detail: row.response_detail,
    response_message_id: row.response_message_id,
    summary: row.summary || '',
    risk_description: row.risk_description || '',
  };
}

export function getApprovalCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM approvals').get() as any;
  return row?.cnt || 0;
}

export function getApprovalCountByStatus(status: ApprovalStatus): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as cnt FROM approvals WHERE status = ?').get(status) as any;
  return row?.cnt || 0;
}
