/**
 * CEO Observer Status Route — /api/ceo-observer
 *
 * Proxies status from mi-ceo-observer (Session A, port 3212)
 * so Mi-Core dashboard shows dual-session health.
 */

import { Router, Request, Response } from 'express';
import * as http from 'http';

export const ceoObserverRouter = Router();

function proxyGet(path: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:3212${path}`, { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', (c: string) => { data += c; });
      res.on('end', () => {
        try { resolve({ ok: res.statusCode! < 400, status: res.statusCode!, body: JSON.parse(data) }); }
        catch { resolve({ ok: res.statusCode! < 400, status: res.statusCode!, body: {} }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, body: { error: 'timeout' } }); });
    req.on('error', (e) => resolve({ ok: false, status: 0, body: { error: (e as Error).message } }));
  });
}

ceoObserverRouter.get('/health', async (_req: Request, res: Response) => {
  const result = await proxyGet('/health');
  res.status(result.ok ? 200 : 503).json({
    session_a: result.ok ? 'online' : 'offline',
    ...(result.body as object),
  });
});

ceoObserverRouter.get('/status', async (_req: Request, res: Response) => {
  const result = await proxyGet('/status');
  if (!result.ok) {
    return res.status(503).json({ error: 'CEO Observer offline', detail: result.body });
  }
  res.json(result.body);
});

ceoObserverRouter.get('/chats', async (_req: Request, res: Response) => {
  const result = await proxyGet('/chats');
  if (!result.ok) {
    return res.status(503).json({ error: 'CEO Observer offline' });
  }
  res.json(result.body);
});

ceoObserverRouter.get('/policy', async (_req: Request, res: Response) => {
  const result = await proxyGet('/policy');
  res.status(result.ok ? 200 : 503).json(result.body);
});
