/**
 * DEV5 — Workflow Execution Ledger
 * 
 * Authoritative source of truth for every workflow execution.
 * Records: workflow_id, parent_id, child_id, start_time, finish_time, status, failure_reason.
 * 
 * Append-only. Immutable. Every workflow lifecycle event is recorded.
 * This is the ONLY source for workflow success metrics.
 */

import { getOpsDb, nowIso } from '../operations/ops-db';
import fs from 'fs';
import path from 'path';

// ── Schema migration ────────────────────────────────────────────────────────

const LEDGER_TABLE = `
  CREATE TABLE IF NOT EXISTS workflow_execution_ledger (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id     TEXT NOT NULL,
    parent_id       TEXT,
    child_id        TEXT,
    status          TEXT NOT NULL DEFAULT 'created',
    start_time      TEXT,
    finish_time     TEXT,
    duration_ms     INTEGER,
    failure_reason  TEXT,
    domain          TEXT,
    category        TEXT,
    target_entity   TEXT,
    owner           TEXT,
    source_message  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_wel_workflow ON workflow_execution_ledger(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_wel_parent   ON workflow_execution_ledger(parent_id);
  CREATE INDEX IF NOT EXISTS idx_wel_child    ON workflow_execution_ledger(child_id);
  CREATE INDEX IF NOT EXISTS idx_wel_status   ON workflow_execution_ledger(status);
  CREATE INDEX IF NOT EXISTS idx_wel_created  ON workflow_execution_ledger(created_at);
`;

// ── Ledger entry type ───────────────────────────────────────────────────────

export type LedgerStatus =
  | 'created'
  | 'started'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  | 'approval_pending'
  | 'approved'
  | 'rejected';

export interface LedgerEntry {
  id: number;
  workflow_id: string;
  parent_id: string | null;
  child_id: string | null;
  status: LedgerStatus;
  start_time: string | null;
  finish_time: string | null;
  duration_ms: number | null;
  failure_reason: string | null;
  domain: string | null;
  category: string | null;
  target_entity: string | null;
  owner: string | null;
  source_message: string | null;
  created_at: string;
  updated_at: string;
}

// ── Initialize schema ───────────────────────────────────────────────────────

let _initialized = false;

