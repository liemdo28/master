import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export const ceoControlRouter = Router();

<<<<<<< a471ef81
const CEO_DB_DIR = path.join('D:/Project/Master/.local-agent-global/ceo-control');
=======
const CEO_DB_DIR = path.join(
  process.env.GLOBAL_DIR || path.resolve(process.cwd(), '..', '.local-agent-global'),
  'ceo-control',
);
>>>>>>> origin/seo/phase-29-revenue-execution-loop
const CEO_DB_PATH = path.join(CEO_DB_DIR, 'ceo-tasks.db');

if (!fs.existsSync(CEO_DB_DIR)) fs.mkdirSync(CEO_DB_DIR, { recursive: true });

const db = new Database(CEO_DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS ceo_tasks (
    task_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    owner_department TEXT,
    plan TEXT,
    status TEXT DEFAULT 'pending',
    approval_required INTEGER DEFAULT 1,
    evidence_required INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

function detectDepartment(title: string): string {
  const t = title.toLowerCase();
  if (/seo|google|content|blog|keyword|ranking/.test(t)) return 'marketing';
  if (/quickbooks|invoice|payroll|tax|revenue|p&l/.test(t)) return 'finance';
  if (/deploy|server|code|fix|bug|build|api/.test(t)) return 'engineering';
  if (/hire|staff|schedule|employee/.test(t)) return 'hr';
  if (/doordash|toast|menu|order|customer/.test(t)) return 'operations';
  return 'general';
}

function buildPlan(dept: string): string {
  const plans: Record<string, string> = {
    marketing: '1. SEO crawl\n2. Identify issues\n3. Generate fix plan\n4. Apply fixes in branch\n5. CEO approval\n6. Deploy',
    finance: '1. Pull QB data\n2. Generate report\n3. Flag anomalies\n4. CEO review\n5. Archive',
    engineering: '1. Reproduce issue\n2. Root cause\n3. Fix in branch\n4. Test\n5. CEO approval\n6. Deploy',
    operations: '1. Audit current state\n2. Identify gaps\n3. Action plan\n4. Execute\n5. Verify',
    hr: '1. Review request\n2. Research options\n3. Recommendation\n4. CEO decision\n5. Execute',
    general: '1. Clarify scope\n2. Research\n3. Plan\n4. Execute\n5. Report',
  };
  return plans[dept] || plans.general;
}

// POST /api/ceo/task
ceoControlRouter.post('/task', (req: Request, res: Response) => {
  const { title, priority } = req.body;
  if (!title) return res.status(400).json({ ok: false, error: 'title required' });

  const task_id = `ceo-task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const dept = detectDepartment(title);
  const plan = buildPlan(dept);

  db.prepare(`INSERT INTO ceo_tasks (task_id, title, owner_department, plan) VALUES (?, ?, ?, ?)`)
    .run(task_id, title, dept, plan);

  res.json({ task_id, title, owner_department: dept, plan, required_approval: true, evidence_required: true, status: 'pending' });
});

// GET /api/ceo/tasks
ceoControlRouter.get('/tasks', (_req: Request, res: Response) => {
  const tasks = db.prepare('SELECT * FROM ceo_tasks ORDER BY created_at DESC LIMIT 50').all();
  res.json({ ok: true, tasks, count: tasks.length });
});

// GET /api/ceo/task/:id
ceoControlRouter.get('/task/:id', (req: Request, res: Response) => {
  const task = db.prepare('SELECT * FROM ceo_tasks WHERE task_id = ?').get(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
  res.json({ ok: true, task });
});

// GET /api/ceo/company-health
ceoControlRouter.get('/company-health', async (_req: Request, res: Response) => {
  const pending = (db.prepare("SELECT COUNT(*) as c FROM ceo_tasks WHERE status = 'pending'").get() as any).c;

  const checks: Record<string, any> = {};
  for (const [name, url] of [
    ['n8n', 'http://localhost:5678/healthz'],
    ['dashboard', process.env.DASHBOARD_API_URL + '/api/health'],
    ['toast', 'http://localhost:4001/api/bigdata/connectors/toast/status'],
    ['quickbooks', 'http://localhost:4001/api/bigdata/connectors/quickbooks/status'],
  ] as [string, string][]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      checks[name] = { ok: r.ok, status: r.status };
    } catch {
      checks[name] = { ok: false };
    }
  }

  const allOk = Object.values(checks).every((c: any) => c.ok);
  res.json({ ok: true, connectors: checks, ceo_tasks: { pending }, overall: allOk ? 'operational' : 'degraded' });
});

// GET /api/ceo/reports
ceoControlRouter.get('/reports', (_req: Request, res: Response) => {
  const dir = 'D:/Project/Master/mi-core';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().reverse();
  res.json({ ok: true, reports: files, count: files.length });
});

// GET /api/ceo/approvals
ceoControlRouter.get('/approvals', (_req: Request, res: Response) => {
  const tasks = db.prepare("SELECT * FROM ceo_tasks WHERE status = 'pending' AND approval_required = 1 ORDER BY created_at DESC").all();
  res.json({ ok: true, approvals: tasks, count: tasks.length });
});

// GET /api/ceo/workflows
ceoControlRouter.get('/workflows', async (_req: Request, res: Response) => {
  try {
    const r = await fetch('http://localhost:4001/api/n8n/workflow-health', { signal: AbortSignal.timeout(5000) });
    const data = await r.json() as Record<string, unknown>;
    res.json({ ok: true, ...data });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/ceo/workflows/health
ceoControlRouter.get('/workflows/health', async (_req: Request, res: Response) => {
  try {
    const [wfRes, failRes] = await Promise.all([
      fetch('http://localhost:4001/api/n8n/workflow-health', { signal: AbortSignal.timeout(5000) }),
      fetch('http://localhost:4001/api/mi/workflows/failures', { signal: AbortSignal.timeout(5000) }),
    ]);
    const wf = await wfRes.json() as any;
    const fails = await failRes.json() as any;
    res.json({ ok: true, workflows: wf.workflows || [], recent_failures: fails.failures || [], summary: { total: wf.total, active: wf.active, failure_count: fails.count } });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});

// GET /api/ceo/workflows/:id
ceoControlRouter.get('/workflows/:id', async (req: Request, res: Response) => {
  try {
    const r = await fetch(`http://localhost:4001/api/n8n/workflow/${req.params.id}`, { signal: AbortSignal.timeout(5000) });
    const data = await r.json() as Record<string, unknown>;
    res.json({ ok: true, ...data });
  } catch (e: any) {
    res.json({ ok: false, error: e.message });
  }
});
