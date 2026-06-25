/**
 * Engineering Division OS Routes
 * POST /api/engineering/dispatch      — classify + route + create task
 * GET  /api/engineering/tasks         — list tasks
 * GET  /api/engineering/tasks/:id     — get task by id
 * GET  /api/engineering/stats         — queue stats
 * POST /api/engineering/classify      — classify only (dry run)
 * POST /api/engineering/review        — review submitted code
 */

import { Router, Request, Response } from 'express';
import { dispatch }    from '../engineering/engineering-orchestrator';
import { getTasks, getTask, getStats } from '../engineering/engineering-queue';
import { classifyTask } from '../engineering/task-classifier';
import { reviewCode }   from '../engineering/review-engine';

export const engineeringRouter = Router();

// ── Dispatch ──────────────────────────────────────────────────────────────────
engineeringRouter.post('/dispatch', async (req: Request, res: Response) => {
  const { objective, project, code } = req.body || {};
  if (!objective) return res.status(400).json({ error: 'objective required' });
  try {
    const result = await dispatch(objective, project || 'mi-core', code);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
engineeringRouter.get('/tasks', (_req: Request, res: Response) => {
  try {
    res.json({ tasks: getTasks(50) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

engineeringRouter.get('/tasks/:id', (req: Request, res: Response) => {
  try {
    const task = getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'not found' });
    res.json(task);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

engineeringRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    res.json(getStats());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Classify (dry run) ────────────────────────────────────────────────────────
engineeringRouter.post('/classify', (req: Request, res: Response) => {
  const { objective } = req.body || {};
  if (!objective) return res.status(400).json({ error: 'objective required' });
  res.json(classifyTask(objective));
});

// ── Review ────────────────────────────────────────────────────────────────────
engineeringRouter.post('/review', async (req: Request, res: Response) => {
  const { task_id, code, prior_code } = req.body || {};
  if (!task_id || !code) return res.status(400).json({ error: 'task_id and code required' });
  try {
    const result = await reviewCode(task_id, code, prior_code);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
