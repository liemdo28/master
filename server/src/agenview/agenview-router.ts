/**
 * AgenView Router — Phase 19
 * CEO sees ALL of Mi in one dashboard.
 * Aggregates data from all phases into a single API response.
 *
 * GET /api/agenview/overview    — full system state
 * GET /api/agenview/work-orders — paginated WO list
 * GET /api/agenview/agents      — agent status + activity
 * GET /api/agenview/skills      — skill registry + trust scores
 * GET /api/agenview/graph       — risk map (SPOFs, criticality)
 * GET /api/agenview/incidents   — open incidents
 * GET /api/agenview/memory      — memory stats
 * GET /api/agenview/approvals   — pending approvals
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const MI_CORE_ROOT = process.env.MI_CORE_ROOT || 'E:/Project/Master/mi-core';
const GLOBAL_DIR   = path.join(MI_CORE_ROOT, '.local-agent-global');

export const agenviewRouter = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data, ts: new Date().toISOString() });

function readWOs() {
  const dir = path.join(GLOBAL_DIR, 'work-orders');
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function readLedger(hours = 24) {
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const file = path.join(GLOBAL_DIR, 'execution-ledger/ledger.jsonl');
  try {
    return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e: any) => e && e.ts >= cutoff);
  } catch { return []; }
}

function readGraph() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(GLOBAL_DIR, 'graph/graph.db'), { readonly: true });
    const entities = db.prepare('SELECT * FROM entities').all();
    const edges = db.prepare('SELECT * FROM edges').all();
    const spofs = db.prepare(`SELECT e.name, COUNT(ed.id) as c, MIN(100, COUNT(ed.id)*15+AVG(ed.weight)*5) as score FROM entities e JOIN edges ed ON ed.to_id=e.id AND ed.relationship='depends_on' GROUP BY e.id HAVING c>=2 ORDER BY c DESC`).all();
    db.close();
    return { entities, edges, spofs };
  } catch { return { entities: [], edges: [], spofs: [] }; }
}

function readMemoryStats() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(GLOBAL_DIR, 'operational-memory/memory.db'), { readonly: true });
    const incs = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN resolved=0 THEN 1 ELSE 0 END) as open FROM incidents').get() as any;
    const actions = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN verdict="PASS" THEN 1 ELSE 0 END) as passed FROM owner_actions').get() as any;
    db.close();
    return { total_incidents: incs.total, open_incidents: incs.open, total_actions: actions.total, overall_pass_rate: actions.total > 0 ? Math.round(actions.passed/actions.total*100) : 0 };
  } catch { return {}; }
}

// ── Overview ────────────────────────────────────────────────────────────────

agenviewRouter.get('/overview', (_req: Request, res: Response) => {
  const wos = readWOs();
  const ledger = readLedger(24);
  const graph = readGraph();
  const mem = readMemoryStats();

  const openWOs = wos.filter((w: any) => !['delivered','cancelled'].includes(w.status));
  const roles: Record<string, number> = {};
  for (const e of ledger) { if ((e as any).agent_role) roles[(e as any).agent_role] = (roles[(e as any).agent_role] || 0) + 1; }

  ok(res, {
    system_status: (graph.spofs as any[]).length > 0 ? 'WARN' : 'OK',
    open_work_orders: openWOs.length,
    total_work_orders: wos.length,
    active_agents: Object.keys(roles).length,
    agent_actions_24h: ledger.length,
    spof_count: (graph.spofs as any[]).length,
    entity_count: (graph.entities as any[]).length,
    memory: mem,
    briefing_available: fs.existsSync(path.join(GLOBAL_DIR, 'executive-briefing/last-briefing.json')),
    top_spofs: (graph.spofs as any[]).slice(0, 3).map((s: any) => ({ name: s.name, dependents: s.c, score: Math.round(s.score) })),
    agent_activity: Object.entries(roles).map(([role, count]) => ({ role, actions: count })).sort((a,b)=>b.actions-a.actions),
  });
});

// ── Work Orders ─────────────────────────────────────────────────────────────

agenviewRouter.get('/work-orders', (req: Request, res: Response) => {
  const wos = readWOs();
  const status = String(req.query.status || '');
  const filtered = status ? wos.filter((w: any) => w.status === status) : wos;
  ok(res, filtered.sort((a: any, b: any) => b.created_at?.localeCompare(a.created_at || '') || 0)
    .slice(0, 50)
    .map((w: any) => ({
      id: w.request_id, status: w.status, intent: w.intent?.intent, project: w.target_project,
      priority: w.priority, role: w.assigned_role, verdict: w.result?.verdict,
      confidence: w.result?.confidence_score, created_at: w.created_at, updated_at: w.updated_at,
    })));
});

// ── Agents ──────────────────────────────────────────────────────────────────

agenviewRouter.get('/agents', (_req: Request, res: Response) => {
  const ledger = readLedger(24);
  const stats: Record<string, { actions: number; pass: number; last_action: string; last_target: string }> = {};
  for (const e of ledger as any[]) {
    if (!e.agent_role) continue;
    if (!stats[e.agent_role]) stats[e.agent_role] = { actions: 0, pass: 0, last_action: '', last_target: '' };
    stats[e.agent_role].actions++;
    if (e.verdict === 'PASS') stats[e.agent_role].pass++;
    stats[e.agent_role].last_action = e.action_type;
    stats[e.agent_role].last_target = e.target;
  }
  ok(res, Object.entries(stats).map(([role, s]) => ({
    role, actions_24h: s.actions, pass_rate: s.actions > 0 ? Math.round(s.pass/s.actions*100) : 0,
    last_action: s.last_action, last_target: s.last_target, status: s.actions > 0 ? 'active' : 'idle',
  })).sort((a, b) => b.actions_24h - a.actions_24h));
});

// ── Graph / Risk Map ─────────────────────────────────────────────────────────

agenviewRouter.get('/graph', (_req: Request, res: Response) => {
  ok(res, readGraph());
});

// ── Incidents ───────────────────────────────────────────────────────────────

agenviewRouter.get('/incidents', (_req: Request, res: Response) => {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(path.join(GLOBAL_DIR, 'operational-memory/memory.db'), { readonly: true });
    const rows = db.prepare('SELECT * FROM incidents ORDER BY ts DESC LIMIT 50').all();
    db.close();
    ok(res, rows);
  } catch { ok(res, []); }
});

// ── Memory ──────────────────────────────────────────────────────────────────

agenviewRouter.get('/memory', (_req: Request, res: Response) => {
  ok(res, readMemoryStats());
});

// ── Approvals ───────────────────────────────────────────────────────────────

agenviewRouter.get('/approvals', (_req: Request, res: Response) => {
  try {
    const { getPending } = require('../approval/gate');
    ok(res, getPending());
  } catch { ok(res, []); }
});

// ── Skills ──────────────────────────────────────────────────────────────────

agenviewRouter.get('/skills', (_req: Request, res: Response) => {
  const certFile = path.join(GLOBAL_DIR, 'skills/certifications.json');
  try {
    const store = fs.existsSync(certFile) ? JSON.parse(fs.readFileSync(certFile, 'utf8')) : { certifications: {} };
    ok(res, Object.values(store.certifications || {}));
  } catch { ok(res, []); }
});
