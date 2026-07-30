import { Router, Request, Response } from 'express';
import { enqueue, approve, reject, getPending, getAll, getById, isAutoAllowed, markExecuted } from '../approval/gate';
import { executeApprovedAction } from '../actions/google-executor';

export const approvalRouter = Router();

approvalRouter.get('/', (_req: Request, res: Response) => {
  res.json(getAll());
});

approvalRouter.get('/pending', (_req: Request, res: Response) => {
  res.json(getPending());
});

approvalRouter.get('/:id', (req: Request, res: Response) => {
  const action = getById(req.params.id);
  if (!action) return res.status(404).json({ error: 'Not found' });
  res.json(action);
});

approvalRouter.post('/request', (req: Request, res: Response) => {
  const { risk_level, category, description, target, before_state, after_state, rollback_plan } = req.body;
  if (!risk_level || !category || !description || !target) {
    return res.status(400).json({ error: 'risk_level, category, description, target required' });
  }
  if (isAutoAllowed(category)) {
    return res.json({ auto_allowed: true, category });
  }
  const action = enqueue({ risk_level, category, description, target, before_state, after_state, rollback_plan });
  res.status(201).json(action);
});

approvalRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const action = approve(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found or not pending' });

  // If fully approved (L2 single / L3 double), execute immediately
  if (action.status === 'approved' && action.category && action.after_state) {
    try {
      const payload = JSON.parse(action.after_state);
      const result = await executeApprovedAction(action.category, payload);
      markExecuted(action.id, result.detail || result.error);
      return res.json({ ...action, execution: result });
    } catch (e) {
      return res.json({ ...action, execution: { success: false, error: String(e) } });
    }
  }

  res.json(action);
});

approvalRouter.post('/:id/reject', (req: Request, res: Response) => {
  const action = reject(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found or not pending' });
  res.json(action);
});
