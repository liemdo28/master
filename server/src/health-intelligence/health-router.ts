import { Router, Request, Response } from 'express';
import { buildHealthSnapshot, formatHealthBriefing } from './health-intelligence-engine';

export const healthIntelligenceRouter = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data, timestamp: new Date().toISOString() });

healthIntelligenceRouter.get('/snapshot', (_req: Request, res: Response) => {
  try { ok(res, buildHealthSnapshot()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
healthIntelligenceRouter.get('/briefing', (_req: Request, res: Response) => {
  try { ok(res, { briefing: formatHealthBriefing(buildHealthSnapshot()) }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
