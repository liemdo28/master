/**
 * CEO Control Center — Phase 23D
 *
 * POST /api/ceo/task          — submit task to Mi
 * GET  /api/ceo/tasks         — list all CEO tasks
 * GET  /api/ceo/task/:id      — get task detail
 * GET  /api/ceo/company-health — company health snapshot
 * GET  /api/ceo/reports       — recent reports
 * GET  /api/ceo/approvals     — pending approvals
 * GET  /api/ceo/workflows     — n8n workflow status
 */

import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

export const ceoControlRouter = Router();

const DATA_ROOT = process.env.MI_DATA_ROOT
  || path.resolve(__dirname, '../../../../.local-agent-global');

// CEO tasks in dedicated DB — ensure directory exists
const CEO_DB_DIR  = path.join(DATA_ROOT, 'ceo-control');
const CEO_DB_PATH = path.join(CEO_DB_DIR, 'ceo-tasks.db');
if (!fs.existsSync(CEO_DB_DIR)) fs.mkdirSync(CEO_DB_DIR, { recursive: true });
const db = new Database(CEO_DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS ceo_tasks (
    id           TEXT PRIMARY KEY,
    title        TEXT NOT NULL,
    description  TEXT,
    owner_dept   TEXT NOT NULL DEFAULT 'engineering',
    status       TEXT NOT NULL DEFAULT 'pending',
    plan         TEXT,
    requires_approval INTEGER NOT NULL DEFAULT 1,
    evidence_required INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
  );
`);

const DEPT_PATTERNS: [RegExp, string][] = [
  [/seo|website|crawl|404|content|blog|keyword/i, 'marketing'],
  [/quickbooks|invoice|payroll|tax|finance|p&l|revenue/i, 'finance'],
  [/github|deploy|build|code|fix|bug|branch|pr|release/i, 'engineering'],
  [/doordash|toast|menu|store|pos|order/i, 'operations'],
  [/n8n|workflow|automation|trigger/i, 'engineering'],
  [/health|metric|uptime|alert|monitor/i, 'engineering'],
];

function detectDept(text: string): string {
  for (const [re, dept] of DEPT_PATTERNS) {
    if (re.test(text)) return dept;
  }
  return 'engineering';
}

function buildPlan(title: string, dept: string): string {
  const plans: Record<string, string> = {
    marketing: '1. SEO crawl\n2. Identify issues\n3. Generate fix plan\n4. Apply fixes in branch\n5. CEO approval\n6. Deploy',
    finance:   '1. Pull QuickBooks data\n2. Analyze\n3. Generate report\n4. CEO review',
    engineering: '1. Code analysis\n2. Fix in branch\n3. Test\n4. PR for approval\n5. Merge',
    operations: '1. Pull POS data\n2. Analyze\n3. Recommend actions\n4. CEO approval',
  };
  return plans[dept] || plans.engineering;
}

// ── POST /api/ceo/task ────────────────────────────────────────────────────────
ceoControlRouter.post('/task', (req: Request, res: Response) => {
  const { title, description } = req.body as { title?: string; description?: string };
  if (!title) return res.status(400).json({ error: 'title required' });

  const id = `ceo-task-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const dept = detectDept(title + ' ' + (description || ''));
  const plan = buildPlan(title, dept);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO ceo_tasks (id, title, description, owner_dept, status, plan, requires_approval, evidence_required, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'pending', ?, 1, 1, ?, ?)
  `).run(id, title, description || '', dept, plan, now, now);

  return res.status(201).json({
    task_id: id,
    title,
    owner_department: dept,
    plan,
    required_approval: true,
    evidence_required: true,
    status: 'pending',
    created_at: now,
  });
});

// ── GET /api/ceo/tasks ────────────────────────────────────────────────────────
ceoControlRouter.get('/tasks', (req: Request, res: Response) => {
  const { status, dept, limit = '50' } = req.query as Record<string, string>;
  let sql = 'SELECT * FROM ceo_tasks WHERE 1=1';
  const params: unknown[] = [];
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (dept)   { sql += ' AND owner_dept=?'; params.push(dept); }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(parseInt(limit));
  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks, count: tasks.length });
});

// ── GET /api/ceo/task/:id ─────────────────────────────────────────────────────
ceoControlRouter.get('/task/:id', (req: Request, res: Response) => {
  const task = db.prepare('SELECT * FROM ceo_tasks WHERE id=?').get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  return res.json(task);
});

// ── GET /api/ceo/company-health ───────────────────────────────────────────────
ceoControlRouter.get('/company-health', async (_req: Request, res: Response) => {
  const checks = await Promise.allSettled([
    fetch('http://127.0.0.1:4001/api/n8n/health', { signal: AbortSignal.timeout(3000) }).then(r => r.json()),
    fetch('http://127.0.0.1:4001/api/bigdata/connectors/dashboard/status', { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
    fetch('http://127.0.0.1:4001/api/bigdata/connectors/toast/status', { signal: AbortSignal.timeout(3000) }).then(r => r.json()),
    fetch('http://127.0.0.1:4001/api/bigdata/connectors/quickbooks/status', { signal: AbortSignal.timeout(5000) }).then(r => r.json()),
  ]);

  const [n8n, dashboard, toast, quickbooks] = checks.map(c =>
    c.status === 'fulfilled' ? c.value : { ok: false, error: 'timeout' }
  );

  const tasks_pending = (db.prepare("SELECT COUNT(*) as c FROM ceo_tasks WHERE status='pending'").get() as { c: number }).c;

  res.json({
    captured_at: new Date().toISOString(),
    connectors: {
      n8n:        { ok: (n8n as Record<string, unknown>).ok },
      dashboard:  { ok: (dashboard as Record<string, unknown>).connected },
      toast:      { ok: (toast as Record<string, unknown>).connected },
      quickbooks: { ok: (quickbooks as Record<string, unknown>).connected },
    },
    ceo_tasks: { pending: tasks_pending },
    overall: 'operational',
  });
});

// ── GET /api/ceo/approvals ────────────────────────────────────────────────────
ceoControlRouter.get('/approvals', async (_req: Request, res: Response) => {
  try {
    const r = await fetch('http://127.0.0.1:4001/api/approvals?status=pending&limit=20',
      { signal: AbortSignal.timeout(4000) });
    const data = await r.json() as Record<string, unknown>;
    res.json(data);
  } catch (e) {
    res.status(503).json({ error: String(e) });
  }
});

// ── GET /api/ceo/workflows ────────────────────────────────────────────────────
ceoControlRouter.get('/workflows', async (_req: Request, res: Response) => {
  try {
    const N8N_KEY = process.env.N8N_API_KEY || '';
    if (!N8N_KEY) return res.json({ ok: false, error: 'N8N_API_KEY not set' });
    const r = await fetch('http://localhost:5678/api/v1/workflows?limit=50',
      { headers: { 'X-N8N-API-KEY': N8N_KEY }, signal: AbortSignal.timeout(5000) });
    const data = await r.json() as { data: unknown[] };
    return res.json({ ok: true, count: data.data?.length ?? 0, workflows: data.data });
  } catch (e) {
    return res.status(503).json({ ok: false, error: String(e) });
  }
});

// ── GET /api/ceo/reports ──────────────────────────────────────────────────────
ceoControlRouter.get('/reports', (_req: Request, res: Response) => {
  const reportsDir = path.resolve(__dirname, '../../../reports');
  try {
    const files = fs.readdirSync(reportsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => {
        const stat = fs.statSync(path.join(reportsDir, f));
        return { name: f, size: stat.size, modified: stat.mtime.toISOString() };
      })
      .sort((a, b) => b.modified.localeCompare(a.modified))
      .slice(0, 20);
    res.json({ reports: files, count: files.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
