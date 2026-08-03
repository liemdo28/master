import express, { Request, Response, Router } from 'express';
import { CODING_ENGINE_REGISTRY } from '../coding/engine-registry';
import { selectCodingModelRoles } from '../coding/model-router';
import { CodingWorkflow, resolveEngineId } from '../coding/workflow';
import { codingResourceController } from '../coding/resource-control';
import { listModels, loadedModels, resolveOllamaEndpoint } from '../coding/llm/ollama-client';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';

export const codingJsonParser = express.json({ limit: '1mb' });

/** Bumped when the engine's observable contract changes. */
export const ENGINE_VERSION = '4.0.0';

export function createCodingRouter(store: TaskStore = new TaskStore()): Router {
  const router = Router();

  router.get('/engines', (_req: Request, res: Response) => {
    res.json({ engines: CODING_ENGINE_REGISTRY, activeEngineId: resolveEngineId(null) });
  });

  /** Active engine, its version, and whether the local model backend is reachable. */
  router.get('/engine', async (_req: Request, res: Response) => {
    const activeEngineId = resolveEngineId(null);
    const entry = CODING_ENGINE_REGISTRY.find(engine => engine.id === activeEngineId) ?? null;
    let endpoint: string | null = null;
    let installed: string[] = [];
    let reachable = false;
    let error: string | null = null;
    try {
      endpoint = resolveOllamaEndpoint();
      installed = await listModels();
      reachable = true;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    res.json({
      activeEngineId,
      engine: entry,
      engineVersion: ENGINE_VERSION,
      backend: { kind: 'ollama', endpoint, reachable, installedModels: installed, error },
      cloudFallbackEnabled: false,
    });
  });

  /** Model health: what is installed, what is resident, and the current role mapping. */
  router.get('/model-health', async (_req: Request, res: Response) => {
    try {
      const [installed, resident, modelRoles] = await Promise.all([
        listModels(),
        loadedModels(),
        selectCodingModelRoles(),
      ]);
      res.json({
        endpoint: resolveOllamaEndpoint(),
        installedModels: installed,
        residentModels: resident.map(model => ({
          name: model.name,
          vramGb: Number((model.vramBytes / 1e9).toFixed(2)),
          contextLength: model.contextLength,
        })),
        modelRoles,
        healthy: installed.length > 0,
      });
    } catch (err) {
      res.status(503).json({ healthy: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  /** Resource limits and current host pressure. */
  router.get('/resources', async (_req: Request, res: Response) => {
    res.json(await codingResourceController.health());
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
        engineId: typeof req.body?.engineId === 'string' ? req.body.engineId : null,
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

  router.post('/tasks/plan', async (req: Request, res: Response) => {
    const workflow = new CodingWorkflow(store);
    try {
      const result = await workflow.planTask({
        userRequest: String(req.body?.userRequest ?? ''),
        projectId: String(req.body?.projectId ?? ''),
        contextPackId: typeof req.body?.contextPackId === 'string' ? req.body.contextPackId : null,
        mapVersion: typeof req.body?.mapVersion === 'string' ? req.body.mapVersion : null,
        baseBranch: typeof req.body?.baseBranch === 'string' ? req.body.baseBranch : null,
        baseCommit: typeof req.body?.baseCommit === 'string' ? req.body.baseCommit : null,
        commitPolicy: req.body?.commitPolicy === 'no-commit' ? 'no-commit' : 'local-only',
        maxRetries: Number.isInteger(req.body?.maxRetries) ? req.body.maxRetries : undefined,
        engineId: typeof req.body?.engineId === 'string' ? req.body.engineId : null,
      });
      res.status(201).json({
        task: publicTask(result.task),
        candidates: result.candidates,
        plan: result.plan,
        modelRoles: result.modelRoles,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/tasks/:id/run', async (req: Request, res: Response) => {
    const workflow = new CodingWorkflow(store);
    try {
      const result = await workflow.resumeTask(req.params.id, Array.isArray(req.body?.validationCommands) ? req.body.validationCommands.map(String) : []);
      res.json({
        task: publicTask(result.task),
        commitSha: result.commitSha,
        review: result.review,
        validation: result.validation.map(item => ({ name: item.name, configured: item.configured, exitCode: item.exitCode, timedOut: item.timedOut })),
      });
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/tasks/:id/plan', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    res.json({
      plan: task.plan ? JSON.parse(task.plan) : null,
      candidates: task.candidateFiles ? JSON.parse(task.candidateFiles) : null,
      modelRoles: task.modelRoles ? JSON.parse(task.modelRoles) : null,
    });
  });

  router.get('/tasks/:id', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    res.json(publicTask(task));
  });

  /**
   * Engine progress for a task: current phase, engine, model, repair attempts,
   * recorded context expansions and the classified failure category if any.
   */
  router.get('/tasks/:id/progress', (req: Request, res: Response) => {
    const task = store.getTask(req.params.id);
    if (!task || task.taskKind !== 'coding') return res.status(404).json({ error: 'coding task not found' });
    const events = store.listEvents(req.params.id);

    const detailOf = (type: string): Record<string, unknown> | null => {
      const event = [...events].reverse().find(item => item.type === type);
      if (!event) return null;
      try {
        return JSON.parse(event.detail) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const expansions = events
      .filter(event => event.type === 'coding.context.expanded')
      .flatMap(event => {
        try {
          return ((JSON.parse(event.detail) as { expansions?: unknown[] }).expansions ?? []) as unknown[];
        } catch {
          return [];
        }
      });

    const repairs = events
      .filter(event => event.type === 'coding.repair.attempted')
      .map(event => {
        try {
          return JSON.parse(event.detail) as Record<string, unknown>;
        } catch {
          return {};
        }
      });

    res.json({
      taskId: task.id,
      status: task.status,
      engineId: task.codingEngine,
      engineVersion: ENGINE_VERSION,
      selectedModel: task.selectedModel,
      modelRoles: task.modelRoles ? JSON.parse(task.modelRoles) : null,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      reviewStatus: task.reviewStatus,
      commitSha: task.commitSha,
      failure: detailOf('coding.failure.classified'),
      contextExpansions: expansions,
      repairAttempts: repairs,
      repairAbandoned: detailOf('coding.repair.abandoned'),
      lastEvent: events.length ? { type: events[events.length - 1].type, at: events[events.length - 1].createdAt } : null,
    });
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
