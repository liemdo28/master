/**
 * Execution Memory — Phase 15.3
 * Answers: How many times was X audited? Which workflow worked best? Which skill chain succeeds most?
 */

import { getDb } from './operational-memory-db';

export interface ExecutionSummary {
  id: string;
  created_at: string;
  completed_at: string | null;
  requested_by: string;
  intent: string | null;
  target_project: string | null;
  priority: string;
  final_verdict: string | null;
  duration_ms: number;
  step_count: number;
  pass_count: number;
  fail_count: number;
  agent_roles: string[];
  raw_request: string;
}

export interface ProjectExecutionStats {
  target_project: string;
  total_executions: number;
  pass_count: number;
  fail_count: number;
  success_rate: number;
  avg_duration_ms: number;
  most_common_intent: string | null;
  last_execution: string | null;
  executions: ExecutionSummary[];
}

export interface WorkflowPattern {
  agent_roles: string;        // JSON-encoded role chain
  intent: string | null;
  count: number;
  pass_count: number;
  success_rate: number;
  avg_duration_ms: number;
}

function mapExec(row: any): ExecutionSummary {
  return {
    ...row,
    agent_roles: (() => { try { return JSON.parse(row.agent_roles || '[]'); } catch { return []; } })(),
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Full execution stats for a project */
export function getProjectExecutionStats(targetProject: string): ProjectExecutionStats {
  const db = getDb();
  const norm = targetProject.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const rows = db.prepare(`
    SELECT * FROM executions
    WHERE lower(target_project) LIKE ?
    ORDER BY created_at DESC
  `).all(`%${norm}%`).map(mapExec) as ExecutionSummary[];

  const passes = rows.filter(r => r.final_verdict === 'PASS').length;
  const fails = rows.filter(r => r.final_verdict === 'FAIL').length;
  const avgDur = rows.length ? rows.reduce((s, r) => s + r.duration_ms, 0) / rows.length : 0;

  // Most common intent
  const intentCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.intent) intentCounts[r.intent] = (intentCounts[r.intent] || 0) + 1;
  }
  const topIntent = Object.entries(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return {
    target_project: targetProject,
    total_executions: rows.length,
    pass_count: passes,
    fail_count: fails,
    success_rate: rows.length ? Math.round((passes / rows.length) * 100) : 0,
    avg_duration_ms: Math.round(avgDur),
    most_common_intent: topIntent,
    last_execution: rows[0]?.created_at || null,
    executions: rows,
  };
}

/** Which workflow (agent_roles chain) succeeds most often */
export function getBestWorkflows(limit = 10): WorkflowPattern[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT agent_roles, intent,
           COUNT(*) as count,
           SUM(CASE WHEN final_verdict='PASS' THEN 1 ELSE 0 END) as pass_count,
           AVG(duration_ms) as avg_dur
    FROM executions
    WHERE agent_roles != '[]'
    GROUP BY agent_roles, intent
    ORDER BY pass_count DESC, count DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map(r => ({
    agent_roles: r.agent_roles,
    intent: r.intent,
    count: r.count,
    pass_count: r.pass_count,
    success_rate: r.count ? Math.round((r.pass_count / r.count) * 100) : 0,
    avg_duration_ms: Math.round(r.avg_dur || 0),
  }));
}

/** List recent executions with filters */
export function listExecutions(opts: {
  target_project?: string;
  intent?: string;
  verdict?: string;
  from_date?: string;
  limit?: number;
} = {}): ExecutionSummary[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts.target_project) {
    conditions.push('lower(target_project) LIKE ?');
    params.push(`%${opts.target_project.toLowerCase()}%`);
  }
  if (opts.intent) {
    conditions.push('intent = ?');
    params.push(opts.intent);
  }
  if (opts.verdict) {
    conditions.push('final_verdict = ?');
    params.push(opts.verdict);
  }
  if (opts.from_date) {
    conditions.push('created_at >= ?');
    params.push(opts.from_date);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM executions ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, opts.limit || 50).map(mapExec) as ExecutionSummary[];
}

/** Execution count by project across all time */
export function getExecutionCountByProject(): Array<{ target_project: string; count: number; success_rate: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT target_project,
           COUNT(*) as count,
           ROUND(AVG(CASE WHEN final_verdict='PASS' THEN 100.0 ELSE 0 END), 1) as success_rate
    FROM executions
    WHERE target_project IS NOT NULL
    GROUP BY target_project
    ORDER BY count DESC
  `).all() as any[];
}
