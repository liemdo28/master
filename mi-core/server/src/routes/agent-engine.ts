/**
 * Agent Engine Route — proxies to agent-engine bridge (port 4003).
 * Exposes: patch planning, code apply (approval-gated), git ops, company memory.
 */

import { Router, Request, Response } from 'express';
import http from 'http';

export const agentEngineRouter = Router();

const BRIDGE_URL = process.env.AGENT_ENGINE_URL || 'http://127.0.0.1:4003';

// ── Bridge proxy helper ───────────────────────────────────────────────────────
async function bridgeRequest(method: string, path: string, body?: object): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const url = new URL(BRIDGE_URL + path);

    const options = {
      hostname: url.hostname,
      port: parseInt(url.port || '4003'),
      path: url.pathname,
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 500, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 500, data: { raw: data } });
        }
      });
    });

    req.on('error', () => reject(new Error('Agent engine bridge not reachable — is it running?')));
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Agent engine timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Bridge status check ───────────────────────────────────────────────────────
agentEngineRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('GET', '/health');
    res.json({ connected: true, bridge: result.data });
  } catch {
    res.json({
      connected: false,
      message: 'Agent engine bridge offline. Start with: node mi-core/agent-engine/bridge.mjs',
    });
  }
});

agentEngineRouter.get('/capabilities', async (_req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('GET', '/capabilities');
    res.json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Patch planning (read-only, no approval needed) ───────────────────────────
agentEngineRouter.post('/patch/plan', async (req: Request, res: Response) => {
  try {
    const { projectPath, task, context } = req.body;
    if (!projectPath || !task) return res.status(400).json({ error: 'projectPath and task required' });

    const result = await bridgeRequest('POST', '/patch/plan', { projectPath, task, context });
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Patch validation (read-only) ──────────────────────────────────────────────
agentEngineRouter.post('/patch/validate', async (req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('POST', '/patch/validate', req.body);
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Patch apply — requires approval gate (Level 2) ────────────────────────────
agentEngineRouter.post('/patch/apply', async (req: Request, res: Response) => {
  try {
    const { enqueue } = await import('../approval/gate');
    const { projectPath, plan, dryRun } = req.body;

    if (!dryRun) {
      // Enqueue for approval before applying
      const action = enqueue({
        description: `Apply code patch to ${projectPath} — ${(plan?.changes?.length || 0)} files`,
        risk_level: 2,
        category: 'code-patch',
        target: projectPath,
        before_state: `${plan?.changes?.length || 0} files targeted`,
        rollback_plan: 'git checkout . to revert all changes',
      });
      return res.json({
        queued: true,
        approval_id: action.id,
        message: 'Patch queued for Level 2 approval. Approve via /api/approval/:id',
      });
    }

    // dry run: execute immediately, no changes written
    const result = await bridgeRequest('POST', '/patch/apply', { ...req.body, dryRun: true });
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Git ops ───────────────────────────────────────────────────────────────────
agentEngineRouter.post('/git/status', async (req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('POST', '/git/status', req.body);
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

agentEngineRouter.post('/git/diff', async (req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('POST', '/git/diff', req.body);
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Company memory ────────────────────────────────────────────────────────────
agentEngineRouter.get('/memory/:type', async (req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('GET', `/memory/${req.params.type}`);
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

agentEngineRouter.post('/memory/:type', async (req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('POST', `/memory/${req.params.type}`, req.body);
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});

// ── Recent patches list ───────────────────────────────────────────────────────
agentEngineRouter.get('/patches', async (_req: Request, res: Response) => {
  try {
    const result = await bridgeRequest('GET', '/patches');
    res.status(result.status as number).json(result.data);
  } catch (e: unknown) {
    res.status(503).json({ error: (e as Error).message });
  }
});
