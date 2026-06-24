/**
 * /api/doordash — DoorDash Playwright scraper metrics
 *
 * GET  /api/doordash/health        — agent health
 * GET  /api/doordash/metrics       — latest scraped data (all accounts)
 * POST /api/doordash/scrape        — trigger scrape now
 * GET  /api/doordash/accounts      — list accounts (no passwords)
 */
import { Router, Request, Response } from 'express';
import { DoorDashReadAdapter } from '../executive-intelligence/connectors/doordash/doordash-read-adapter';

export const doordashMetricsRouter = Router();
const adapter = new DoorDashReadAdapter();

doordashMetricsRouter.get('/health', async (_req: Request, res: Response) => {
  try {
    const status = await adapter.getHealthStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

doordashMetricsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const data = await (adapter as any).getMetrics();
    res.json(data);
  } catch (err: any) {
    res.status(503).json({ error: err.message, hint: 'Ensure mi-doordash-agent is running (pm2 start mi-doordash-agent)' });
  }
});

doordashMetricsRouter.post('/scrape', async (_req: Request, res: Response) => {
  try {
    const result = await (adapter as any).triggerScrape();
    res.json(result);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});

doordashMetricsRouter.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const agentUrl = process.env.DD_AGENT_URL || 'http://127.0.0.1:3460';
    const http = require('http');
    const data: any = await new Promise((resolve, reject) => {
      const req = http.get(`${agentUrl}/accounts`, (r: any) => {
        let body = '';
        r.on('data', (d: any) => body += d);
        r.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve([]); } });
      });
      req.on('error', reject);
    });
    res.json(data);
  } catch (err: any) {
    res.status(503).json({ error: err.message });
  }
});
