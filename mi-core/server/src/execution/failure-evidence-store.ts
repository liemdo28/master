/**
 * DEV5 — Failure Evidence Store
 * 
 * Structured storage for workflow failure evidence.
 * Every failure is recorded with:
 *   - workflow_id, failure_reason, severity, category
 *   - timestamp, source, stack trace (if available)
 *   - remediation status
 * 
 * Consumed by: /api/workflows/metrics/failures
 * Consumed by: Burn-In Monitor V2
 * 
 * Target: WORKFLOW_TRUTH_READY
 */

import { getOpsDb, nowIso } from '../operations/ops-db';

// ── Schema ─────────────────────────────────────────────────────────────────

const FAILURE_TABLE = `
  CREATE TABLE IF NOT EXISTS failure_evidence (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id     TEXT NOT NULL,
    failure_type    TEXT NOT NULL,       -- workflow_fail | approval_fail | intent_fail | connector_fail | timeout
    failure_reason  TEXT NOT NULL,
    severity        TEXT NOT NULL DEFAULT 'P2',  -- P0 | P1 | P2 | P3
    category        TEXT,                         -- credential_leak | approval_bypass | entity_lost | ...
    source          TEXT,                         -- which module detected it
    detail          TEXT,                         -- additional context
    stack_trace     TEXT,                         -- error stack if available
    remediation     TEXT DEFAULT 'open',          -- open | in_progress | resolved | wont_fix
    remediation_note TEXT,
    created_at      TEXT NOT NULL,
    resolved_at     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_fe_workflow ON failure_evidence(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_fe_type     ON failure_evidence(failure_type);
  CREATE INDEX IF NOT EXISTS idx_fe_severity ON failure_evidence(severity);
  CREATE INDEX IF NOT EXISTS idx_fe_created  ON failure_evidence(created_at);
  CREATE INDEX IF NOT EXISTS idx_fe_remediation ON failure_evidence(remediation);
`;

// ── Types ──────────────────────────────────────────────────────────────────

export type FailureType = 'workflow_fail' | 'approval_fail' | 'intent_fail' | 'connector_fail' | 'timeout' | 'credential_leak' | 'hallucination' | 'data_loss';
export type FailureSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type RemediationStatus = 'open' | 'in_progress' | 'resolved' | 'wont_fix';

export interface FailureEvidence {
  id: number;
  workflow_id: string;
  failure_type: FailureType;
  failure_reason: string;
  severity: FailureSeverity;
  category: string | null;
  source: string | null;
  detail: string | null;
  stack_trace: string | null;
  remediation: RemediationStatus;
  remediation_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface FailureSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  by_severity: Record<string, number>;
  by_type: Record<string, number>;
  by_category: Record<string, number>;
  top_failures: Array<{ reason: string; count: number; severity: string }>;
}

// ── Schema init ────────────────────────────────────────────────────────────

let _initialized = false;

