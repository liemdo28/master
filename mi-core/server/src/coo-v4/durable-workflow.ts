/**
 * Domain B — Durable Workflow Engine
 * SQLite-backed. Survives crashes. Supports pause/resume/approval-wait.
 *
 * Schema:
 *   workflows      — one row per workflow
 *   workflow_steps — one row per step
 *   workflow_signals — CEO approvals, cancels, resumes
 */

import fs   from 'fs';
import path from 'path';
import type { WorkflowState, WorkflowStatus, PlanStep, WorkflowSignal } from './types';

const GLOBAL_DIR = process.env.MI_CORE_ROOT
  ? path.join(process.env.MI_CORE_ROOT, '.local-agent-global')
  : 'D:/Project/Master/.local-agent-global';
const DB_DIR  = path.join(GLOBAL_DIR, 'coo-v4');
const DB_PATH = path.join(DB_DIR, 'workflows.db');

// ── DB init ────────────────────────────────────────────────────────────────

let _db: ReturnType<typeof import('better-sqlite3')> | null = null;

function db() {
  if (_db) return _db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const Database = require('better-sqlite3');
  _db = new Database(DB_PATH, { verbose: undefined });
  (_db as any).pragma('journal_mode = WAL');
  (_db as any).exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      input        TEXT NOT NULL DEFAULT '{}',
      state        TEXT NOT NULL DEFAULT '{}',
      checkpoint   INTEGER NOT NULL DEFAULT -1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id  TEXT NOT NULL,
      step_index   INTEGER NOT NULL,
      step_id      TEXT NOT NULL,
      step_name    TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      input        TEXT NOT NULL DEFAULT '{}',
      output       TEXT,
      error        TEXT,
      started_at   TEXT,
      completed_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE TABLE IF NOT EXISTS workflow_signals (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      workflow_id  TEXT NOT NULL,
      signal_type  TEXT NOT NULL,
      payload      TEXT NOT NULL DEFAULT '{}',
      received_at  TEXT NOT NULL,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id)
    );

    CREATE INDEX IF NOT EXISTS idx_workflow_steps_wid ON workflow_steps(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflow_signals_wid ON workflow_signals(workflow_id);
    CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
  `);
  return _db as any;
}

// ── CRUD ───────────────────────────────────────────────────────────────────

export function createWorkflow(name: string, input: Record<string, unknown>, plan: PlanStep[]): string {
  const id  = `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const state: WorkflowState = {
    workflow_id: id, intent: input.intent as string || name, goal: input.goal as string || '',
    plan, current_step: 0, context: {}, outputs: {}, status: 'pending', errors: [],
    created_at: now, updated_at: now,
  };
  db().prepare(`
    INSERT INTO workflows (id, name, status, input, state, checkpoint, created_at, updated_at)
    VALUES (?, ?, 'pending', ?, ?, -1, ?, ?)
  `).run(id, name, JSON.stringify(input), JSON.stringify(state), now, now);

  // Pre-insert step rows
  for (let i = 0; i < plan.length; i++) {
    db().prepare(`
      INSERT INTO workflow_steps (workflow_id, step_index, step_id, step_name, status, input)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(id, i, plan[i].id, plan[i].name, JSON.stringify(plan[i].input || {}));
  }

  return id;
}

export function getWorkflow(id: string): WorkflowState | null {
  const row = db().prepare('SELECT state FROM workflows WHERE id = ?').get(id) as any;
  if (!row) return null;
  return JSON.parse(row.state);
}

export function updateWorkflowState(id: string, patch: Partial<WorkflowState>): void {
  const current = getWorkflow(id);
  if (!current) throw new Error(`Workflow ${id} not found`);
  const updated = { ...current, ...patch, updated_at: new Date().toISOString() };
  db().prepare('UPDATE workflows SET state = ?, status = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(updated), updated.status, updated.updated_at, id);
}

export function checkpointStep(workflowId: string, stepIndex: number, status: string, output: unknown, error?: string): void {
  const now = new Date().toISOString();
  db().prepare(`
    UPDATE workflow_steps SET status = ?, output = ?, error = ?, completed_at = ? WHERE workflow_id = ? AND step_index = ?
  `).run(status, output ? JSON.stringify(output) : null, error || null, now, workflowId, stepIndex);
  db().prepare('UPDATE workflows SET checkpoint = ?, updated_at = ? WHERE id = ?')
    .run(stepIndex, now, workflowId);
}

export function startStep(workflowId: string, stepIndex: number): void {
  db().prepare('UPDATE workflow_steps SET status = ?, started_at = ? WHERE workflow_id = ? AND step_index = ?')
    .run('running', new Date().toISOString(), workflowId, stepIndex);
}

export function setWorkflowStatus(id: string, status: WorkflowStatus): void {
  const now = new Date().toISOString();
  const completed_at = (status === 'completed' || status === 'failed') ? now : null;
  db().prepare('UPDATE workflows SET status = ?, updated_at = ?, completed_at = ? WHERE id = ?')
    .run(status, now, completed_at, id);
  const state = getWorkflow(id);
  if (state) updateWorkflowState(id, { status });
}

// ── Signals (CEO approval/cancel/resume) ──────────────────────────────────

export function sendSignal(workflowId: string, type: WorkflowSignal['type'], payload: unknown = {}): void {
  db().prepare('INSERT INTO workflow_signals (workflow_id, signal_type, payload, received_at) VALUES (?, ?, ?, ?)')
    .run(workflowId, type, JSON.stringify(payload), new Date().toISOString());
}

export function getSignals(workflowId: string): WorkflowSignal[] {
  const rows = db().prepare('SELECT signal_type, payload, received_at FROM workflow_signals WHERE workflow_id = ? ORDER BY id').all(workflowId) as any[];
  return rows.map(r => ({ type: r.signal_type as WorkflowSignal['type'], payload: JSON.parse(r.payload), received_at: r.received_at }));
}

export function waitForSignal(workflowId: string, type: WorkflowSignal['type']): WorkflowSignal | null {
  const row = db().prepare('SELECT signal_type, payload, received_at FROM workflow_signals WHERE workflow_id = ? AND signal_type = ? ORDER BY id DESC LIMIT 1').get(workflowId, type) as any;
  if (!row) return null;
  return { type: row.signal_type, payload: JSON.parse(row.payload), received_at: row.received_at };
}

// ── Crash recovery ─────────────────────────────────────────────────────────

export function recoverInterrupted(): string[] {
  const rows = db().prepare("SELECT id FROM workflows WHERE status IN ('running', 'planning')").all() as any[];
  const recovered: string[] = [];
  for (const row of rows) {
    db().prepare("UPDATE workflows SET status = 'paused', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), row.id);
    recovered.push(row.id);
  }
  return recovered;
}

// ── Query ──────────────────────────────────────────────────────────────────

export function listWorkflows(status?: WorkflowStatus, limit = 20): Array<{
  id: string; name: string; status: string; checkpoint: number; created_at: string; updated_at: string;
}> {
  const q = status
    ? db().prepare('SELECT id, name, status, checkpoint, created_at, updated_at FROM workflows WHERE status = ? ORDER BY created_at DESC LIMIT ?').all(status, limit)
    : db().prepare('SELECT id, name, status, checkpoint, created_at, updated_at FROM workflows ORDER BY created_at DESC LIMIT ?').all(limit);
  return q as any[];
}

export function getWorkflowSteps(workflowId: string) {
  return db().prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_index').all(workflowId);
}

export function getWorkflowSummary(id: string) {
  const wf = db().prepare('SELECT id, name, status, checkpoint, created_at, completed_at FROM workflows WHERE id = ?').get(id) as any;
  if (!wf) return null;
  const steps = getWorkflowSteps(id);
  const total = steps.length;
  const done  = (steps as any[]).filter(s => s.status === 'completed').length;
  const failed= (steps as any[]).filter(s => s.status === 'failed').length;
  return { ...wf, steps_total: total, steps_done: done, steps_failed: failed };
}

export function deleteWorkflow(id: string): void {
  db().prepare('DELETE FROM workflow_signals WHERE workflow_id = ?').run(id);
  db().prepare('DELETE FROM workflow_steps WHERE workflow_id = ?').run(id);
  db().prepare('DELETE FROM workflows WHERE id = ?').run(id);
}
