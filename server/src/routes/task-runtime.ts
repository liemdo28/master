// Task runtime API — the permitted integration boundary for the Phase 1 task
// runtime (mi-core/server/src/task-runtime/). This file is NEW and additive.
//
// Mounted in index.ts at /api/task-runtime behind the backend's existing
// requireAuth and IP guard.

import express, { Router, Request, Response, NextFunction } from 'express';
import { TaskStore } from '../task-runtime/store';
import { TaskEngine, SAFE_COMMANDS, validateCommandInvocation } from '../task-runtime/engine';
import type { TaskRecord, TaskStatus } from '../task-runtime/types';

export const taskRuntimeJsonParser = express.json({ limit: '1mb' });

export function taskRuntimeJsonErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === 'entity.too.large') return res.status(413).json({ error: 'request body too large' });
  if (e instanceof SyntaxError || e?.type === 'entity.parse.failed') return res.status(400).json({ error: 'malformed json' });
  next(err);
}

export function createTaskRuntimeRouter(store: TaskStore = new TaskStore()): Router {
  const engine = new TaskEngine(store);
  const router = Router();
  const taskIdPattern = /^task-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const evidenceIdPattern = /^step-\d+-command$/;

  router.param('id', (req, res, next, id) => {
    if (!taskIdPattern.test(id)) return res.status(400).json({ error: 'invalid task id' });
    next();
  });

  // POST /tasks — create a task record only (CREATED state). Callers that just
  // want to track something without executing a command use this.
  router.post('/tasks', (req: Request, res: Response) => {
    const { userRequest, repository, workingDirectory, projectId, taskKind, mapVersion, contextPackId } = req.body ?? {};
    if (typeof userRequest !== 'string' || !userRequest.trim()) {
      return res.status(400).json({ error: 'userRequest (string) is required' });
    }
    try {
      const task = engine.createTask({ userRequest, repository, workingDirectory, projectId, taskKind, mapVersion, contextPackId });
      res.status(201).json(publicTask(task));
    } catch (err: any) {
      res.status(400).json({ error: err.message ?? String(err) });
    }
  });

  router.get('/tasks', (req: Request, res: Response) => {
    const status = req.query.status as TaskStatus | undefined;
    res.json(store.listTasks(status).map(publicTask));
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(publicTask(task));
  });

  router.get('/tasks/:id/events', (req: Request, res: Response) => {
    if (!store.getTask(req.params.id)) return res.status(404).json({ error: 'task not found' });
    res.json(store.listEvents(req.params.id));
  });

  router.get('/tasks/:id/evidence/:evidenceId', (req: Request, res: Response) => {
    if (!evidenceIdPattern.test(req.params.evidenceId)) return res.status(400).json({ error: 'invalid evidence id' });
    if (!store.getTask(req.params.id)) return res.status(404).json({ error: 'task not found' });
    try {
      const { absolutePath } = store.evidencePathFor(req.params.id, req.params.evidenceId);
      res.sendFile(absolutePath, err => {
        if (err && !res.headersSent) res.status(404).json({ error: 'evidence not found' });
      });
    } catch {
      res.status(400).json({ error: 'invalid evidence path' });
    }
  });

  // POST /tasks/:id/inspect — the Phase 1 acceptance-test scenario, exposed
  // over HTTP: walk the task through CONTEXT_BUILDING -> PLANNING -> READY ->
  // RUNNING, execute one allowlisted read-only command, capture evidence,
  // then VALIDATING -> COMPLETED. Intentionally narrow (allowlisted commands
  // only, spawn argv array, no shell interpolation) — see engine.ts.
  router.post('/tasks/:id/inspect', async (req: Request, res: Response) => {
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
      const { evidenceId, relativePath, exitCode, signal } = await engine.runCommandStep(task.id, command, argv);
      const latestTask = store.getTask(task.id);
      if (latestTask?.status === 'CANCELLED') {
        return res.status(409).json({ task: publicTask(latestTask), evidenceId, relativePath, exitCode, signal, error: 'task cancelled' });
      }
      if (exitCode === 0) {
        engine.transition(task.id, 'VALIDATING');
        const completed = engine.completeTask(task.id, `Ran ${command} ${argv.join(' ')} (exit ${exitCode})`);
        return res.json({ task: publicTask(completed), evidenceId, relativePath, exitCode });
      }
      const failed = engine.failTask(task.id, `Command failed: ${command} ${argv.join(' ')} (exit ${exitCode})`);
      return res.status(422).json({ task: publicTask(failed), evidenceId, relativePath, exitCode, error: 'command execution failed' });
    } catch (err: any) {
      res.status(409).json({ error: err.message ?? String(err) });
    }
  });

  router.post('/tasks/:id/cancel', (req: Request, res: Response) => {
    if (!store.getTask(req.params.id)) return res.status(404).json({ error: 'task not found' });
    try {
      const cancelled = engine.cancelTask(req.params.id, typeof req.body?.reason === 'string' ? req.body.reason : undefined);
      res.json({ task: publicTask(cancelled) });
    } catch (err: any) {
      res.status(409).json({ error: err.message ?? String(err) });
    }
  });

  return router;
}

export const taskRuntimeRouter = createTaskRuntimeRouter();

function publicTask(task: TaskRecord): TaskRecord {
  return { ...task, workingDirectory: task.workingDirectory ? '[configured]' : null };
}
