import { Router, Request, Response } from 'express';
import { simulateFailure, simulateOwnerAbsence, getAllTwinEntities } from './digital-twin-engine';

export const digitalTwinRouter = Router();
const ok = (res: Response, data: unknown) => res.json({ success: true, data, timestamp: new Date().toISOString() });

digitalTwinRouter.get('/entities', (_req: Request, res: Response) => {
  try { ok(res, getAllTwinEntities()); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
digitalTwinRouter.get('/simulate/failure/:entity', (req: Request, res: Response) => {
  try { ok(res, simulateFailure(req.params.entity)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
digitalTwinRouter.get('/simulate/absence/:role', (req: Request, res: Response) => {
  try { ok(res, simulateOwnerAbsence(req.params.role)); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
digitalTwinRouter.post('/simulate', (req: Request, res: Response) => {
  const { type = 'failure', target } = req.body || {};
  if (!target) return res.status(400).json({ error: 'body.target required' });
  try {
    ok(res, type === 'absence' ? simulateOwnerAbsence(target) : simulateFailure(target));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
