/**
 * /api/qb — Proxy to QB ops agent financial endpoints on Laptop1
 *
 * GET /api/qb/status          — agent health + sync status
 * GET /api/qb/financial       — full financial data (accounts, receipts, invoices)
 * GET /api/qb/financial/summary — CEO summary (revenue, expenses, net income)
 */
import { Router, Request, Response } from 'express';
import http from 'http';

export const qbFinancialRouter = Router();

const QB_AGENT = process.env.QB_AGENT_URL || 'http://100.111.97.25:3457';

async function proxyGet(path: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve) => {
    const req = http.get(`${QB_AGENT}${path}`, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode || 200, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode || 500, data: { error: 'Invalid response from QB agent' } }); }
      });
    });
    req.on('error', (err) => resolve({ status: 503, data: { error: `QB agent unreachable: ${err.message}` } }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: 504, data: { error: 'QB agent timeout' } }); });
  });
}

qbFinancialRouter.get('/status', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/status');
  res.status(status).json(data);
});

qbFinancialRouter.get('/financial', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/qb/financial');
  res.status(status).json(data);
});

qbFinancialRouter.get('/financial/summary', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/qb/financial/summary');
  res.status(status).json(data);
});

qbFinancialRouter.get('/financial/accounts', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/qb/financial/accounts');
  res.status(status).json(data);
});

qbFinancialRouter.get('/financial/receipts', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/qb/financial/receipts');
  res.status(status).json(data);
});

qbFinancialRouter.get('/financial/invoices', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/qb/financial/invoices');
  res.status(status).json(data);
});

/**
 * GET /api/qb/health-check
 * Returns stale/live status based on last_sync from QB ops agent.
 * Stale = last_sync is null OR more than 2 hours ago.
 */
qbFinancialRouter.get('/health-check', async (_req: Request, res: Response) => {
  const { status, data } = await proxyGet('/api/status');

  if (status !== 200 || !data || data.error) {
    return res.status(503).json({
      qb_status: 'QB_AGENT_UNREACHABLE',
      last_sync: null,
      stale: true,
      next_action: 'Start qb-ops-agent on Laptop1 (Tailscale 100.111.97.25:3457)',
      agent_error: data?.error || 'No response from QB ops agent',
    });
  }

  const lastSync: string | null = data.last_sync ?? null;
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  let qbStatus: 'QB_LIVE' | 'QB_STALE' | 'QB_NEVER_SYNCED';
  let stale: boolean;
  let nextAction: string | null = null;

  if (!lastSync) {
    qbStatus = 'QB_NEVER_SYNCED';
    stale = true;
    nextAction = 'Open QuickBooks Desktop on Laptop1, go to File → Update Web Services → Update Now to trigger QBWC sync';
  } else {
    const ageMs = Date.now() - new Date(lastSync).getTime();
    stale = ageMs > TWO_HOURS_MS;
    qbStatus = stale ? 'QB_STALE' : 'QB_LIVE';
    if (stale) {
      nextAction = `Last sync was ${Math.round(ageMs / 60000)} minutes ago. Open QB Desktop → Update Web Services to re-sync.`;
    }
  }

  return res.status(200).json({
    qb_status: qbStatus,
    last_sync: lastSync,
    stale,
    requests_received: data.requests_received ?? 0,
    agent_url: QB_AGENT,
    ...(nextAction ? { next_action: nextAction } : {}),
  });
});
