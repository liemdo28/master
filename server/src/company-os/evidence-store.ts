/**
 * Mi Company OS — Evidence Store
 * Every execution step stores evidence in SQLite.
 * QA reads from here. Nothing passes without evidence.
 */

import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(
  process.env.DATA_ROOT || 'E:/Project/Master/.local-agent-global',
  'company-os', 'evidence.db'
);

let _db: Database.Database | null = null;

function db(): Database.Database {
  if (!_db) {
    const { mkdirSync } = require('fs');
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new (require('better-sqlite3'))(DB_PATH, { timeout: 5000 });
    _db!.pragma('journal_mode = WAL');
    bootstrap(_db!);
  }
  return _db!;
}

function bootstrap(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS executions (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      dept_id      TEXT NOT NULL,
      pipeline_id  TEXT NOT NULL,
      step         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'pending',
      input        TEXT,
      output       TEXT,
      confidence   REAL DEFAULT 0,
      qa_verdict   TEXT,
      qa_notes     TEXT,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_exec_pipeline ON executions(pipeline_id);
    CREATE INDEX IF NOT EXISTS idx_exec_dept ON executions(dept_id);

    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id           TEXT PRIMARY KEY,
      created_at   TEXT NOT NULL,
      ceo_command  TEXT NOT NULL,
      intent       TEXT,
      depts        TEXT,
      status       TEXT NOT NULL DEFAULT 'running',
      confidence   REAL DEFAULT 0,
      ceo_response TEXT,
      completed_at TEXT
    );
  `);
}

export interface ExecutionEvidence {
  id: string;
  created_at: string;
  dept_id: string;
  pipeline_id: string;
  step: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  input?: string;
  output?: string;
  confidence: number;
  qa_verdict?: 'PASS' | 'FAIL';
  qa_notes?: string;
  completed_at?: string;
}

export interface PipelineRun {
  id: string;
  created_at: string;
  ceo_command: string;
  intent?: string;
  depts?: string;
  status: 'running' | 'done' | 'failed' | 'pending_approval';
  confidence: number;
  ceo_response?: string;
  completed_at?: string;
}

const { v4: uuid } = require('uuid');

// ── Pipeline runs ─────────────────────────────────────────────────────────────

export function createPipelineRun(cmd: string): PipelineRun {
  const run: PipelineRun = {
    id: uuid(),
    created_at: new Date().toISOString(),
    ceo_command: cmd,
    status: 'running',
    confidence: 0,
  };
  db().prepare(`
    INSERT INTO pipeline_runs(id,created_at,ceo_command,status,confidence)
    VALUES(?,?,?,?,?)
  `).run(run.id, run.created_at, run.ceo_command, run.status, run.confidence);
  return run;
}

export function updatePipelineRun(id: string, patch: Partial<PipelineRun>): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [k, v] of Object.entries(patch)) {
    sets.push(`${k}=?`);
    vals.push(typeof v === 'object' ? JSON.stringify(v) : v);
  }
  if (!sets.length) return;
  vals.push(id);
  db().prepare(`UPDATE pipeline_runs SET ${sets.join(',')} WHERE id=?`).run(...vals);
}

export function getPipelineRun(id: string): PipelineRun | null {
  return (db().prepare('SELECT * FROM pipeline_runs WHERE id=?').get(id) as PipelineRun) || null;
}

export function recentPipelineRuns(limit = 20): PipelineRun[] {
  return db().prepare('SELECT * FROM pipeline_runs ORDER BY created_at DESC LIMIT ?').all(limit) as PipelineRun[];
}

// ── Step evidence ─────────────────────────────────────────────────────────────

export function recordStep(
  pipelineId: string,
  deptId: string,
  step: string,
  input?: unknown
): ExecutionEvidence {
  const ev: ExecutionEvidence = {
    id: uuid(),
    created_at: new Date().toISOString(),
    dept_id: deptId,
    pipeline_id: pipelineId,
    step,
    status: 'running',
    confidence: 0,
    input: input ? JSON.stringify(input) : undefined,
  };
  db().prepare(`
    INSERT INTO executions(id,created_at,dept_id,pipeline_id,step,status,input,confidence)
    VALUES(?,?,?,?,?,?,?,?)
  `).run(ev.id, ev.created_at, ev.dept_id, ev.pipeline_id, ev.step, ev.status, ev.input ?? null, ev.confidence);
  return ev;
}

export function completeStep(
  id: string,
  output: unknown,
  confidence: number,
  status: 'done' | 'failed' = 'done'
): void {
  db().prepare(`
    UPDATE executions SET output=?,confidence=?,status=?,completed_at=? WHERE id=?
  `).run(JSON.stringify(output), confidence, status, new Date().toISOString(), id);
}

export function setQaVerdict(id: string, verdict: 'PASS' | 'FAIL', notes: string): void {
  db().prepare(`
    UPDATE executions SET qa_verdict=?,qa_notes=? WHERE id=?
  `).run(verdict, notes, id);
}

export function getStepsForPipeline(pipelineId: string): ExecutionEvidence[] {
  return db().prepare('SELECT * FROM executions WHERE pipeline_id=? ORDER BY created_at ASC')
    .all(pipelineId) as ExecutionEvidence[];
}

export function hasEvidence(pipelineId: string): boolean {
  const row = db().prepare('SELECT COUNT(*) as c FROM executions WHERE pipeline_id=? AND status=?')
    .get(pipelineId, 'done') as { c: number };
  return row.c > 0;
}
