/**
 * Executive Briefing Router — Phase 17
 *
 * GET  /api/briefing/latest   — last generated briefing
 * POST /api/briefing/generate — generate + send now (manual trigger)
 * GET  /api/briefing/status   — scheduler status
 */

import { Router, Request, Response } from 'express';
import { generateExecutiveDailyBriefing, generateExecutiveDailyBriefingFull, getLastBriefing } from './briefing-engine';
import { queueToCeo } from '../services/whatsapp-sender';

export const briefingRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, message: string, status = 500) {
  res.status(status).json({ success: false, error: message });
}

briefingRouter.get('/latest', (_req: Request, res: Response) => {
  try {
    const last = getLastBriefing();
    if (!last) return err(res, 'No briefing generated yet. POST /api/briefing/generate to create one.', 404);
    ok(res, last);
  } catch (e: any) { err(res, e.message); }
});

briefingRouter.post('/generate', async (_req: Request, res: Response) => {
  try {
    const briefing = await generateExecutiveDailyBriefingFull();
    queueToCeo(briefing.full_text);
    ok(res, { briefing_id: briefing.briefing_id, severity: briefing.severity, sent: true });
  } catch (e: any) { err(res, e.message); }
});

briefingRouter.get('/status', (_req: Request, res: Response) => {
  try {
    const { getDailyBriefingStatus } = require('../jarvis/daily-briefing-scheduler');
    ok(res, getDailyBriefingStatus());
  } catch (e: any) { err(res, e.message); }
});
