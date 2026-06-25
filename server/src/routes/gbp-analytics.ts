/**
 * Phase 34B — GBP Analytics Routes
 *
 * GET /api/gbp/status        — connector status + scope check
 * GET /api/gbp/locations     — list GBP locations
 * GET /api/gbp/metrics       — daily metrics for all locations (last 30d)
 * GET /api/gbp/metrics/:locationId — metrics for a specific location
 */

import { Router, Request, Response } from 'express';
import {
  getStatus,
  listLocations,
  getDailyMetrics,
  storeDailySnapshot,
  getStoredMetrics,
  getStoredLocations,
} from '../seo/gbp-connector';

export const gbpAnalyticsRouter = Router();

// GET /api/gbp/status
gbpAnalyticsRouter.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = getStatus();
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/gbp/locations
gbpAnalyticsRouter.get('/locations', async (_req: Request, res: Response) => {
  try {
    const status = getStatus();
    if (!status.configured) {
      return res.status(403).json(status);
    }
    const result = await listLocations();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/gbp/metrics — all locations, last 30d (from snapshot DB)
gbpAnalyticsRouter.get('/metrics', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string || '30', 10);
    // Try live fetch for all locations
    const status = getStatus();
    if (!status.configured) {
      // Fall back to stored snapshots
      const stored = getStoredMetrics(undefined, days);
      return res.json({ source: 'snapshot_db', re_auth_needed: true, ...stored });
    }

    const locResult = await listLocations();
    if (locResult.error || !locResult.locations?.length) {
      const stored = getStoredMetrics(undefined, days);
      return res.json({ source: 'snapshot_db', ...stored, locations_status: locResult });
    }

    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - days);
    const startDate = startDay.toISOString().slice(0, 10);

    const results: any[] = [];
    for (const loc of locResult.locations) {
      const m = await getDailyMetrics(loc.location_id, startDate, endDate);
      results.push({ location: loc, metrics: m });
    }

    res.json({
      source: 'live_api',
      period: { startDate, endDate },
      locations: results,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/gbp/metrics/:locationId
gbpAnalyticsRouter.get('/metrics/:locationId', async (req: Request, res: Response) => {
  try {
    const locationId = decodeURIComponent(req.params.locationId);
    const days = parseInt(req.query.days as string || '30', 10);

    const status = getStatus();
    if (!status.configured) {
      const stored = getStoredMetrics(locationId, days);
      return res.json({ source: 'snapshot_db', re_auth_needed: true, location_id: locationId, ...stored });
    }

    const today = new Date();
    const endDate = today.toISOString().slice(0, 10);
    const startDay = new Date(today);
    startDay.setDate(today.getDate() - days);
    const startDate = startDay.toISOString().slice(0, 10);

    const result = await getDailyMetrics(locationId, startDate, endDate);
    res.json({ source: 'live_api', ...result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/gbp/snapshot — trigger manual snapshot store
gbpAnalyticsRouter.post('/snapshot', async (_req: Request, res: Response) => {
  try {
    const result = await storeDailySnapshot();
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
