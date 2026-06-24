/**
 * Task Data Collector — Phase 16
 * Reads directly from all operational data sources — no LLM.
 * Sources: work-orders, execution-ledger, approval gate, skill certifications,
 *          operational memory incidents, reminders, graph intelligence (Phase 14).
 */

import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const GLOBAL_DIR = path.join(MI_CORE_ROOT, '.local-agent-global');

// ── Types ────────────────────────────────────────────────────────────────────

export interface OpenTask {
  id: string;
  type: 'work_order' | 'incident' | 'approval' | 'certification' | 'reminder';
  title: string;
  project?: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  created_at: string;
  age_hours: number;
  detail?: string;
}

export interface TeamActivity {
  agent_role: string;
  action_type: string;
  target: string;
  ts: string;
  verdict: string;
  work_order_id?: string;
}

export interface GraphRisk {
  entity_id: string;
  entity_name: string;
  is_spof: boolean;
  criticality_score: number;
  in_degree: number;          // how many depend on it
  dependents: string[];
}

export interface OperationalSnapshot {
  as_of: string;
  open_work_orders: OpenTask[];
  pending_approvals: OpenTask[];
  open_blockers: OpenTask[];
  certifications_pending: OpenTask[];
  active_reminders: OpenTask[];
  recent_team_activity: TeamActivity[];
  concern_items: OpenTask[];   // P0/P1 or unresolved blockers > 24h
  graph_risks: GraphRisk[];    // Phase 14: SPOF + high-criticality entities
}

// ── Readers ──────────────────────────────────────────────────────────────────

function ageHours(ts: string): number {
  return Math.round((Date.now() - new Date(ts).getTime()) / 3_600_000);
}

/** Read all work orders and return open/failed ones */
export function readOpenWorkOrders(): OpenTask[] {
  const woDir = path.join(GLOBAL_DIR, 'work-orders');
  try {
    return fs.readdirSync(woDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(woDir, f), 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .filter((wo: any) => !['delivered', 'cancelled'].includes(wo.status))
      .map((wo: any): OpenTask => ({
        id: wo.request_id,
        type: 'work_order',
        title: wo.raw_request?.slice(0, 80) || `Work order ${wo.request_id}`,
        project: wo.target_project || wo.intent?.target_project,
        priority: wo.priority || 'P2',
        status: wo.status,
        created_at: wo.created_at,
        age_hours: ageHours(wo.created_at),
        detail: `Intent: ${wo.intent?.intent || 'unknown'} | Role: ${wo.assigned_role}`,
      }));
  } catch { return []; }
}

/** Read open (unresolved) incidents from operational memory */
export function readOpenBlockers(): OpenTask[] {
  const dbPath = path.join(GLOBAL_DIR, 'operational-memory/memory.db');
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare(
      `SELECT * FROM incidents WHERE resolved = 0 ORDER BY ts DESC`
    ).all() as any[];
    db.close();

    return rows.map((r: any): OpenTask => {
      const pri = r.recur_count > 0 ? 'P1' : r.age_hours > 48 ? 'P1' : 'P2';
      return {
        id: r.id,
        type: 'incident',
        title: r.error_summary?.slice(0, 80) || `Incident on ${r.target}`,
        project: r.target,
        priority: pri as any,
        status: 'open',
        created_at: r.ts,
        age_hours: ageHours(r.ts),
        detail: `Role: ${r.agent_role} | Action: ${r.action_type}${r.recur_count > 0 ? ` | Recurred ${r.recur_count}x` : ''}`,
      };
    });
  } catch { return []; }
}

/** Read pending approvals from approval gate (in-memory) */
export function readPendingApprovals(): OpenTask[] {
  try {
    const { getPending } = require('../approval/gate');
    const pending: any[] = getPending();
    return pending.map((a: any): OpenTask => ({
      id: a.id,
      type: 'approval',
      title: a.description?.slice(0, 80) || `Approval: ${a.category}`,
      project: a.target,
      priority: a.risk_level === 3 ? 'P0' : a.risk_level === 2 ? 'P1' : 'P2',
      status: 'pending',
      created_at: a.created_at,
      age_hours: ageHours(a.created_at),
      detail: `Level ${a.risk_level} | Category: ${a.category}`,
    }));
  } catch { return []; }
}

