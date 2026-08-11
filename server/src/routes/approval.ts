import { Router, Request, Response } from 'express';
import { getPending, getAll, getById } from '../approval/gate';
import { denyAuthorityMutation } from '../authority-control-plane/guard';
import { LegacyAuthorityAdapter, respondWithLegacyResult } from '../authority-control-plane/legacy-adapter';

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
  void before_state;
  void after_state;
  void rollback_plan;
  const adapter = new LegacyAuthorityAdapter();
  const result = adapter.adapt({
    surfaceId: 'http:POST:/api/approval/request',
    body: req.body ?? {},
    actor: 'legacy-approval-route',
    projectId: typeof req.body?.projectId === 'string' ? req.body.projectId : null,
  });
  return respondWithLegacyResult(res, result);
});

approvalRouter.post('/:id/approve', async (req: Request, res: Response) => {
  const existing = getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found or not pending' });
  if (existing.status !== 'pending') return res.status(404).json({ error: 'Action not found or not pending' });
  return denyAuthorityMutation(
    res,
    `http:POST:/api/approval/${req.params.id}/approve`,
    `Legacy approval category "${existing.category}" must migrate to ControlledActionService; direct legacy execution is blocked.`,
  );
});

approvalRouter.post('/:id/reject', (req: Request, res: Response) => {
  const existing = getById(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Action not found or not pending' });
  return denyAuthorityMutation(
    res,
    `http:POST:/api/approval/${req.params.id}/reject`,
    `Legacy approval category "${existing.category}" must migrate to ControlledActionService; direct legacy queue mutation is blocked.`,
  );
});
