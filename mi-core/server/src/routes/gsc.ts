import { Router, Request, Response } from 'express';
import * as gsc from '../seo/google-search-console-connector';

export const gscRouter = Router();

function dateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// Status check
gscRouter.get('/status', async (_req: Request, res: Response) => {
  const configured = gsc.isConfigured();
  let token_valid = false;
  if (configured) {
    try { await gsc.listSites(); token_valid = true; } catch { token_valid = false; }
  }
  const status = !configured ? 'BLOCKED_BY_GOOGLE_CREDENTIALS' : token_valid ? 'GSC_CONNECTOR_READY' : 'TOKEN_EXPIRED';
  res.json({
    ok: token_valid,
    status,
    has_client_id: !!process.env.GOOGLE_CLIENT_ID,
    has_client_secret: !!process.env.GOOGLE_CLIENT_SECRET,
    has_token_file: configured,
    token_valid,
    next_step: token_valid ? null : 'Visit http://localhost:4001/api/auth/google/start in browser to re-authorize Google (includes webmasters.readonly scope)',
  });
});

// Sites
gscRouter.get('/sites', async (_req: Request, res: Response) => {
  try {
    const sites = await gsc.listSites();
    res.json({ ok: true, sites, count: sites.length });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e.message, status: 'BLOCKED_BY_GOOGLE_CREDENTIALS' });
  }
});

// Summary for a site
gscRouter.get('/:site/summary', async (req: Request, res: Response) => {
  const siteUrl = decodeURIComponent(req.params.site);
  const days = parseInt(req.query.days as string) || 7;
  const { startDate, endDate } = dateRange(days);
  try {
    const [summary, topQueries, topPages, sitemaps] = await Promise.all([
      gsc.getSummary(siteUrl, startDate, endDate),
      gsc.getTopQueries(siteUrl, startDate, endDate),
      gsc.getTopPages(siteUrl, startDate, endDate),
      gsc.getSitemaps(siteUrl),
    ]);
    res.json({ ok: true, ...summary, top_queries: topQueries.slice(0, 5), top_pages: topPages.slice(0, 5), sitemaps });
  } catch (e: any) {
    const pending = e.message?.includes('does not have any data') || e.message?.includes('403');
    res.json({ ok: true, siteUrl, status: pending ? 'VERIFIED_BUT_DATA_PENDING' : 'error', error: e.message });
  }
});

// Top queries
gscRouter.get('/:site/top-queries', async (req: Request, res: Response) => {
  const siteUrl = decodeURIComponent(req.params.site);
  const days = parseInt(req.query.days as string) || 7;
  const { startDate, endDate } = dateRange(days);
  try {
    const queries = await gsc.getTopQueries(siteUrl, startDate, endDate);
    res.json({ ok: true, siteUrl, period: { startDate, endDate }, queries });
  } catch (e: any) {
    res.json({ ok: true, siteUrl, status: 'VERIFIED_BUT_DATA_PENDING', error: e.message, queries: [] });
  }
});

// Top pages
gscRouter.get('/:site/top-pages', async (req: Request, res: Response) => {
  const siteUrl = decodeURIComponent(req.params.site);
  const days = parseInt(req.query.days as string) || 7;
  const { startDate, endDate } = dateRange(days);
  try {
    const pages = await gsc.getTopPages(siteUrl, startDate, endDate);
    res.json({ ok: true, siteUrl, period: { startDate, endDate }, pages });
  } catch (e: any) {
    res.json({ ok: true, siteUrl, status: 'VERIFIED_BUT_DATA_PENDING', error: e.message, pages: [] });
  }
});

// Sitemaps
gscRouter.get('/:site/sitemaps', async (req: Request, res: Response) => {
  const siteUrl = decodeURIComponent(req.params.site);
  try {
    const sitemaps = await gsc.getSitemaps(siteUrl);
    res.json({ ok: true, siteUrl, sitemaps });
  } catch (e: any) {
    res.json({ ok: true, siteUrl, status: 'VERIFIED_BUT_DATA_PENDING', error: e.message, sitemaps: [] });
  }
});