/** Read skill certifications that are EXPERIMENTAL or BETA (need review/promotion) */
export function readCertificationsPending(): OpenTask[] {
  const certFile = path.join(GLOBAL_DIR, 'skills/certifications.json');
  try {
    if (!fs.existsSync(certFile)) return [];
    const store = JSON.parse(fs.readFileSync(certFile, 'utf8'));
    const certs: any[] = Object.values(store.certifications || {});

    return certs
      .filter((c: any) => c.level === 'BETA' && c.execution_count >= 20)
      .map((c: any): OpenTask => ({
        id: `cert-${c.skill_id}`,
        type: 'certification',
        title: `Skill "${c.skill_id}" sẵn sàng nâng cấp lên CERTIFIED`,
        priority: 'P3',
        status: 'awaiting_review',
        created_at: c.certified_at,
        age_hours: ageHours(c.certified_at),
        detail: `Level: ${c.level} | Execs: ${c.execution_count} | Success: ${c.success_rate}%`,
      }));
  } catch { return []; }
}

/** Read active reminders */
export function readActiveReminders(): OpenTask[] {
  try {
    const { listReminders } = require('../reminders/reminder-store');
    const reminders: any[] = listReminders ? listReminders() : [];
    return reminders
      .filter((r: any) => r.active)
      .map((r: any): OpenTask => ({
        id: r.id,
        type: 'reminder',
        title: r.message?.slice(0, 80) || 'Reminder',
        priority: 'P2',
        status: 'active',
        created_at: r.created_at,
        age_hours: ageHours(r.created_at),
        detail: `Next trigger: ${r.next_trigger}`,
      }));
  } catch { return []; }
}

/** Read recent team activity from ledger (last 24h) */
export function readRecentTeamActivity(): TeamActivity[] {
  const ledgerFile = path.join(GLOBAL_DIR, 'execution-ledger/ledger.jsonl');
  const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
  try {
    const lines = fs.readFileSync(ledgerFile, 'utf8').split('\n').filter(Boolean);
    const entries: any[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

    return entries
      .filter((e: any) => e.ts >= cutoff)
      .slice(-30)                    // last 30 actions today
      .reverse()
      .map((e: any): TeamActivity => ({
        agent_role: e.agent_role,
        action_type: e.action_type,
        target: e.target,
        ts: e.ts,
        verdict: e.verdict,
        work_order_id: e.work_order_id,
      }));
  } catch { return []; }
}

/** Read SPOF and high-criticality entities from the Phase 14 graph DB */
export function readGraphRisks(): GraphRisk[] {
  const graphDb = path.join(GLOBAL_DIR, 'graph/graph.db');
  try {
    if (!require('fs').existsSync(graphDb)) return [];
    const Database = require('better-sqlite3');
    const db = new Database(graphDb, { readonly: true });

    // Find entities with ≥2 high-weight inbound depends_on edges (SPOF rule from Phase 14)
    const rows = db.prepare(`
      SELECT e.id, e.name,
             COUNT(ed.id) as in_degree,
             AVG(ed.weight) as avg_weight,
             (COUNT(CASE WHEN ed.weight >= 8 THEN 1 END) >= 2) as is_spof
      FROM entities e
      LEFT JOIN edges ed ON ed.to_id = e.id AND ed.relationship = 'depends_on'
      WHERE e.type NOT IN ('owner', 'team', 'repository')
      GROUP BY e.id
      HAVING in_degree > 0
      ORDER BY in_degree DESC, avg_weight DESC
      LIMIT 10
    `).all() as any[];

    db.close();

    return rows.map((r: any): GraphRisk => {
      const score = Math.min(100, r.in_degree * 15 + (r.avg_weight || 0) * 5);
      return {
        entity_id: r.id,
        entity_name: r.name,
        is_spof: r.is_spof === 1,
        criticality_score: score,
        in_degree: r.in_degree,
        dependents: [],   // names fetched below if needed
      };
    });
  } catch { return []; }
}

// ── Snapshot builder ──────────────────────────────────────────────────────────

export function buildSnapshot(): OperationalSnapshot {
  const workOrders = readOpenWorkOrders();
  const blockers = readOpenBlockers();
  const approvals = readPendingApprovals();
  const certs = readCertificationsPending();
  const reminders = readActiveReminders();
  const teamActivity = readRecentTeamActivity();
  const graphRisks = readGraphRisks();

  // Concern items: P0/P1 anything, or blockers older than 24h, or approval older than 4h
  const concerns: OpenTask[] = [
    ...workOrders.filter(t => t.priority === 'P0' || t.priority === 'P1'),
    ...blockers.filter(t => t.age_hours >= 24 || t.priority === 'P1'),
    ...approvals.filter(t => t.age_hours >= 4 || t.priority === 'P0'),
  ].filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);

  return {
    as_of: new Date().toISOString(),
    open_work_orders: workOrders,
    pending_approvals: approvals,
    open_blockers: blockers,
    certifications_pending: certs,
    active_reminders: reminders,
    recent_team_activity: teamActivity,
    concern_items: concerns,
    graph_risks: graphRisks,
  };
}
