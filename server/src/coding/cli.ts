import { ProjectRegistryService } from '../project-registry/service';
import { TaskEngine } from '../task-runtime/engine';
import { TaskStore } from '../task-runtime/store';
import { CodingWorkflow, resolveEngineId, INTERNAL_ENGINE_ID } from './workflow';
import { LLM_ENGINE_ID } from './llm/engine';
import { codingResourceController } from './resource-control';

const USAGE = `Usage: coding <command>

  engines                              list coding engines and the active selection
  engine                               show the active engine, version and backend health
  models                               show resolved model roles
  model-health                         show installed/resident models and endpoint
  resources                            show resource limits and current host pressure

  plan <projectId> <packId> <request>  plan a task without applying it
  run <projectId> <packId> <request>   plan and run a task to a local commit
  resume <taskId>                      continue an interrupted task
  progress <taskId>                    show phase, model, repairs and failure category
  follow <taskId>                      poll progress until the task settles
  cancel <taskId> [reason]             cancel a running task
  evidence <taskId>                    print recorded events and evidence pointers

Engine selection: --engine=<id> on plan/run, or MI_CODING_ENGINE.
Known engines: ${LLM_ENGINE_ID} (default), ${INTERNAL_ENGINE_ID}.
There is no push command in this phase.`;

function argValue(flag: string): string | null {
  const match = process.argv.find(arg => arg.startsWith(`--${flag}=`));
  return match ? match.slice(flag.length + 3) : null;
}

function positional(): string[] {
  return process.argv.slice(3).filter(arg => !arg.startsWith('--'));
}

