import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', async (_req: Request, res: Response) => {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:4002';
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

  const checks = await Promise.allSettled([
    fetch(`${AI_SERVICE_URL}/health`).then(r => r.ok),
    fetch(`${OLLAMA_URL}/api/tags`).then(r => r.ok),
  ]);

  res.json({
    server: 'ok',
    python_ai_service: checks[0].status === 'fulfilled' && checks[0].value ? 'ok' : 'down',
    ollama: checks[1].status === 'fulfilled' && checks[1].value ? 'ok' : 'down',
    runtime_sha: process.env.RUNTIME_SHA || process.env.GIT_SHA || null,
    runtime_source: process.env.MI_CORE_ROOT || null,
    access_url: process.env.MI_DASHBOARD_URL || null,
    bind_host: process.env.HOST || process.env.MI_CORE_HOST || null,
    timestamp: new Date().toISOString(),
  });
});
