/**
 * Task Intelligence Router — Phase 16
 *
 * GET  /api/tasks/snapshot     — full operational snapshot
 * GET  /api/tasks/today        — Q1: today's tasks
 * GET  /api/tasks/waiting      — Q2: waiting for CEO
 * GET  /api/tasks/blockers     — Q3: open blockers
 * GET  /api/tasks/concerns     — Q4: concerns
 * GET  /api/tasks/team         — Q5: team activity
 * POST /api/tasks/query        — natural language dispatch (body: { question })
 */

import { Router, Request, Response } from 'express';
import { buildSnapshot } from './task-data-collector';
import {
  queryTodayTasks, queryPendingApprovals, queryWaitingForCeo,
  queryBlockers, queryConcerns, queryTeamActivity, dispatchTaskQuery,
} from './task-query-engine';

export const taskIntelligenceRouter = Router();

function ok(res: Response, data: unknown) {
  res.json({ success: true, data, timestamp: new Date().toISOString() });
}
function err(res: Response, message: string, status = 400) {
  res.status(status).json({ success: false, error: message });
}

taskIntelligenceRouter.get('/snapshot', (_req: Request, res: Response) => {
  try { ok(res, buildSnapshot()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/today', (_req: Request, res: Response) => {
  try { ok(res, queryTodayTasks()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/approvals', (_req: Request, res: Response) => {
  try { ok(res, queryPendingApprovals()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/waiting', (_req: Request, res: Response) => {
  try { ok(res, queryWaitingForCeo()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/blockers', (_req: Request, res: Response) => {
  try { ok(res, queryBlockers()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/concerns', (_req: Request, res: Response) => {
  try { ok(res, queryConcerns()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.get('/team', (_req: Request, res: Response) => {
  try { ok(res, queryTeamActivity()); }
  catch (e: any) { err(res, e.message, 500); }
});

taskIntelligenceRouter.post('/query', (req: Request, res: Response) => {
  const { question } = req.body || {};
  if (!question || typeof question !== 'string') {
    return err(res, 'body.question is required');
  }
  try {
    const answer = dispatchTaskQuery(question);
    if (!answer) {
      return err(res, 'Question not recognized as a task query. Use /api/gstack for AI-powered answers.', 422);
    }
    ok(res, answer);
  } catch (e: any) { err(res, e.message, 500); }
});
