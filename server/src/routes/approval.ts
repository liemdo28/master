import { Router, Request, Response } from 'express';
import { enqueue, approve, reject, getPending, getAll, getById, isAutoAllowed } from '../approval/gate';
import { denyAuthorityMutation, isLegacyExternalAction } from '../authority-control-plane/guard';

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
  const existing = getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found or not pending' });
  if (existing.status !== 'pending') return res.status(404).json({ error: 'Action not found or not pending' });
  if (isLegacyExternalAction(existing.category)) {
    return denyAuthorityMutation(
      res,
      `http:POST:/api/approval/${req.params.id}/approve`,
      `Legacy category "${existing.category}" must migrate to ControlledActionService; direct legacy execution is blocked.`,
    );
  }
  const action = approve(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found or not pending' });

  res.json(action);
});

approvalRouter.post('/:id/reject', (req: Request, res: Response) => {
  const action = reject(req.params.id);
  if (!action) return res.status(404).json({ error: 'Action not found or not pending' });
  res.json(action);
});
