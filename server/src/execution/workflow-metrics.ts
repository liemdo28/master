/**
 * DEV5 — Workflow Metrics Source of Truth
 * 
 * Computes authoritative workflow success rate from the execution ledger.
 * This is the ONLY module that computes workflow metrics.
 * No inferred scoring. No synthetic scoring. No mock data.
 * 
 * Consumed by: /api/workflows/metrics
 * Consumed by: Burn-In Monitor V2
 */

import { getOpsDb, nowIso } from '../operations/ops-db';
import { backfillFromWorkflowFiles, type LedgerEntry } from './workflow-execution-ledger';

// ── Ensure schema is bootstrapped ───────────────────────────────────────────

let _backfilled = false;

function ensureBackfill() {
  if (_backfilled) return;
  try { backfillFromWorkflowFiles(); } catch { /* non-blocking */ }
  _backfilled = true;
}

// ── Core metrics ────────────────────────────────────────────────────────────

export interface WorkflowMetrics {
  /** All-time totals */
  total: number;
  success: number;      // completed
  failed: number;       // failed + timeout
  running: number;      // started + running
  cancelled: number;
  approval_pending: number;
  rejected: number;
  created: number;      // not yet started

  /** Success rate: completed / (completed + failed + cancelled + timeout + rejected) */
  success_rate: number;

  /** 24h metrics */
  total_24h: number;
  success_24h: number;
  failed_24h: number;
  running_24h: number;
  success_rate_24h: number;

  /** Breakdown */
  by_domain: Record<string, number>;
  by_status: Record<string, number>;
  by_category: Record<string, number>;

  /** Failure details */
  top_failures: Array<{ reason: string; count: number }>;

  /** Timing */
  avg_duration_ms: number | null;
  p95_duration_ms: number | null;

  /** Timestamp */
  computed_at: string;
}

export function computeWorkflowMetrics(hours = 24): WorkflowMetrics {
  ensureBackfill();
  const db = getOpsDb();
  const since = new Date(Date.now() - hours * 3600_000).toISOString();

  // All-time counts
  const total = countAll(db, 'workflow_execution_ledger', '');
  const success = countWhere(db, `status = 'completed'`);
  const failed = countWhere(db, `status IN ('failed', 'timeout')`);
  const running = countWhere(db, `status IN ('started', 'running')`);
  const cancelled = countWhere(db, `status = 'cancelled'`);
  const approval_pending = countWhere(db, `status = 'approval_pending'`);
  const rejected = countWhere(db, `status = 'rejected'`);
  const created = countWhere(db, `status = 'created'`);

  const decidedAll = success + failed + cancelled + rejected;
  const success_rate = decidedAll > 0 ? Math.round((success / decidedAll) * 10000) / 100 : 0;

  // 24h counts
  const total_24h = countSince(db, since, '');
  const success_24h = countSince(db, since, `AND status = 'completed'`);
  const failed_24h = countSince(db, since, `AND status IN ('failed', 'timeout')`);
  const running_24h = countSince(db, since, `AND status IN ('started', 'running')`);

  const decided24h = success_24h + failed_24h + countSince(db, since, `AND status = 'cancelled'`) + countSince(db, since, `AND status = 'rejected'`);
  const success_rate_24h = decided24h > 0 ? Math.round((success_24h / decided24h) * 10000) / 100 : 0;

  // Breakdowns
  const by_status = groupBy(db, 'status');
  const by_domain = groupBy(db, 'domain');
  const by_category = groupBy(db, 'category');

  // Top failures
  const top_failures = getTopFailures(db, since);

  // Timing
  const avg_duration_ms = getAvgDuration(db);
  const p95_duration_ms = getP95Duration(db);

  return {
    total, success, failed, running, cancelled, approval_pending, rejected, created,
    success_rate,
    total_24h, success_24h, failed_24h, running_24h, success_rate_24h,
    by_domain, by_status, by_category,
    top_failures,
    avg_duration_ms, p95_duration_ms,
    computed_at: nowIso(),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function countAll(db: any, table: string, extra: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) as n FROM ${table} ${extra}`).get();
    return row?.n ?? 0;
  } catch { return 0; }
}

function countWhere(db: any, where: string): number {
  return countAll(db, 'workflow_execution_ledger', `WHERE ${where}`);
}

function countSince(db: any, since: string, extraWhere: string): number {
  const where = extraWhere
    ? `WHERE created_at >= '${since}' ${extraWhere}`
    : `WHERE created_at >= '${since}'`;
  return countAll(db, 'workflow_execution_ledger', where);
}

function groupBy(db: any, column: string): Record<string, number> {
  try {
    const rows = db.prepare(
      `SELECT ${column} as key, COUNT(*) as n FROM workflow_execution_ledger GROUP BY ${column}`
    ).all() as Array<{ key: string; n: number }>;
    const result: Record<string, number> = {};
    for (const r of rows) {
      const k = r.key || '(none)';
      result[k] = r.n;
    }
    return result;
  } catch { return {}; }
}

function getTopFailures(db: any, since: string): Array<{ reason: string; count: number }> {
  try {
    const rows = db.prepare(`
      SELECT failure_reason as reason, COUNT(*) as count
      FROM workflow_execution_ledger
      WHERE status IN ('failed', 'timeout', 'rejected')
        AND failure_reason IS NOT NULL
        AND failure_reason != ''
        ${since ? `AND created_at >= '${since}'` : ''}
      GROUP BY failure_reason
      ORDER BY count DESC
      LIMIT 10
    `).all() as Array<{ reason: string; count: number }>;
    return rows;
  } catch { return []; }
}

function getAvgDuration(db: any): number | null {
  try {
    const row = db.prepare(`
      SELECT AVG(duration_ms) as avg_ms
      FROM workflow_execution_ledger
      WHERE duration_ms IS NOT NULL AND duration_ms > 0
    `).get();
    return row?.avg_ms ? Math.round(row.avg_ms) : null;
  } catch { return null; }
}

function getP95Duration(db: any): number | null {
  try {
    const rows = db.prepare(`
      SELECT duration_ms FROM workflow_execution_ledger
      WHERE duration_ms IS NOT NULL AND duration_ms > 0
      ORDER BY duration_ms ASC
    `).all() as Array<{ duration_ms: number }>;
    if (!rows.length) return null;
    const idx = Math.floor(rows.length * 0.95);
    return rows[Math.min(idx, rows.length - 1)].duration_ms;
  } catch { return null; }
}
