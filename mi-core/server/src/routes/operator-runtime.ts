import { Router, Request, Response } from 'express';
import { operatorRuntime } from '../operator-runtime/index';
import { getStoredTasks, getStoredTask } from '../operator-runtime/task-store';
import { OperatorTaskInput } from '../operator-runtime/types';

export const operatorRuntimeRouter = Router();

// GET /health
operatorRuntimeRouter.get('/health', (_req: Request, res: Response) => {
  res.json(operatorRuntime.health());
});

// GET /capabilities
operatorRuntimeRouter.get('/capabilities', (_req: Request, res: Response) => {
  res.json(operatorRuntime.capabilities());
});

// POST /tasks/run
operatorRuntimeRouter.post('/tasks/run', async (req: Request, res: Response) => {
  try {
    const taskInput = req.body as OperatorTaskInput;
    const result = await operatorRuntime.runTask(taskInput);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /tasks/:id
operatorRuntimeRouter.get('/tasks/:id', (req: Request, res: Response) => {
  const task = getStoredTask(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
  res.json({ ok: true, task });
});

// GET /tasks/:id/evidence
operatorRuntimeRouter.get('/tasks/:id/evidence', (req: Request, res: Response) => {
  const task = getStoredTask(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
  // For now, return the evidence paths stored in the task record
  res.json({ ok: true, evidence: task.evidence });
});

// Dashboard API proof endpoints
operatorRuntimeRouter.get('/api/operator/health', (_req: Request, res: Response) => {
  res.json(operatorRuntime.health());
});

operatorRuntimeRouter.get('/api/operator/tasks', (_req: Request, res: Response) => {
  const tasks = getStoredTasks();
  res.json({ ok: true, tasks, count: tasks.length });
});

operatorRuntimeRouter.get('/api/operator/tasks/:id', (req: Request, res: Response) => {
  const task = getStoredTask(req.params.id);
  if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
  res.json({ ok: true, task });
});
