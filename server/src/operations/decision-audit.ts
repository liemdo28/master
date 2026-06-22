/**
 * O3 — AI Decision Audit Trail
 * "Why did Mi do that?" — every important decision is recorded.
 */

import { getOpsDb, nowIso } from './ops-db';

export interface AuditEntry {
  id: number;
  session_id?: string;
  user_request: string;
  intent?: string;
  entity?: string;
  workflow_id?: string;
  model?: string;
  latency_ms?: number;
  approval_decision?: string;
  execution_decision?: string;
  sources?: string;
  created_at: string;
}

export function recordDecision(params: {
  session_id?: string;
  user_request: string;
  intent?: string;
  entity?: string;
  workflow_id?: string;
  model?: string;
  latency_ms?: number;
  approval_decision?: string;
  execution_decision?: string;
  sources?: string[];
}): void {
  try {
    getOpsDb().prepare(`
      INSERT INTO audit_trail
        (session_id, user_request, intent, entity, workflow_id, model, latency_ms,
         approval_decision, execution_decision, sources, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      params.session_id ?? null,
      params.user_request.slice(0, 500),
      params.intent ?? null,
      params.entity ?? null,
      params.workflow_id ?? null,
      params.model ?? null,
      params.latency_ms ?? null,
      params.approval_decision ?? null,
      params.execution_decision ?? null,
      params.sources ? params.sources.join(',') : null,
      nowIso(),
    );
  } catch { /* non-blocking */ }
}

export function queryAudit(params: {
  session_id?: string;
  intent?: string;
  since_hours?: number;
  limit?: number;
}): AuditEntry[] {
  const args: unknown[] = [];
  let sql = `SELECT * FROM audit_trail WHERE 1=1`;
  if (params.session_id) { sql += ` AND session_id=?`; args.push(params.session_id); }
  if (params.intent) { sql += ` AND intent=?`; args.push(params.intent); }
  if (params.since_hours) {
    sql += ` AND created_at>=?`;
    args.push(new Date(Date.now() - params.since_hours * 3600_000).toISOString());
  }
  sql += ` ORDER BY created_at DESC LIMIT ?`;
  args.push(params.limit ?? 100);
  return getOpsDb().prepare(sql).all(...args) as AuditEntry[];
}

export function getDecisionForRequest(user_request: string): AuditEntry | null {
  return (getOpsDb().prepare(
    `SELECT * FROM audit_trail WHERE user_request LIKE ? ORDER BY created_at DESC LIMIT 1`
  ).get(`%${user_request.slice(0, 100)}%`) as AuditEntry) ?? null;
}

export function getAuditStats(): {
  total_24h: number; by_intent: Record<string, number>; avg_latency_ms: number;
} {
  const db = getOpsDb();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const total_24h = (db.prepare(`SELECT COUNT(*) as n FROM audit_trail WHERE created_at>=?`).get(since) as any).n;
  const intentRows = db.prepare(`SELECT intent, COUNT(*) as n FROM audit_trail WHERE created_at>=? AND intent IS NOT NULL GROUP BY intent ORDER BY n DESC LIMIT 10`).all(since) as Array<{intent: string; n: number}>;
  const by_intent: Record<string, number> = {};
  for (const r of intentRows) by_intent[r.intent] = r.n;
  const avgRow = db.prepare(`SELECT AVG(latency_ms) as avg FROM audit_trail WHERE created_at>=? AND latency_ms IS NOT NULL`).get(since) as any;
  return { total_24h, by_intent, avg_latency_ms: Math.round(avgRow?.avg ?? 0) };
}
