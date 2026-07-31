// Task runtime API — the permitted integration boundary for the Phase 1 task
// runtime (mi-core/server/src/task-runtime/). This file is NEW and additive.
//
// Mounted in index.ts at /api/task-runtime behind the backend's existing
// requireAuth and IP guard.

import { Router, Request, Response } from 'express';
import { TaskStore } from '../task-runtime/store';
import { TaskEngine, SAFE_COMMANDS, validateCommandInvocation } from '../task-runtime/engine';
import type { TaskStatus } from '../task-runtime/types';

export function createTaskRuntimeRouter(store: TaskStore = new TaskStore()): Router {
  const engine = new TaskEngine(store);
  const router = Router();
  const taskIdPattern = /^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  router.use((req, res, next) => {
    const contentLength = Number(req.get('content-length') || 0);
    if (contentLength > 1024 * 1024) return res.status(413).json({ error: 'request body too large' });
    next();
  });

  router.param('id', (req, res, next, id) => {
    if (!taskIdPattern.test(id)) return res.status(400).json({ error: 'invalid task id' });
    next();
  });

  // POST /tasks — create a task record only (CREATED state). Callers that just
  // want to track something without executing a command use this.
  router.post('/tasks', (req: Request, res: Response) => {
    const { userRequest, repository, workingDirectory, projectId } = req.body ?? {};
    if (typeof userRequest !== 'string' || !userRequest.trim()) {
      return res.status(400).json({ error: 'userRequest (string) is required' });
    }
    try {
      const task = engine.createTask({ userRequest, repository, workingDirectory, projectId });
      res.status(201).json(task);
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? String(err) });
    }
  });

  router.get('/tasks', (req: Request, res: Response) => {
    const status = req.query.status as TaskStatus | undefined;
    res.json(store.listTasks(status));
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  });

  router.get('/tasks/:id/events', (req: Request, res: Response) => {
    if (!store.getTask(req.params.id)) return res.status(404).json({ error: 'task not found' });
    res.json(store.listEvents(req.params.id));
  });

  // POST /tasks/:id/inspect — the Phase 1 acceptance-test scenario, exposed
  // over HTTP: walk the task through CONTEXT_BUILDING -> PLANNING -> READY ->
  // RUNNING, execute one allowlisted read-only command, capture evidence,
  // then VALIDATING -> COMPLETED. Intentionally narrow (allowlisted commands
  // only, execFileSync argv array, no shell interpolation) — see engine.ts.
  router.post('/tasks/:id/inspect', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'task not found' });

    const { command, args } = req.body ?? {};
    if (typeof command !== 'string' || !SAFE_COMMANDS.has(command)) {
      return res.status(400).json({ error: `command must be one of: ${[...SAFE_COMMANDS].join(', ')}` });
    }
    const argv = Array.isArray(args) ? args.map(String) : [];

    try {
      validateCommandInvocation(command, argv);
      engine.transition(task.id, 'CONTEXT_BUILDING');
      engine.transition(task.id, 'PLANNING');
      engine.transition(task.id, 'READY');
      engine.transition(task.id, 'RUNNING');
      const { evidencePath, exitCode } = engine.runCommandStep(task.id, command, argv);
      engine.transition(task.id, 'VALIDATING');
      const completed = engine.completeTask(task.id, `Ran ${command} ${argv.join(' ')} (exit ${exitCode})`);
      res.json({ task: completed, evidencePath, exitCode });
    } catch (err: any) {
      res.status(409).json({ error: err.message ?? String(err) });
    }
  });

  return router;
}

export const taskRuntimeRouter = createTaskRuntimeRouter();
