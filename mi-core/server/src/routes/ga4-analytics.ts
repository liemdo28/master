/**
 * Phase 33 — GA4 Revenue Intelligence Router
 * 
 * GET /api/analytics/traffic    — Live traffic from GA4
 * GET /api/analytics/pages      — Top pages from GA4
 * GET /api/analytics/conversions — Conversions from GA4
 * GET /api/analytics/status     — Connector status
 * POST /api/analytics/snapshot  — Trigger daily snapshot
 * GET /api/analytics/snapshots  — Stored snapshot data
 */
import { Router, Request, Response } from 'express';
import * as ga4 from '../seo/ga4-connector';

export const ga4AnalyticsRouter = Router();

// ── Status ──────────────────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const status = ga4.getStatus();
    res.json({ ok: true, ...status });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Live Traffic ────────────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/traffic', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  try {
    const data = await ga4.getTrafficOverview(days);
    res.json({ ok: true, source: 'GA4_LIVE', ...data });
  } catch (e: any) {
    res.status(503).json({
      ok: false,
      error: e.message,
      status: ga4.getStatus().status,
      next_step: ga4.getStatus().next_step,
    });
  }
});

// ── Traffic by Channel ──────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/channels', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  try {
    const data = await ga4.getTrafficByChannel(days);
    res.json({ ok: true, source: 'GA4_LIVE', ...data });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

// ── Top Pages ───────────────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/pages', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  try {
    const data = await ga4.getTopPages(days);
    res.json({ ok: true, source: 'GA4_LIVE', ...data });
  } catch (e: any) {
    res.status(503).json({
      ok: false,
      error: e.message,
      status: ga4.getStatus().status,
      next_step: ga4.getStatus().next_step,
    });
  }
});

// ── Conversions ─────────────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/conversions', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  try {
    const data = await ga4.getConversions(days);
    res.json({ ok: true, source: 'GA4_LIVE', ...data });
  } catch (e: any) {
    res.status(503).json({
      ok: false,
      error: e.message,
      status: ga4.getStatus().status,
      next_step: ga4.getStatus().next_step,
    });
  }
});

// ── Trigger Snapshot ────────────────────────────────────────────────────────
ga4AnalyticsRouter.post('/snapshot', async (_req: Request, res: Response) => {
  try {
    const result = await ga4.storeDailySnapshots();
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Stored Snapshots ────────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/snapshots', (_req: Request, res: Response) => {
  try {
    const dates = ga4.getSnapshotDates();
    const traffic = ga4.getLatestTraffic();
    const pages = ga4.getLatestPages(10);
    const conversions = ga4.getLatestConversions();
    res.json({
      ok: true,
      source: 'GA4_SNAPSHOTS',
      dates,
      latest_traffic: traffic,
      latest_pages: pages,
      latest_conversions: conversions,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Historical Traffic ──────────────────────────────────────────────────────
ga4AnalyticsRouter.get('/snapshots/traffic', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 90;
  try {
    const data = ga4.getHistoricalTraffic(days);
    res.json({ ok: true, source: 'GA4_SNAPSHOTS', ...data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Latest Channels from Snapshot ───────────────────────────────────────────
ga4AnalyticsRouter.get('/snapshots/channels', (_req: Request, res: Response) => {
  try {
    const data = ga4.getLatestChannels();
    res.json({ ok: true, source: 'GA4_SNAPSHOTS', ...data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Multi-brand: GET /api/analytics/brands ──────────────────────────────────
ga4AnalyticsRouter.get('/brands', (_req: Request, res: Response) => {
  res.json({
    brands: [
      { brand_id: 'bakudan',   name: 'Bakudan Ramen',  measurement_id: 'G-3GZ2RYDR6M', property_env: 'GA4_PROPERTY_ID_BAKUDAN' },
      { brand_id: 'raw_sushi', name: 'Raw Sushi Bar',  measurement_id: 'G-WNHH66NT41', property_env: 'GA4_PROPERTY_ID_RAW' },
    ],
    note: 'Set GA4_PROPERTY_ID_BAKUDAN and GA4_PROPERTY_ID_RAW in .env with numeric property IDs (properties/XXXXXXXXX) from GA4 Admin → Property Settings',
  });
});

// ── Per-brand traffic: GET /api/analytics/:brand/traffic ────────────────────
ga4AnalyticsRouter.get('/:brand/traffic', async (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const propertyId = ga4.getPropertyIdForBrand(req.params.brand);
  if (!propertyId) {
    res.status(503).json({ error: `GA4 property ID not configured for brand: ${req.params.brand}. Set GA4_PROPERTY_ID_${req.params.brand.toUpperCase()} in .env` });
    return;
  }
  try {
    const data = await ga4.getTrafficOverview(days, propertyId);
    res.json({ ok: true, brand: req.params.brand, property: propertyId, ...data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
