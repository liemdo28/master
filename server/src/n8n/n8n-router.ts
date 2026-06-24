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
const N8N_USER = process.env.N8N_USER || 'mi-admin';
const N8N_PASS = process.env.N8N_PASS || 'mi-n8n-secure-2025';

function authHeaders(): Record<string, string> {
  const b64 = Buffer.from(`${N8N_USER}:${N8N_PASS}`).toString('base64');
  return { 'Authorization': `Basic ${b64}`, 'Content-Type': 'application/json' };
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
