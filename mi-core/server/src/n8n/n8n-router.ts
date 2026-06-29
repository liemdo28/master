/**
 * n8n Execution Bus Router
 * GET  /api/n8n/health          — n8n health check
 * GET  /api/n8n/workflows       — list all n8n workflows
 * POST /api/n8n/trigger/:id     — trigger a workflow
 * GET  /api/n8n/execution/:id   — get execution status
 * GET  /api/n8n/execution/:id/logs — get execution logs
 * DELETE /api/n8n/execution/:id — stop execution
 * POST /api/n8n/evidence        — receive evidence callback from n8n
 */

import { Router, Request, Response } from 'express';

export const n8nRouter = Router();

const N8N_BASE = process.env.N8N_URL || 'http://localhost:5678';
const N8N_KEY  = process.env.N8N_API_KEY || '';

function authHeaders(): Record<string, string> {
  return { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' };
}

async function n8nGet(path: string) {
  const res = await fetch(`${N8N_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`n8n ${path} → ${res.status}`);
  return res.json();
}

async function n8nPost(path: string, body: unknown = {}) {
  const res = await fetch(`${N8N_BASE}${path}`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`n8n POST ${path} → ${res.status}`);
  return res.json();
}

// In-memory evidence store for n8n callbacks
const evidenceLog: Array<{ received_at: string; workflow_id: string; status: string; evidence: unknown[] }> = [];

n8nRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const r = await fetch(`${N8N_BASE}/healthz`);
    res.json({ ok: r.ok, n8n_url: N8N_BASE, status: r.status });
  } catch (e) {
    res.status(503).json({ ok: false, n8n_url: N8N_BASE, error: (e as Error).message });
  }
});

n8nRouter.get('/workflows', async (_req: Request, res: Response) => {
  try {
    const data = await n8nGet('/api/v1/workflows') as { data: unknown[] };
    res.json({ ok: true, count: data.data?.length ?? 0, workflows: data.data });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

n8nRouter.post('/trigger/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body || {};
  try {
    const webhookRes = await fetch(`${N8N_BASE}/webhook/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'mi-core', triggered_at: new Date().toISOString(), ...payload }),
    });
    const result = await webhookRes.json().catch(() => ({}));
    res.json({ ok: true, workflow_id: id, result });
  } catch (e) {
    res.status(500).json({ ok: false, workflow_id: id, error: (e as Error).message });
  }
});

