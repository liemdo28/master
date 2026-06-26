import { Router, Request, Response } from 'express';
import { buildWorkflowFabricStatus } from '../workflow-fabric/workflow-dashboard';
import { logWorkflowExecution } from '../workflow-fabric/workflow-log-service';

export const workflowFabricRouter = Router();

workflowFabricRouter.get('/status', (_req: Request, res: Response) => {
  try {
    res.json({ ok: true, status: buildWorkflowFabricStatus() });
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});

workflowFabricRouter.post('/log', (req: Request, res: Response) => {
  try {
    const result = logWorkflowExecution(req.body);
    if (!result.ok) return res.status(result.statusCode).json(result);
    res.json(result);
  } catch (error) {
    res.status(500).json({ ok: false, error: String(error) });
  }
});