function print(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

async function progressFor(taskId: string, store: TaskStore): Promise<Record<string, unknown>> {
  const task = store.getTask(taskId);
  if (!task || task.taskKind !== 'coding') throw new Error(`coding task not found: ${taskId}`);
  const events = store.listEvents(taskId);
  const latest = (type: string): unknown => {
    const event = [...events].reverse().find(item => item.type === type);
    if (!event) return null;
    try {
      return JSON.parse(event.detail);
    } catch {
      return null;
    }
  };
  return {
    taskId: task.id,
    status: task.status,
    engineId: task.codingEngine,
    selectedModel: task.selectedModel,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    reviewStatus: task.reviewStatus,
    commitSha: task.commitSha,
    failure: latest('coding.failure.classified'),
    repairAbandoned: latest('coding.repair.abandoned'),
    contextExpansions: events.filter(event => event.type === 'coding.context.expanded').length,
    lastEvent: events.length ? events[events.length - 1].type : null,
  };
}

const SETTLED = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

async function main(): Promise<void> {
  const cmd = process.argv[2];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(USAGE);
    return;
  }

  if (cmd === 'engines') {
    const { CODING_ENGINE_REGISTRY } = await import('./engine-registry');
    print({ activeEngineId: resolveEngineId(null), engines: CODING_ENGINE_REGISTRY });
    return;
  }

  if (cmd === 'engine') {
    const { listModels, resolveOllamaEndpoint } = await import('./llm/ollama-client');
    const { CODING_ENGINE_REGISTRY } = await import('./engine-registry');
    const activeEngineId = resolveEngineId(null);
    let backend: Record<string, unknown>;
    try {
      backend = { kind: 'ollama', endpoint: resolveOllamaEndpoint(), reachable: true, installedModels: await listModels() };
    } catch (err) {
      backend = { kind: 'ollama', reachable: false, error: err instanceof Error ? err.message : String(err) };
    }
    print({
      activeEngineId,
      engine: CODING_ENGINE_REGISTRY.find(engine => engine.id === activeEngineId) ?? null,
      backend,
      cloudFallbackEnabled: false,
    });
    return;
  }

  if (cmd === 'models' || cmd === 'model-roles') {
    const { selectCodingModelRoles } = await import('./model-router');
    print(await selectCodingModelRoles());
    return;
  }

  if (cmd === 'model-health') {
    const { listModels, loadedModels, resolveOllamaEndpoint } = await import('./llm/ollama-client');
    const { selectCodingModelRoles } = await import('./model-router');
    print({
      endpoint: resolveOllamaEndpoint(),
      installedModels: await listModels(),
      residentModels: (await loadedModels()).map(model => ({
        name: model.name,
        vramGb: Number((model.vramBytes / 1e9).toFixed(2)),
      })),
      modelRoles: await selectCodingModelRoles(),
    });
    return;
  }

  if (cmd === 'resources') {
    print(await codingResourceController.health());
    return;
  }

  if (cmd === 'plan' || cmd === 'run') {
    const [projectId, contextPackId, ...requestParts] = positional();
    const userRequest = requestParts.join(' ');
    if (!projectId || !contextPackId || !userRequest) {
      throw new Error(`Usage: coding ${cmd} <projectId> <contextPackId> <request> [--engine=<id>]`);
    }
    const service = new ProjectRegistryService();
    const project = service.getProject(projectId);
    if (!project) throw new Error(`project not found: ${projectId}`);

    const workflow = new CodingWorkflow(undefined, service);
    const input = {
      projectId,
      contextPackId,
      mapVersion: project.mapVersion,
      userRequest,
      commitPolicy: 'local-only' as const,
      engineId: argValue('engine'),
    };

    if (cmd === 'plan') {
      const planned = await workflow.planTask(input);
      print({
        taskId: planned.task.id,
        status: planned.task.status,
        engineId: planned.task.codingEngine,
        modelRoles: planned.modelRoles,
        candidates: planned.candidates.candidates.map(candidate => candidate.path),
        plan: planned.plan,
      });
    } else {
      const result = await workflow.run(input);
      print({
        taskId: result.task.id,
        status: result.task.status,
        engineId: result.task.codingEngine,
        selectedModel: result.task.selectedModel,
        filesChanged: result.apply.changedFiles,
        validation: result.validation.map(item => ({ name: item.name, configured: item.configured, exitCode: item.exitCode })),
        review: result.review,
        commitSha: result.commitSha,
      });
    }
    workflow.close();
    return;
  }

  if (cmd === 'resume') {
    const [taskId] = positional();
    if (!taskId) throw new Error('Usage: coding resume <taskId>');
    const workflow = new CodingWorkflow();
    const result = await workflow.resumeTask(taskId);
    print({
      taskId: result.task.id,
      status: result.task.status,
      review: result.review,
      commitSha: result.commitSha,
    });
    workflow.close();
    return;
  }

  if (cmd === 'progress') {
    const [taskId] = positional();
    if (!taskId) throw new Error('Usage: coding progress <taskId>');
    const store = new TaskStore();
    print(await progressFor(taskId, store));
    store.close();
    return;
  }

  if (cmd === 'follow') {
    const [taskId] = positional();
    if (!taskId) throw new Error('Usage: coding follow <taskId>');
    const store = new TaskStore();
    let lastSerialized = '';
    for (;;) {
      const snapshot = await progressFor(taskId, store);
      const serialized = JSON.stringify(snapshot);
      if (serialized !== lastSerialized) {
        console.log(serialized);
        lastSerialized = serialized;
      }
      if (SETTLED.has(String(snapshot.status))) break;
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    store.close();
    return;
  }

  if (cmd === 'cancel') {
    const [taskId, ...reasonParts] = positional();
    if (!taskId) throw new Error('Usage: coding cancel <taskId> [reason]');
    const store = new TaskStore();
    const cancelled = new TaskEngine(store).cancelTask(taskId, reasonParts.join(' ') || 'Cancelled from CLI.');
    print({ taskId: cancelled.id, status: cancelled.status });
    store.close();
    return;
  }

  if (cmd === 'evidence') {
    const [taskId] = positional();
    if (!taskId) throw new Error('Usage: coding evidence <taskId>');
    const store = new TaskStore();
    const task = store.getTask(taskId);
    if (!task || task.taskKind !== 'coding') throw new Error(`coding task not found: ${taskId}`);
    print({
      taskId,
      engineId: task.codingEngine,
      selectedModel: task.selectedModel,
      commitSha: task.commitSha,
      reviewStatus: task.reviewStatus,
      events: store.listEvents(taskId).map(event => ({ type: event.type, at: event.createdAt, detail: event.detail.slice(0, 400) })),
    });
    store.close();
    return;
  }

  throw new Error(`Unknown command: ${cmd}\n\n${USAGE}`);
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
