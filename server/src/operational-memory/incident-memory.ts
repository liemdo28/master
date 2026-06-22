/**
 * Incident Memory — Phase 15.2
 * Answers: Has this happened before? Who fixed it? How long? Did it recur?
 */

import { getDb } from './operational-memory-db';

export interface IncidentRecord {
  id: string;
  work_order_id: string | null;
  ts: string;
  target: string;
  agent_role: string;
  action_type: string;
  error_summary: string;
  verdict: string;
  resolved: boolean;
  resolution_notes: string;
  recur_count: number;
}

export interface IncidentHistory {
  target: string;
  total_incidents: number;
  resolved_count: number;
  unresolved_count: number;
  recurrence_count: number;
  first_seen: string | null;
  last_seen: string | null;
  incidents: IncidentRecord[];
  has_occurred: boolean;
  summary: string;
}

export interface IncidentQuery {
  target?: string;
  agent_role?: string;
  from_date?: string;
  to_date?: string;
  resolved?: boolean;
  limit?: number;
}

function mapRow(row: any): IncidentRecord {
  return { ...row, resolved: row.resolved === 1 };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Has this project/service ever had incidents? */
export function getIncidentHistory(target: string): IncidentHistory {
  const db = getDb();
  const norm = target.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const rows = db.prepare(`
    SELECT * FROM incidents
    WHERE lower(target) LIKE ?
    ORDER BY ts DESC
  `).all(`%${norm}%`).map(mapRow) as IncidentRecord[];

  const resolved = rows.filter(r => r.resolved);
  const recurrences = rows.filter(r => r.recur_count > 0);
  const first = rows.length ? rows[rows.length - 1].ts : null;
  const last = rows.length ? rows[0].ts : null;

  const summary = rows.length === 0
    ? `Không có incident nào được ghi nhận cho "${target}".`
    : `"${target}" đã có ${rows.length} incident(s). ` +
      `${resolved.length} đã được giải quyết, ${rows.length - resolved.length} chưa xong. ` +
      (recurrences.length ? `${recurrences.length} incident tái diễn.` : 'Không có tái diễn.');

  return {
    target,
    total_incidents: rows.length,
    resolved_count: resolved.length,
    unresolved_count: rows.length - resolved.length,
    recurrence_count: recurrences.length,
    first_seen: first,
    last_seen: last,
    incidents: rows,
    has_occurred: rows.length > 0,
    summary,
  };
}

/** List all incidents with optional filters */
export function listIncidents(query: IncidentQuery = {}): IncidentRecord[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: any[] = [];

  if (query.target) {
    conditions.push('lower(target) LIKE ?');
    params.push(`%${query.target.toLowerCase()}%`);
  }
  if (query.agent_role) {
    conditions.push('agent_role = ?');
    params.push(query.agent_role);
  }
  if (query.from_date) {
    conditions.push('ts >= ?');
    params.push(query.from_date);
  }
  if (query.to_date) {
    conditions.push('ts <= ?');
    params.push(query.to_date);
  }
  if (query.resolved !== undefined) {
    conditions.push('resolved = ?');
    params.push(query.resolved ? 1 : 0);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = query.limit || 50;
  return db.prepare(`SELECT * FROM incidents ${where} ORDER BY ts DESC LIMIT ?`)
    .all(...params, limit).map(mapRow) as IncidentRecord[];
}

/** Most incident-prone projects in a time window */
export function getTopIncidentProjects(days = 90, topN = 10): Array<{
  target: string;
  incident_count: number;
  last_incident: string;
  resolved_rate: number;
}> {
  const db = getDb();
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString();

  return db.prepare(`
    SELECT target,
           COUNT(*) as incident_count,
           MAX(ts) as last_incident,
           ROUND(AVG(resolved) * 100, 1) as resolved_rate
    FROM incidents
    WHERE ts >= ?
    GROUP BY target
    ORDER BY incident_count DESC
    LIMIT ?
  `).all(cutoff, topN) as any[];
}

/** Find who typically resolves incidents for a project */
export function getResolvers(target: string): Array<{ agent_role: string; count: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT agent_role, COUNT(*) as count
    FROM incidents
    WHERE lower(target) LIKE ? AND resolved = 1
    GROUP BY agent_role
    ORDER BY count DESC
  `).all(`%${target.toLowerCase()}%`) as any[];
}