function ensureSchema() {
  if (_initialized) return;
  try {
    getOpsDb().exec(FAILURE_TABLE);
    _initialized = true;
  } catch { /* non-critical */ }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Record a failure evidence entry.
 */
export function recordFailure(params: {
  workflow_id: string;
  failure_type: FailureType;
  failure_reason: string;
  severity?: FailureSeverity;
  category?: string;
  source?: string;
  detail?: string;
  stack_trace?: string;
}): FailureEvidence {
  ensureSchema();
  const db = getOpsDb();
  const now = nowIso();

  const r = db.prepare(`
    INSERT INTO failure_evidence
      (workflow_id, failure_type, failure_reason, severity, category, source, detail, stack_trace, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    params.workflow_id,
    params.failure_type,
    params.failure_reason,
    params.severity || 'P2',
    params.category ?? null,
    params.source ?? null,
    params.detail ?? null,
    params.stack_trace ?? null,
    now,
  );

  return db.prepare('SELECT * FROM failure_evidence WHERE id = ?').get(r.lastInsertRowid) as FailureEvidence;
}

/**
 * Update remediation status of a failure.
 */
export function remediateFailure(
  id: number,
  status: RemediationStatus,
  note?: string,
): FailureEvidence | null {
  ensureSchema();
  const db = getOpsDb();
  const now = nowIso();

  db.prepare(`
    UPDATE failure_evidence
    SET remediation = ?, remediation_note = ?, resolved_at = ?
    WHERE id = ?
  `).run(status, note ?? null, status === 'resolved' ? now : null, id);

  return (db.prepare('SELECT * FROM failure_evidence WHERE id = ?').get(id) as FailureEvidence) ?? null;
}

/**
 * Get failure evidence for a specific workflow.
 */
export function getFailureByWorkflow(workflow_id: string): FailureEvidence[] {
  ensureSchema();
  return getOpsDb().prepare(
    'SELECT * FROM failure_evidence WHERE workflow_id = ? ORDER BY created_at DESC'
  ).all(workflow_id) as FailureEvidence[];
}

/**
 * Get recent failures within N hours.
 */
export function getRecentFailures(hours = 24): FailureEvidence[] {
  ensureSchema();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getOpsDb().prepare(
    'SELECT * FROM failure_evidence WHERE created_at >= ? ORDER BY created_at DESC'
  ).all(since) as FailureEvidence[];
}

/**
 * Get open (unresolved) failures.
 */
export function getOpenFailures(): FailureEvidence[] {
  ensureSchema();
  return getOpsDb().prepare(
    "SELECT * FROM failure_evidence WHERE remediation IN ('open', 'in_progress') ORDER BY severity ASC, created_at DESC"
  ).all() as FailureEvidence[];
}

/**
 * Get failure summary statistics.
 */
export function getFailureSummary(hours = 24): FailureSummary {
  ensureSchema();
  const db = getOpsDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  const total = (db.prepare('SELECT COUNT(*) as n FROM failure_evidence WHERE created_at >= ?').get(since) as any)?.n ?? 0;
  const open = (db.prepare("SELECT COUNT(*) as n FROM failure_evidence WHERE remediation = 'open' AND created_at >= ?").get(since) as any)?.n ?? 0;
  const in_progress = (db.prepare("SELECT COUNT(*) as n FROM failure_evidence WHERE remediation = 'in_progress' AND created_at >= ?").get(since) as any)?.n ?? 0;
  const resolved = (db.prepare("SELECT COUNT(*) as n FROM failure_evidence WHERE remediation = 'resolved' AND created_at >= ?").get(since) as any)?.n ?? 0;

  const by_severity = groupByField(db, 'severity', since);
  const by_type = groupByField(db, 'failure_type', since);
  const by_category = groupByField(db, 'category', since);

  const top_failures_rows = db.prepare(`
    SELECT failure_reason as reason, COUNT(*) as count, severity
    FROM failure_evidence
    WHERE created_at >= ?
    GROUP BY failure_reason, severity
    ORDER BY count DESC
    LIMIT 10
  `).all(since) as Array<{ reason: string; count: number; severity: string }>;

  return {
    total, open, in_progress, resolved,
    by_severity, by_type, by_category,
    top_failures: top_failures_rows,
  };
}

function groupByField(db: any, field: string, since: string): Record<string, number> {
  try {
    const rows = db.prepare(
      `SELECT ${field} as key, COUNT(*) as n FROM failure_evidence WHERE created_at >= ? AND ${field} IS NOT NULL GROUP BY ${field}`
    ).all(since) as Array<{ key: string; n: number }>;
    const result: Record<string, number> = {};
    for (const r of rows) result[r.key || '(none)'] = r.n;
    return result;
  } catch { return {}; }
}

/**
 * Seed known failure cases from DEV4_FAILED_CASES.md for baseline tracking.
 */
export function seedKnownFailures(): { seeded: number; skipped: number } {
  ensureSchema();
  const db = getOpsDb();
  const now = nowIso();
  let seeded = 0;
  let skipped = 0;

  const knownFailures = [
    { wf: 'FC-001', type: 'credential_leak' as FailureType, reason: 'Credential leaked in LLM response before approval gate', severity: 'P0' as FailureSeverity, category: 'credential_leak', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-002', type: 'approval_fail' as FailureType, reason: 'Approval gate runs AFTER LLM response — must run BEFORE for safety keywords', severity: 'P1' as FailureSeverity, category: 'approval_bypass', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-003', type: 'intent_fail' as FailureType, reason: 'Multi-intent: Dashboard dropped silently — pipeline picks first intent only', severity: 'P2' as FailureSeverity, category: 'entity_lost', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-004', type: 'intent_fail' as FailureType, reason: 'Entity carryover lost after 1 turn', severity: 'P2' as FailureSeverity, category: 'entity_lost', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-005', type: 'workflow_fail' as FailureType, reason: 'Health status contradictory across 3 surfaces', severity: 'P2' as FailureSeverity, category: 'data_inconsistency', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-006', type: 'intent_fail' as FailureType, reason: '/dash shorthand matched wrong entity', severity: 'P2' as FailureSeverity, category: 'entity_lost', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-007', type: 'workflow_fail' as FailureType, reason: 'Approval count mismatch: WhatsApp=0, Briefing=0, Status=19', severity: 'P1' as FailureSeverity, category: 'data_inconsistency', source: 'DEV4_FAILED_CASES.md' },
    { wf: 'FC-008', type: 'connector_fail' as FailureType, reason: 'Accounting engine route prefix wrong (/api/stats vs /stats)', severity: 'P1' as FailureSeverity, category: 'connector_misconfig', source: 'ACCOUNTING_ENGINE_ROUTE_FIX_REPORT.md' },
  ];

  for (const kf of knownFailures) {
    const exists = db.prepare(
      'SELECT 1 FROM failure_evidence WHERE workflow_id = ? AND failure_reason = ?'
    ).get(kf.wf, kf.reason);
    if (exists) { skipped++; continue; }

    db.prepare(`
      INSERT INTO failure_evidence
        (workflow_id, failure_type, failure_reason, severity, category, source, remediation, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
    `).run(kf.wf, kf.type, kf.reason, kf.severity, kf.category, kf.source, now);
    seeded++;
  }

  return { seeded, skipped };
}
