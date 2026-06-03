// ============================================================
// Agent OS - Control Plane - Kill Switch Routes
// Emergency stop for tasks, workers, and processes
// ============================================================

import { Router, Request, Response } from 'express';
import { taskQueue } from '../services/taskQueue';
import { workerDb } from '../services/database';
import { wsManager } from '../services/wsManager';
import { writeJournalEvent } from '../services/journal';

const router = Router();

/**
 * POST /api/kill/task/:id — Kill a running task
 */
router.post('/task/:id', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const task = taskQueue.getTask(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (task.status !== 'running' && task.status !== 'pending') {
    return res.status(400).json({ error: `Cannot kill task in status: ${task.status}` });
  }

  // Update task status
  taskQueue.updateTaskStatus(taskId, 'cancelled', 'Killed by CEO via kill switch');

  // Notify worker via WebSocket
  wsManager.broadcast({
    type: 'task_kill',
    payload: { taskId, workerId: task.workerId, reason: 'CEO kill switch' },
    timestamp: new Date().toISOString(),
  });
  writeJournalEvent({ type: 'kill_task', taskId, actor: 'ceo', data: { workerId: task.workerId } });

  res.json({
    success: true,
    message: `Task #${taskId.slice(0, 8)} killed.`,
    taskId,
  });
});

/**
 * POST /api/kill/worker/:id — Stop a worker
 */
router.post('/worker/:id', (req: Request, res: Response) => {
  const workerId = req.params.id;
  const worker = workerDb.findById(workerId);

  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  // Update worker status
  workerDb.updateStatus(workerId, 'stopped');

  // Send stop signal via WebSocket
  wsManager.broadcast({
    type: 'worker_stop',
    payload: { workerId, reason: 'CEO kill switch' },
    timestamp: new Date().toISOString(),
  });
  writeJournalEvent({ type: 'kill_worker', actor: 'ceo', data: { workerId, workerName: worker.name } });

  res.json({
    success: true,
    message: `Worker ${worker.name} stopped.`,
    workerId,
  });
});

/**
 * POST /api/kill/all — Emergency stop all workers and tasks
 */
router.post('/all', (req: Request, res: Response) => {
  // Kill all running tasks
  const tasks = taskQueue.getTasks();
  const killed: string[] = [];

  for (const task of tasks) {
    if (task.status === 'running' || task.status === 'pending') {
      taskQueue.updateTaskStatus(task.id, 'cancelled', 'Emergency stop by CEO');
      killed.push(task.id);
    }
  }

  // Stop all workers
  const workers = workerDb.findAll();
  for (const worker of workers) {
    if (worker.status === 'online' || worker.status === 'busy') {
      workerDb.updateStatus(worker.id, 'stopped');
    }
  }

  // Broadcast emergency stop
  wsManager.broadcast({
    type: 'emergency_stop',
    payload: { killedTasks: killed.length, stoppedWorkers: workers.length, reason: 'CEO emergency stop' },
    timestamp: new Date().toISOString(),
  });
  writeJournalEvent({ type: 'emergency_stop', actor: 'ceo', data: { killedTasks: killed, stoppedWorkers: workers.map((w: any) => w.id) } });

  res.json({
    success: true,
    message: `Emergency stop: ${killed.length} tasks killed, ${workers.length} workers stopped.`,
    killedTasks: killed.length,
    stoppedWorkers: workers.length,
  });
});

export default router;
