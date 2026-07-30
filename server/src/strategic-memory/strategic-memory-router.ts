/**
 * Strategic Memory Router — Phase 18
 *
 * GET /api/strategic/summary?days=90
 * GET /api/strategic/monthly?months=6
 * GET /api/strategic/owner/:role?days=180
 * GET /api/strategic/blockers?days=90&top=5
 * GET /api/strategic/trends?months=6
 */

import { Router, Request, Response } from 'express';
import { getStrategicSummary, getMonthlySnapshots, getOwnerHistory, getTopBlockerProjects } from './strategic-memory-engine';
import { analyzeTemporalTrends } from './temporal-trend-engine';

export const strategicMemoryRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, msg: string, status = 500) {
  res.status(status).json({ success: false, error: msg });
}

strategicMemoryRouter.get('/summary', (req: Request, res: Response) => {
  try {
    const days = parseInt(String(req.query.days || '90'));
    ok(res, getStrategicSummary(days));
  } catch (e: any) { err(res, e.message); }
});

strategicMemoryRouter.get('/monthly', (req: Request, res: Response) => {
  try {
    const months = parseInt(String(req.query.months || '6'));
    ok(res, getMonthlySnapshots(months));
  } catch (e: any) { err(res, e.message); }
});

strategicMemoryRouter.get('/owner/:role', (req: Request, res: Response) => {
  try {
    const days = parseInt(String(req.query.days || '180'));
    ok(res, getOwnerHistory(req.params.role, days));
  } catch (e: any) { err(res, e.message); }
});

strategicMemoryRouter.get('/blockers', (req: Request, res: Response) => {
  try {
    const days = parseInt(String(req.query.days || '90'));
    const top = parseInt(String(req.query.top || '5'));
    ok(res, getTopBlockerProjects(days, top));
  } catch (e: any) { err(res, e.message); }
});

strategicMemoryRouter.get('/trends', (req: Request, res: Response) => {
  try {
    const months = parseInt(String(req.query.months || '6'));
    ok(res, analyzeTemporalTrends(months));
  } catch (e: any) { err(res, e.message); }
});
