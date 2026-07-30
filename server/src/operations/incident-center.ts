/**
 * O1 — Executive Incident Center
 * Tracks all system failures with P0-P3 severity.
 */

import { getOpsDb, nowIso, shortId } from './ops-db';

export type Severity = 'P0' | 'P1' | 'P2' | 'P3';

export type IncidentCategory =
  | 'connector_failure'
  | 'workflow_failure'
  | 'approval_failure'
  | 'qb_failure'
  | 'gmail_failure'
  | 'whatsapp_failure'
  | 'ai_failure'
  | 'pipeline_failure'
  | 'auth_failure'
  | 'general';

export interface Incident {
  id: string;
  severity: Severity;
  category: IncidentCategory;
  title: string;
  detail?: string;
  source?: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string;
}

// Severity heuristics by category
const DEFAULT_SEVERITY: Record<IncidentCategory, Severity> = {
  connector_failure: 'P2',
  workflow_failure:  'P2',
  approval_failure:  'P1',
  qb_failure:        'P1',
  gmail_failure:     'P2',
  whatsapp_failure:  'P0',
  ai_failure:        'P1',
  pipeline_failure:  'P1',
  auth_failure:      'P0',
  general:           'P3',
};

export function raiseIncident(
  category: IncidentCategory,
  title: string,
  detail?: string,
  source?: string,
  severity?: Severity,
): Incident {
  const db = getOpsDb();
  const id = shortId('inc');
  const sev = severity ?? DEFAULT_SEVERITY[category];
  const now = nowIso();

  db.prepare(`
    INSERT INTO incidents (id, severity, category, title, detail, source, resolved, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(id, sev, category, title, detail ?? null, source ?? null, now);

  console.error(`[O1-INCIDENT] ${sev} ${category}: ${title}`);

  return { id, severity: sev, category, title, detail, source, resolved: false, created_at: now };
}

export function resolveIncident(id: string): boolean {
  const db = getOpsDb();
  const r = db.prepare(`UPDATE incidents SET resolved=1, resolved_at=? WHERE id=? AND resolved=0`).run(nowIso(), id);
  return r.changes > 0;
}

export function getActiveIncidents(limit = 50): Incident[] {
  return getOpsDb().prepare(`
    SELECT * FROM incidents WHERE resolved=0 ORDER BY
      CASE severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ?
  `).all(limit) as Incident[];
}

export function getRecentIncidents(hours = 24, limit = 100): Incident[] {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  return getOpsDb().prepare(`
    SELECT * FROM incidents WHERE created_at >= ? ORDER BY created_at DESC LIMIT ?
  `).all(since, limit) as Incident[];
}

export function getIncidentStats(): {
  active: number; p0: number; p1: number; p2: number; p3: number;
  resolved_24h: number; total_24h: number;
} {
  const db = getOpsDb();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const active = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=0`).get() as any).n;
  const p0 = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=0 AND severity='P0'`).get() as any).n;
  const p1 = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=0 AND severity='P1'`).get() as any).n;
  const p2 = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=0 AND severity='P2'`).get() as any).n;
  const p3 = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=0 AND severity='P3'`).get() as any).n;
  const total_24h = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE created_at>=?`).get(since) as any).n;
  const resolved_24h = (db.prepare(`SELECT COUNT(*) as n FROM incidents WHERE resolved=1 AND created_at>=?`).get(since) as any).n;
  return { active, p0, p1, p2, p3, resolved_24h, total_24h };
}
