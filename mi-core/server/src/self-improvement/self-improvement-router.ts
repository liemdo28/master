import { Router, Request, Response } from 'express';
import { generateSelfImprovementReport, getSkillEffectiveness, getOwnerPerformance, getWorkflowPatterns } from './self-improvement-engine';

export const selfImprovementRouter = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data, timestamp: new Date().toISOString() });

selfImprovementRouter.get('/report', (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  try { ok(res, generateSelfImprovementReport(days)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
selfImprovementRouter.get('/skills', (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  try { ok(res, getSkillEffectiveness(days)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
selfImprovementRouter.get('/owners', (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  try { ok(res, getOwnerPerformance(days)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
selfImprovementRouter.get('/workflows', (req: Request, res: Response) => {
  const days = parseInt(String(req.query.days || '30'));
  try { ok(res, getWorkflowPatterns(days)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
