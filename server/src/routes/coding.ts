import express, { Request, Response, Router } from 'express';
import { CODING_ENGINE_REGISTRY } from '../coding/engine-registry';
import { selectCodingModelRoles } from '../coding/model-router';
import { CodingWorkflow } from '../coding/workflow';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';

export const codingJsonParser = express.json({ limit: '1mb' });

export function createCodingRouter(store: TaskStore = new TaskStore()): Router {
  const router = Router();

  router.get('/engines', (_req: Request, res: Response) => {
    res.json({ engines: CODING_ENGINE_REGISTRY });
  });

  router.get('/model-roles', async (_req: Request, res: Response) => {
    const modelRoles = await selectCodingModelRoles();
    res.json({ modelRoles });
  });

  router.get('/models', async (_req: Request, res: Response) => {
    const modelRoles = await selectCodingModelRoles();
    res.json({ modelRoles });
  });

  router.post('/tasks', async (req: Request, res: Response) => {
    const workflow = new CodingWorkflow(store);
    try {
      const result = await workflow.run({
        userRequest: String(req.body?.userRequest ?? ''),
        projectId: String(req.body?.projectId ?? ''),
        contextPackId: typeof req.body?.contextPackId === 'string' ? req.body.contextPackId : null,
        mapVersion: typeof req.body?.mapVersion === 'string' ? req.body.mapVersion : null,
        baseBranch: typeof req.body?.baseBranch === 'string' ? req.body.baseBranch : null,
        baseCommit: typeof req.body?.baseCommit === 'string' ? req.body.baseCommit : null,
        commitPolicy: req.body?.commitPolicy === 'no-commit' ? 'no-commit' : 'local-only',
        maxRetries: Number.isInteger(req.body?.maxRetries) ? req.body.maxRetries : undefined,
      });
      res.status(201).json({
        task: publicTask(result.task),
        commitSha: result.commitSha,
        review: result.review,
        validation: result.validation.map(item => ({ name: item.name, configured: item.configured, exitCode: item.exitCode, timedOut: item.timedOut })),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    res.json(publicTask(task));
  });

  router.get('/tasks/:id/events', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    res.json(store.listEvents(req.params.id));
  });

  router.post('/tasks/:id/cancel', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    try {
      const engine = new TaskEngine(store);
      const cancelled = engine.cancelTask(req.params.id, typeof req.body?.reason === 'string' ? req.body.reason : 'Coding task cancelled.');
      res.json({ task: publicTask(cancelled) });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export const codingRouter = createCodingRouter();

function publicTask<T extends { workingDirectory: string | null; worktreePath?: string | null }>(task: T): T {
  return {
    ...task,
    workingDirectory: task.workingDirectory ? '[configured]' : null,
    worktreePath: task.worktreePath ? '[configured]' : null,
  };
}
