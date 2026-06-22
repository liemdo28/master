/**
 * Mi Approval Gate — Level 1/2/3 action queue.
 * Level 1: auto-allowed (read, scan, report)
 * Level 2: requires single approval (write, create, assign)
 * Level 3: requires double approval (delete, deploy, push, financial)
 *
 * Persistence: SQLite via ops.db — survives PM2 restart and system reboot.
 */

import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';
import { getOpsDb } from '../operations/ops-db';

export type RiskLevel = 1 | 2 | 3;
export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'rolled_back';

export interface ApprovalAction {
  id: string;
  created_at: string;
  risk_level: RiskLevel;
  category: string;
  description: string;
  target: string;
  before_state?: string;
  after_state?: string;
  rollback_plan?: string;
  status: ActionStatus;
  confirmations: number;   // for level 3: need 2
  resolved_at?: string;
  resolved_by?: string;
  result?: string;
}

export const gateEvents = new EventEmitter();

// ── Schema bootstrap ──────────────────────────────────────────────────────────

function ensureSchema(): void {
  const db = getOpsDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_queue (
      id            TEXT PRIMARY KEY,
      created_at    TEXT NOT NULL,
      risk_level    INTEGER NOT NULL,
      category      TEXT NOT NULL,
      description   TEXT NOT NULL,
      target        TEXT NOT NULL,
      before_state  TEXT,
      after_state   TEXT,
      rollback_plan TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',
      confirmations INTEGER NOT NULL DEFAULT 0,
      resolved_at   TEXT,
      resolved_by   TEXT,
      result        TEXT
    );
  `);
}

// Initialize schema on module load
try { ensureSchema(); } catch { /* ops-db not yet ready — will retry on first use */ }

// ── Serialization helpers ─────────────────────────────────────────────────────

function rowToAction(row: Record<string, unknown>): ApprovalAction {
  return {
    id:            row.id as string,
    created_at:    row.created_at as string,
    risk_level:    (row.risk_level as number) as RiskLevel,
    category:      row.category as string,
    description:   row.description as string,
    target:        row.target as string,
    before_state:  row.before_state as string | undefined,
    after_state:   row.after_state as string | undefined,
    rollback_plan: row.rollback_plan as string | undefined,
    status:        row.status as ActionStatus,
    confirmations: row.confirmations as number,
    resolved_at:   row.resolved_at as string | undefined,
    resolved_by:   row.resolved_by as string | undefined,
    result:        row.result as string | undefined,
  };
}

// ── Level 1 categories — auto-allowed, no queue needed ───────────────────────

const LEVEL1_CATEGORIES = new Set([
  'read_file', 'search_file', 'scan_project', 'map_source',
  'query_knowledge', 'pull_dashboard', 'pull_website',
  'generate_report', 'generate_draft', 'generate_patch_proposal', 'run_qa',
  'list_processes', 'check_port', 'read_log',
]);

export function isAutoAllowed(category: string): boolean {
  return LEVEL1_CATEGORIES.has(category);
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function enqueue(params: {
  risk_level: RiskLevel;
  category: string;
  description: string;
  target: string;
  before_state?: string;
  after_state?: string;
  rollback_plan?: string;
}): ApprovalAction {
  ensureSchema();
  const action: ApprovalAction = {
    id: uuid(),
    created_at: new Date().toISOString(),
    status: 'pending',
    confirmations: 0,
    ...params,
  };

  const db = getOpsDb();
  db.prepare(`
    INSERT INTO approval_queue
      (id, created_at, risk_level, category, description, target,
       before_state, after_state, rollback_plan, status, confirmations)
    VALUES
      (@id, @created_at, @risk_level, @category, @description, @target,
       @before_state, @after_state, @rollback_plan, @status, @confirmations)
  `).run(action);

  gateEvents.emit('new_action', action);
  return action;
}

export function approve(id: string, approver = 'owner'): ApprovalAction | null {
  ensureSchema();
  const db = getOpsDb();
  const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row || row.status !== 'pending') return null;

  const action = rowToAction(row);
  action.confirmations += 1;

  if (action.risk_level === 3 && action.confirmations < 2) {
    db.prepare('UPDATE approval_queue SET confirmations = ? WHERE id = ?').run(action.confirmations, id);
    gateEvents.emit('partial_approval', action);
    return action;
  }

  action.status = 'approved';
  action.resolved_at = new Date().toISOString();
  action.resolved_by = approver;

  db.prepare(`
    UPDATE approval_queue
    SET status = 'approved', confirmations = ?, resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(action.confirmations, action.resolved_at, approver, id);

  gateEvents.emit('approved', action);
  return action;
}

export function reject(id: string, approver = 'owner'): ApprovalAction | null {
  ensureSchema();
  const db = getOpsDb();
  const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row || row.status !== 'pending') return null;

  const resolved_at = new Date().toISOString();
  db.prepare(`
    UPDATE approval_queue
    SET status = 'rejected', resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(resolved_at, approver, id);

  const action = rowToAction({ ...row, status: 'rejected', resolved_at, resolved_by: approver });
  gateEvents.emit('rejected', action);
  return action;
}

export function markExecuted(id: string, result?: string): void {
  ensureSchema();
  const db = getOpsDb();
  db.prepare(`UPDATE approval_queue SET status = 'executed', result = ? WHERE id = ?`).run(result ?? null, id);
}

export function getPending(): ApprovalAction[] {
  ensureSchema();
  const db = getOpsDb();
  return (db.prepare("SELECT * FROM approval_queue WHERE status = 'pending' ORDER BY created_at ASC").all() as Record<string, unknown>[])
    .map(rowToAction);
}

export function getAll(): ApprovalAction[] {
  ensureSchema();
  const db = getOpsDb();
  return (db.prepare('SELECT * FROM approval_queue ORDER BY created_at DESC').all() as Record<string, unknown>[])
    .map(rowToAction);
}

export function getById(id: string): ApprovalAction | undefined {
  ensureSchema();
  const db = getOpsDb();
  const row = db.prepare('SELECT * FROM approval_queue WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToAction(row) : undefined;
}