n8nRouter.get('/execution/:id', async (req: Request, res: Response) => {
  try {
    const data = await n8nGet(`/api/v1/executions/${req.params.id}`);
    res.json({ ok: true, data });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

n8nRouter.get('/execution/:id/logs', async (req: Request, res: Response) => {
  try {
    const data = await n8nGet(`/api/v1/executions/${req.params.id}`) as {
      status: string;
      data?: { resultData?: { runData?: Record<string, unknown[]> } }
    };
    const runData = data.data?.resultData?.runData || {};
    const nodes = Object.entries(runData).map(([name, runs]) => {
      const run = (runs as Array<{ error?: { message: string }; data?: { main?: unknown[][] } }>)[0];
      return { node: name, status: run?.error ? 'error' : 'success', error: run?.error?.message };
    });
    res.json({ ok: true, status: data.status, nodes });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

n8nRouter.delete('/execution/:id', async (req: Request, res: Response) => {
  try {
    const data = await fetch(`${N8N_BASE}/api/v1/executions/${req.params.id}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    res.json({ ok: data.ok, status: data.status });
  } catch (e) {
    res.status(500).json({ ok: false, error: (e as Error).message });
  }
});

// Evidence callback — n8n workflows POST evidence here after completion
n8nRouter.post('/evidence', (req: Request, res: Response) => {
  const { workflow_id, status, evidence = [], duration_ms } = req.body as {
    workflow_id: string; status: string; evidence: unknown[]; duration_ms: number;
  };
  if (!workflow_id) return res.status(400).json({ error: 'workflow_id required' });

  const record = {
    received_at: new Date().toISOString(),
    workflow_id,
    status,
    evidence,
    duration_ms,
  };
  evidenceLog.unshift(record);
  if (evidenceLog.length > 500) evidenceLog.splice(500);

  return res.json({ ok: true, logged: true, record });
});

n8nRouter.get('/evidence', (_req: Request, res: Response) => {
  res.json({ ok: true, count: evidenceLog.length, records: evidenceLog.slice(0, 50) });
});

// ── Failure Alert — called by mi-failure-alert-handler workflow ──────────────
interface FailureAlert {
  workflow_id: string;
  workflow_name?: string;
  execution_id: string;
  status: string;
  error: string;
  owner_department: string;
  severity: string;
  failed_at?: string;
}

const failureLog: FailureAlert[] = [];

n8nRouter.post('/failure', (req: Request, res: Response) => {
  const alert = req.body as FailureAlert;
  if (!alert.workflow_id || !alert.execution_id) {
    return res.status(400).json({ error: 'workflow_id and execution_id required' });
  }
  const record: FailureAlert = {
    ...alert,
    failed_at: alert.failed_at || new Date().toISOString(),
  };
  failureLog.unshift(record);
  if (failureLog.length > 200) failureLog.splice(200);

  console.error(`[n8n][FAILURE] workflow=${record.workflow_id} exec=${record.execution_id} err=${record.error} severity=${record.severity}`);
  return res.json({ ok: true, alert_received: true, record });
});

n8nRouter.get('/failures', (_req: Request, res: Response) => {
  res.json({ ok: true, count: failureLog.length, failures: failureLog.slice(0, 50) });
});

// ── Dead Letter Queue ────────────────────────────────────────────────────────
interface DeadLetterEntry {
  workflow_id: string;
  execution_id: string;
  error: string;
  retries: number;
  failed_at: string;
  department: string;
  owner: string;
  priority: string;
  task_id: string;
  status: string;
  evidence_path: string;
}

const deadLetterQueue: DeadLetterEntry[] = [];

// POST /api/n8n/dead-letter — called by n8n when workflow exhausts retries
n8nRouter.post('/dead-letter', (req: Request, res: Response) => {
  const entry = req.body as Partial<DeadLetterEntry>;
  if (!entry.workflow_id || !entry.error) {
    return res.status(400).json({ error: 'workflow_id and error required' });
  }
  const dl: DeadLetterEntry = {
    workflow_id: entry.workflow_id,
    execution_id: entry.execution_id || '',
    error: entry.error,
    retries: entry.retries || 3,
    failed_at: entry.failed_at || new Date().toISOString(),
    department: entry.department || 'unknown',
    owner: entry.owner || 'unknown',
    priority: entry.priority || 'P3',
    task_id: `tsk_deadletter_${Date.now()}`,
    status: 'pending',
    evidence_path: entry.evidence_path || `Mi/n8n/evidence/dead-letter/${entry.workflow_id}.json`,
  };
  deadLetterQueue.unshift(dl);
  if (deadLetterQueue.length > 200) deadLetterQueue.splice(200);
  console.error(`[n8n][DEAD-LETTER] workflow=${dl.workflow_id} error=${dl.error} retries=${dl.retries} task=${dl.task_id}`);
  return res.json({ ok: true, dead_letter_created: true, entry: dl });
});

// GET /api/n8n/dead-letter — read dead letter queue
n8nRouter.get('/dead-letter', (_req: Request, res: Response) => {
  res.json({ ok: true, count: deadLetterQueue.length, dead_letters: deadLetterQueue.slice(0, 50) });
});

// ── Workflow health summary ──────────────────────────────────────────────────
n8nRouter.get('/workflow-health', async (_req: Request, res: Response) => {
  try {
    const data = await n8nGet('/api/v1/workflows?limit=50') as { data: any[] };
    const workflows = data.data || [];
    const summary = workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      timeout_s: w.settings?.executionTimeout || null,
      created: w.createdAt?.slice(0, 10),
      updated: w.updatedAt?.slice(0, 10),
      trigger: w.nodes?.find((n: any) => n.type?.includes('trigger') || n.type?.includes('Trigger'))?.type || 'unknown',
      recent_failures: failureLog.filter(f => f.workflow_id === w.id).length,
    }));
    const active_count = summary.filter((w: any) => w.active).length;
    const failed_count = failureLog.length;
    res.json({ ok: true, total: summary.length, active: active_count, recent_failures: failed_count, workflows: summary });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e.message });
  }
});
