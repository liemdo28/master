/**
 * Browser Agent API — WS8
 *
 * GET  /api/browser/status     — check if browser-use is available
 * POST /api/browser/extract    — read-only browser task { url, task }
 * POST /api/browser/write      — write browser task (requires approval_id)
 */

import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { runBrowserTask } from '../browser/browser-router';
import { assertPermission } from '../security/permission-layer';

export const browserAgentRouter = Router();

// On Windows, browser_use is installed under 'python' (Python 3.13), not 'python3'
const PYTHON_BIN = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');

function checkPython(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(PYTHON_BIN, ['-c', 'import browser_use; print("ok")'], { timeout: 5000 });
    let out = '';
    proc.stdout.on('data', (d: Buffer) => out += d.toString());
    proc.on('close', (code: number) => resolve(code === 0 && out.includes('ok')));
    proc.on('error', () => resolve(false));
  });
}

browserAgentRouter.get('/health', async (_req: Request, res: Response) => {
  const available = await checkPython();
  res.json({
    status: available ? 'ok' : 'not_configured',
    available,
    python_bin: PYTHON_BIN,
    setup_required: !available,
    setup_command: available ? null : `pip install browser-use langchain-ollama playwright && playwright install chromium`,
    capabilities: available ? ['extract', 'screenshot', 'read-only'] : [],
    write_requires: 'approval_id',
  });
});

browserAgentRouter.get('/status', async (_req: Request, res: Response) => {
  const available = await checkPython();
  res.json({
    available,
    python_bin: PYTHON_BIN,
    setup_required: !available,
    setup_command: available ? null : 'pip install browser-use langchain-ollama playwright && playwright install chromium',
  });
});

browserAgentRouter.post('/extract', async (req: Request, res: Response) => {
  const { url, task, provider } = req.body as { url: string; task: string; provider?: 'browser-use' | 'skyvern' };
  if (!url || !task) return res.status(400).json({ error: 'url and task required' });
  const result = await runBrowserTask({ url, task, provider, headless: true });
  res.json(result);
});

browserAgentRouter.post('/write', async (req: Request, res: Response) => {
  const { url, task, approval_id, provider } = req.body as { url: string; task: string; approval_id: string; provider?: 'browser-use' | 'skyvern' };
  if (!url || !task) return res.status(400).json({ error: 'url and task required' });
  try {
    await assertPermission({ actor: 'api', action: 'browser_write', resource: url, approval_id });
    const result = await runBrowserTask({ url, task, approval_id, provider, headless: true }, { write: true, production: true });
    res.json(result);
  } catch (e) {
    res.status(403).json({ error: String(e) });
  }
});
