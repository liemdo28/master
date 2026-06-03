// ============================================================
// Agent OS - Control Plane - Task Routes
// ============================================================

import { Router, Request, Response } from 'express';
import { taskQueue } from '../services/taskQueue';
import { taskDb, taskLogDb, artifactDb, workerDb } from '../services/database';
import { TaskType, TaskPriority } from '../types';
import { writeJournalEvent } from '../services/journal';

const router = Router();

// Get all tasks
router.get('/', (req: Request, res: Response) => {
  const { status } = req.query;
  const tasks = taskQueue.getTasks(status as string);
  res.json({ tasks });
});

// Get task by ID
router.get('/:id', (req: Request, res: Response) => {
  const task = taskQueue.getTask(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json({ task });
});

// Create new task
router.post('/', (req: Request, res: Response) => {
  const { type, project, priority, payload } = req.body;

  if (!type || !project) {
    return res.status(400).json({ error: 'type and project are required' });
  }

  const validTypes = Object.values(TaskType);
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
  }

  const task = taskQueue.createTask({
    type,
    project,
    priority: priority || TaskPriority.MEDIUM,
    payload,
    createdBy: req.headers['x-user-id'] as string || 'ceo',
  });

  res.status(201).json({ task });
});

// Cancel task
router.post('/:id/cancel', (req: Request, res: Response) => {
  const success = taskQueue.cancelTask(req.params.id);
  if (!success) {
    return res.status(400).json({ error: 'Cannot cancel task' });
  }
  res.json({ success: true });
});

// Retry task
router.post('/:id/retry', (req: Request, res: Response) => {
  const task = taskQueue.retryTask(req.params.id);
  if (!task) {
    return res.status(400).json({ error: 'Cannot retry task' });
  }
  res.json({ task });
});

// Worker progress update
router.post('/:id/progress', (req: Request, res: Response) => {
  const task = taskDb.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.worker_id) {
    const worker = workerDb.findById(task.worker_id);
    const token = req.headers['x-worker-token'] as string;
    if (!worker || worker.token !== token) {
      return res.status(401).json({ error: 'Invalid worker token' });
    }
  }

  taskQueue.addLog(req.params.id, 'info', req.body.message || 'Progress update', {
    progress: req.body.progress,
  });
  writeJournalEvent({ type: 'task_progress', taskId: req.params.id, project: task.project, data: req.body });
  res.json({ success: true });
});

// Worker completion callback
router.post('/:id/complete', (req: Request, res: Response) => {
  const task = taskDb.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.worker_id) {
    const worker = workerDb.findById(task.worker_id);
    const token = req.headers['x-worker-token'] as string;
    if (!worker || worker.token !== token) {
      return res.status(401).json({ error: 'Invalid worker token' });
    }
  }

  for (const log of req.body.logs || []) {
    taskQueue.addLog(req.params.id, log.level || 'info', log.message || '', log.data);
  }

  const payload = req.body.payload ?? null;
  if (payload !== null) {
    taskDb.setResultPayload(req.params.id, payload);
  }

  taskQueue.completeTask(req.params.id, Boolean(req.body.success), req.body.error, payload);
  res.json({ success: true });
});

// Get task logs
router.get('/:id/logs', (req: Request, res: Response) => {
  const task = taskDb.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const logs = taskLogDb.findByTaskId(req.params.id);
  res.json({ logs: logs.map((l: any) => ({
    id: l.id,
    taskId: l.task_id,
    timestamp: l.timestamp,
    level: l.level,
    message: l.message,
    data: l.data ? JSON.parse(l.data) : null,
  }))});
});

// Get task artifacts
router.get('/:id/artifacts', (req: Request, res: Response) => {
  const task = taskDb.findById(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  const artifacts = artifactDb.findByTaskId(req.params.id);
  res.json({ artifacts });
});

export default router;