function ensureSchema() {
  if (_initialized) return;
  try {
    getOpsDb().exec(LEDGER_TABLE);
    _initialized = true;
  } catch { /* non-critical */ }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Record a new workflow execution in the ledger.
 */
export function recordWorkflowStart(params: {
  workflow_id: string;
  parent_id?: string;
  child_id?: string;
  domain?: string;
  category?: string;
  target_entity?: string;
  owner?: string;
  source_message?: string;
}): LedgerEntry {
  ensureSchema();
  const db = getOpsDb();
  const now = nowIso();
  
  const r = db.prepare(`
    INSERT INTO workflow_execution_ledger
      (workflow_id, parent_id, child_id, status, start_time, domain, category,
       target_entity, owner, source_message, created_at, updated_at)
    VALUES (?, ?, ?, 'started', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.workflow_id,
    params.parent_id ?? null,
    params.child_id ?? null,
    now,
    params.domain ?? null,
    params.category ?? null,
    params.target_entity ?? null,
    params.owner ?? null,
    params.source_message ?? null,
    now,
    now,
  );

  return getLedgerEntry(r.lastInsertRowid as number)!;
}

/**
 * Update workflow status in the ledger.
 */
export function recordWorkflowStatus(
  workflow_id: string,
  status: LedgerStatus,
  failure_reason?: string,
): LedgerEntry | null {
  ensureSchema();
  const db = getOpsDb();
  const now = nowIso();

  // Find latest entry for this workflow
  const existing = db.prepare(
    `SELECT * FROM workflow_execution_ledger WHERE workflow_id = ? ORDER BY id DESC LIMIT 1`
  ).get(workflow_id) as LedgerEntry | undefined;

  if (!existing) return null;

  const isTerminal = ['completed', 'failed', 'cancelled', 'timeout', 'rejected'].includes(status);
  const duration_ms = isTerminal && existing.start_time
    ? new Date(now).getTime() - new Date(existing.start_time).getTime()
    : null;

  db.prepare(`
    UPDATE workflow_execution_ledger
    SET status = ?, finish_time = ?, duration_ms = ?, failure_reason = ?, updated_at = ?
    WHERE id = ?
  `).run(
    status,
    isTerminal ? now : existing.finish_time,
    duration_ms,
    failure_reason ?? existing.failure_reason,
    now,
    existing.id,
  );

  return getLedgerEntry(existing.id);
}

/**
 * Link parent-child workflows.
 */
export function linkWorkflowChild(parent_id: string, child_id: string): void {
  ensureSchema();
  const db = getOpsDb();
  db.prepare(`
    UPDATE workflow_execution_ledger SET child_id = ?, updated_at = ?
    WHERE workflow_id = (SELECT workflow_id FROM workflow_execution_ledger WHERE id = ?)
  `).run(child_id, nowIso(), parent_id);
  db.prepare(`
    UPDATE workflow_execution_ledger SET parent_id = ?, updated_at = ?
    WHERE workflow_id = (SELECT workflow_id FROM workflow_execution_ledger WHERE id = ?)
  `).run(parent_id, nowIso(), child_id);
}

/**
 * Get a single ledger entry.
 */
export function getLedgerEntry(id: number): LedgerEntry | null {
  ensureSchema();
  return (getOpsDb().prepare(
    `SELECT * FROM workflow_execution_ledger WHERE id = ?`
  ).get(id) as LedgerEntry) ?? null;
}

/**
 * Get all entries for a specific workflow.
 */
export function getLedgerByWorkflow(workflow_id: string): LedgerEntry[] {
  ensureSchema();
  return getOpsDb().prepare(
    `SELECT * FROM workflow_execution_ledger WHERE workflow_id = ? ORDER BY created_at`
  ).all(workflow_id) as LedgerEntry[];
}

/**
 * Get recent ledger entries.
 */
export function getRecentEntries(limit = 100): LedgerEntry[] {
  ensureSchema();
  return getOpsDb().prepare(
    `SELECT * FROM workflow_execution_ledger ORDER BY created_at DESC LIMIT ?`
  ).all(limit) as LedgerEntry[];
}

/**
 * Get entries from the last N hours.
 */
export function getEntriesSince(hours = 24): LedgerEntry[] {
  ensureSchema();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getOpsDb().prepare(
    `SELECT * FROM workflow_execution_ledger WHERE created_at >= ? ORDER BY created_at DESC`
  ).all(since) as LedgerEntry[];
}

/**
 * Get failed entries for analysis.
 */
export function getFailedEntries(hours = 24): LedgerEntry[] {
  ensureSchema();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getOpsDb().prepare(
    `SELECT * FROM workflow_execution_ledger WHERE status IN ('failed','timeout','rejected') AND created_at >= ? ORDER BY created_at DESC`
  ).all(since) as LedgerEntry[];
}

/**
 * Backfill: import existing workflow-creation-layer JSON files into the ledger.
 */
export function backfillFromWorkflowFiles(): { imported: number; skipped: number } {
  ensureSchema();
  const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
  const WF_DIR = path.join(MI_CORE_ROOT, '.local-agent-global', 'workflows');
  
  if (!fs.existsSync(WF_DIR)) return { imported: 0, skipped: 0 };
  
  const db = getOpsDb();
  let imported = 0;
  let skipped = 0;
  
  const files = fs.readdirSync(WF_DIR).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    try {
      const wf = JSON.parse(fs.readFileSync(path.join(WF_DIR, file), 'utf8'));
      const wfId = wf.workflow_id || wf.id;
      
      // Skip if already in ledger
      const exists = db.prepare(
        `SELECT 1 FROM workflow_execution_ledger WHERE workflow_id = ?`
      ).get(wfId);
      if (exists) { skipped++; continue; }
      
      const status = normalizeStatus(wf.status);
      const isTerminal = ['completed', 'failed', 'cancelled', 'timeout', 'rejected'].includes(status);
      
      db.prepare(`
        INSERT INTO workflow_execution_ledger
          (workflow_id, parent_id, status, start_time, finish_time, duration_ms,
           failure_reason, domain, category, target_entity, owner,
           source_message, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wfId,
        wf.parent_id ?? null,
        status,
        wf.created_at ?? null,
        isTerminal ? (wf.updated_at ?? wf.created_at) : null,
        isTerminal && wf.created_at && wf.updated_at
          ? new Date(wf.updated_at).getTime() - new Date(wf.created_at).getTime()
          : null,
        wf.failure_reason ?? null,
        wf.domain ?? null,
        wf.workflow_types?.[0]?.toLowerCase() ?? null,
        wf.target_entity ?? null,
        wf.sender ?? null,
        wf.source_message_id ?? null,
        wf.created_at ?? nowIso(),
        wf.updated_at ?? nowIso(),
      );
      imported++;
    } catch { skipped++; }
  }
  
  // Also backfill from ops.db workflows table
  try {
    const opsWfs = db.prepare(`SELECT * FROM workflows`).all() as Array<{
      id: string; owner: string; target: string; intent: string; entity: string;
      category: string; status: string; created_at: string; updated_at: string;
    }>;
    
    for (const wf of opsWfs) {
      const exists = db.prepare(
        `SELECT 1 FROM workflow_execution_ledger WHERE workflow_id = ?`
      ).get(wf.id);
      if (exists) { skipped++; continue; }
      
      const status = normalizeStatus(wf.status);
      const isTerminal = ['completed', 'failed', 'cancelled', 'timeout', 'rejected'].includes(status);
      
      db.prepare(`
        INSERT INTO workflow_execution_ledger
          (workflow_id, status, start_time, finish_time, duration_ms,
           domain, category, target_entity, owner, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wf.id,
        status,
        wf.created_at ?? null,
        isTerminal ? (wf.updated_at ?? wf.created_at) : null,
        isTerminal && wf.created_at && wf.updated_at
          ? new Date(wf.updated_at).getTime() - new Date(wf.created_at).getTime()
          : null,
        wf.intent ?? null,
        wf.category ?? null,
        wf.entity ?? null,
        wf.owner ?? null,
        wf.created_at ?? nowIso(),
        wf.updated_at ?? nowIso(),
      );
      imported++;
    }
  } catch { /* ops table may not exist yet */ }
  
  return { imported, skipped };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStatus(raw: string): LedgerStatus {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('complet')) return 'completed';
  if (lower.includes('fail')) return 'failed';
  if (lower.includes('cancel')) return 'cancelled';
  if (lower.includes('timeout')) return 'timeout';
  if (lower.includes('reject')) return 'rejected';
  if (lower.includes('running') || lower.includes('executing')) return 'running';
  if (lower.includes('start')) return 'started';
  if (lower.includes('approv')) return 'approval_pending';
  if (lower.includes('draft')) return 'running';
  return 'created';
}
