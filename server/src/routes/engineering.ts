/**
 * Engineering Division API Routes
 * POST /api/engineering/dispatch   — CEO submits objective
 * GET  /api/engineering/tasks      — list queue
 * GET  /api/engineering/tasks/:id  — task detail
 * GET  /api/engineering/stats      — queue stats + model scoreboard
 * POST /api/engineering/review     — submit code for review
 */

import { Router, Request, Response } from 'express';
import { dispatch }      from '../engineering/engineering-orchestrator';
import { listTasks, getTask, getQueueStats } from '../engineering/engineering-queue';
import { reviewCode }    from '../engineering/review-engine';
import { classifyTask }  from '../engineering/task-classifier';
import { route }         from '../engineering/routing-engine';
import { getEvidence }   from '../engineering/evidence-engine';

export const engineeringRouter = Router();

// POST /api/engineering/dispatch
// Body: { objective, project?, code? }
engineeringRouter.post('/dispatch', async (req: Request, res: Response) => {
  const { objective, project, code } = req.body || {};
  if (!objective || typeof objective !== 'string') {
    return res.status(400).json({ error: 'objective is required' });
  }
  try {
    const result = await dispatch(objective.trim(), project || 'mi-core', code);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/engineering/tasks
engineeringRouter.get('/tasks', (req: Request, res: Response) => {
  const { status, model, limit } = req.query as any;
  const tasks = listTasks({ status, model, limit: limit ? parseInt(limit) : 50 });
  res.json({ tasks, count: tasks.length });
});

// GET /api/engineering/tasks/:id
engineeringRouter.get('/tasks/:id', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const evidence = getEvidence(req.params.id);
  res.json({ task, evidence });
});

// GET /api/engineering/stats
engineeringRouter.get('/stats', (_req: Request, res: Response) => {
  const queue_stats = getQueueStats();
  res.json({ queue_stats, generated_at: new Date().toISOString() });
});

// POST /api/engineering/classify
// Body: { objective }
engineeringRouter.post('/classify', (req: Request, res: Response) => {
  const { objective } = req.body || {};
  if (!objective) return res.status(400).json({ error: 'objective required' });
  const classification = classifyTask(objective);
  const routing = route(classification);
  res.json({ classification, routing });
});

// POST /api/engineering/review
// Body: { task_id, code, prior_code? }
engineeringRouter.post('/review', (req: Request, res: Response) => {
  const { task_id, code, prior_code } = req.body || {};
  if (!task_id || !code) return res.status(400).json({ error: 'task_id and code required' });
  const result = reviewCode(task_id, code, prior_code);
  res.json(result);
});
