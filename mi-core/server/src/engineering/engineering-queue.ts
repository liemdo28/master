/**
 * Phase 34D — Engineering Queue
 * SQLite-backed task queue for the Engineering Division.
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ModelId } from './model-registry';
import { TaskClassification } from './task-classifier';
import { RoutingDecision } from './routing-engine';

export type TaskStatus =
  | 'PENDING'
  | 'DISPATCHED'
  | 'EXECUTING'
  | 'REVIEW'
  | 'TESTING'
  | 'PR_READY'
  | 'APPROVAL_REQUIRED'
  | 'DONE'
  | 'FAILED';

export interface EngineeringTask {
  id: string;
  objective: string;
  project: string;
  selected_model: ModelId;
  status: TaskStatus;
  classification: string;   // JSON of TaskClassification
  routing: string;   // JSON of RoutingDecision
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  evidence: string | null;  // JSON evidence paths
  review_score: number | null;
  pr_branch: string | null;
  error: string | null;
}

// ── DB Init ───────────────────────────────────────────────────────────────────

const GLOBAL_DIR = process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global';
const ENG_DIR    = path.join(GLOBAL_DIR, 'engineering');
if (!fs.existsSync(ENG_DIR)) fs.mkdirSync(ENG_DIR, { recursive: true });

const DB_PATH = path.join(ENG_DIR, 'engineering-tasks.db');

let db: Database.Database;
try {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS engineering_tasks (
      id             TEXT PRIMARY KEY,
      objective      TEXT NOT NULL,
      project        TEXT NOT NULL DEFAULT 'mi-core',
      selected_model TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'PENDING',
      classification TEXT,
      routing        TEXT,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      started_at     TEXT,
      finished_at    TEXT,
      evidence       TEXT,
      review_score   INTEGER,
      pr_branch      TEXT,
      error          TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_status ON engineering_tasks(status);
    CREATE INDEX IF NOT EXISTS idx_model  ON engineering_tasks(selected_model);
  `);
} catch (e: any) {
  console.error('[Engineering] DB init error:', e.message);
  throw e;
}

// ── ID generator ──────────────────────────────────────────────────────────────

function genId(): string {
  const ts   = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ENG-${ts}-${rand}`;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export function createTask(
  objective: string,
  project: string,
  classification: TaskClassification,
  routing: RoutingDecision,
): EngineeringTask {
  const id   = genId();
  const now  = new Date().toISOString();
  const task: EngineeringTask = {
    id,
    objective,
    project,
    selected_model: routing.selected_model,
    status:         routing.escalate_human ? 'APPROVAL_REQUIRED' : 'PENDING',
    classification: JSON.stringify(classification),
    routing:        JSON.stringify(routing),
    created_at:     now,
    started_at:     null,
    finished_at:    null,
    evidence:       null,
    review_score:   null,
    pr_branch:      null,
    error:          null,
  };

  db.prepare(`
    INSERT INTO engineering_tasks
      (id, objective, project, selected_model, status, classification, routing, created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(task.id, task.objective, task.project, task.selected_model,
         task.status, task.classification, task.routing, task.created_at);

  return task;
}

export function updateStatus(
  id: string,
  status: TaskStatus,
  extra?: Partial<Pick<EngineeringTask, 'started_at' | 'finished_at' | 'evidence' | 'review_score' | 'pr_branch' | 'error'>>,
): void {
  const sets: string[] = ['status = ?'];
  const vals: any[]    = [status];

  if (status === 'EXECUTING' && !extra?.started_at) {
    sets.push('started_at = ?'); vals.push(new Date().toISOString());
  }
  if (['DONE', 'FAILED', 'PR_READY'].includes(status) && !extra?.finished_at) {
    sets.push('finished_at = ?'); vals.push(new Date().toISOString());
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined) { sets.push(`${k} = ?`); vals.push(v); }
    }
  }
  vals.push(id);

  db.prepare(`UPDATE engineering_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...vals);
}

export function getTask(id: string): EngineeringTask | undefined {
  return db.prepare('SELECT * FROM engineering_tasks WHERE id = ?').get(id) as EngineeringTask | undefined;
}

export function listTasks(filter?: { status?: TaskStatus; model?: ModelId; limit?: number }): EngineeringTask[] {
  const where: string[] = [];
  const vals: any[]     = [];

  if (filter?.status) { where.push('status = ?');         vals.push(filter.status); }
  if (filter?.model)  { where.push('selected_model = ?'); vals.push(filter.model); }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit  = filter?.limit ?? 50;

  return db.prepare(`SELECT * FROM engineering_tasks ${clause} ORDER BY created_at DESC LIMIT ?`)
    .all(...vals, limit) as EngineeringTask[];
}

export function getQueueStats(): Record<TaskStatus | 'total', number> {
  const rows = db.prepare(`
    SELECT status, COUNT(*) as cnt FROM engineering_tasks GROUP BY status
  `).all() as { status: TaskStatus; cnt: number }[];

  const stats: any = { total: 0 };
  for (const row of rows) {
    stats[row.status] = row.cnt;
    stats.total += row.cnt;
  }
  return stats;
}
