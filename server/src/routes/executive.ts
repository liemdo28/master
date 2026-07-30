import { Router, Request, Response } from 'express';
import { classifyExecutiveIntent, getExecutiveSnapshot } from '../executive/executive-snapshot';

export const executiveRouter = Router();

executiveRouter.get('/snapshot', async (_req: Request, res: Response) => {
  try {
    res.json(await getExecutiveSnapshot());
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message : String(e),
      target: 'WHATSAPP_DATA_SOURCE_CERTIFIED',
    });
  }
});

executiveRouter.get('/intent', (req: Request, res: Response) => {
  const message = String(req.query.message || req.query.q || '');
  res.json({
    message,
    intent: classifyExecutiveIntent(message),
    labels: ['graph_lookup', 'operational_status', 'action_request', 'marketing_request', 'finance_request', 'connector_check'],
  });
});
