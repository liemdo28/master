// ============================================================
// Agent OS - Approval Routes
// ============================================================

import { Router, Request, Response } from 'express';
import {
  approveTask,
  denyTask,
  getAllApprovals,
  getApprovalForTask,
  getPendingApprovals,
} from '../services/approvalEngine';
import { taskQueue } from '../services/taskQueue';
import { writeDecision, writeJournalEvent } from '../services/journal';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  res.json({ approvals: getAllApprovals() });
});

router.get('/pending', (_req: Request, res: Response) => {
  res.json({ approvals: getPendingApprovals() });
});

router.get('/task/:taskId', (req: Request, res: Response) => {
  res.json({ approval: getApprovalForTask(req.params.taskId) });
});

router.post('/task/:taskId/approve', (req: Request, res: Response) => {
  const actor = (req.headers['x-user-id'] as string) || req.body.actor || 'ceo';
  const approval = approveTask(req.params.taskId, actor);
  if (!approval) {
    return res.status(404).json({ error: 'Pending approval not found' });
  }

  taskQueue.approveTask(req.params.taskId);
  const decisionPath = writeDecision({
    taskId: req.params.taskId,
    decision: 'approved',
    reason: req.body.reason || 'CEO approved task execution.',
    actor,
    risk: approval.riskLevel,
    rollbackPlan: req.body.rollbackPlan,
  });
  writeJournalEvent({ type: 'approval_approved', taskId: req.params.taskId, actor, risk: approval.riskLevel, data: { decisionPath } });

  res.json({ approval, decisionPath });
});

router.post('/task/:taskId/deny', (req: Request, res: Response) => {
  const actor = (req.headers['x-user-id'] as string) || req.body.actor || 'ceo';
  const reason = req.body.reason || 'CEO denied task execution.';
  const approval = denyTask(req.params.taskId, actor, reason);
  if (!approval) {
    return res.status(404).json({ error: 'Pending approval not found' });
  }

  taskQueue.updateTaskStatus(req.params.taskId, 'cancelled', reason);
  const decisionPath = writeDecision({
    taskId: req.params.taskId,
    decision: 'denied',
    reason,
    actor,
    risk: approval.riskLevel,
    rollbackPlan: 'No execution occurred. No rollback required.',
  });
  writeJournalEvent({ type: 'approval_denied', taskId: req.params.taskId, actor, risk: approval.riskLevel, data: { decisionPath } });

  res.json({ approval, decisionPath });
});

export default router;
