import { Router, Request, Response } from 'express';
import { providerRouter } from '../providers/provider-router';
import { addMemory, searchMemory, summarizeMemory, syncMemory } from '../memory/memory-router';
import { cancelJob, claimNextJob, completeJob, enqueueJob, failJob, getQueueJob, listQueueJobs, queueStats, retryJob } from '../queue/job-queue';
import { isPostgresAvailable } from '../bigdata/db-client';
import { isMinioAvailable } from '../bigdata/minio-client';
import { isQdrantAvailable } from '../bigdata/memory-indexer';
import {
  buildOmegaBriefing,
  getPriorityPlan,
  getProgramPhase,
  getProgramRuntimeStatus,
  listProgramPhases,
} from '../enterprise-v6/program-runtime';
import {
  answerEnterpriseBrainQuestion,
  getEnterpriseBrainConnectorLayer,
  getEnterpriseBrainOntology,
  getEnterpriseBrainSnapshot,
  getEnterpriseBrainStatus,
  listEnterpriseBrainDomains,
  runEnterpriseBrainAcceptance,
} from '../enterprise-v6/enterprise-brain-v4';
import {
  answerHealthQuestion,
  answerUniversalConnectorQuestion,
  certifyGoogleConnectorRuntime,
  certifyHealthRuntime,
  certifyUniversalConnectorProof,
  finalEnterpriseBrainV4Certification,
  importHealthDataFromFile,
} from '../enterprise-v6/enterprise-brain-v4-closeout';

export const enterpriseRouter = Router();

function runtimeError(e: unknown): string {
  if (e instanceof AggregateError) {
    const details = e.errors?.map((err: unknown) => err instanceof Error ? err.message : String(err)).filter(Boolean).join('; ');
    return details || 'PostgreSQL unavailable';
  }
  return e instanceof Error ? e.message : String(e);
}

enterpriseRouter.get('/health', async (_req: Request, res: Response) => {
  const [postgres, minio, qdrant, queues] = await Promise.allSettled([
    isPostgresAvailable(),
    isMinioAvailable(),
    isQdrantAvailable(),
    queueStats(),
  ]);

  res.json({
    status: postgres.status === 'fulfilled' && postgres.value ? 'ok' : 'degraded',
    layers: {
      governance: 'ok',
      data: {
        postgres: postgres.status === 'fulfilled' && postgres.value ? 'ok' : 'down',
        minio: minio.status === 'fulfilled' && minio.value ? 'ok' : 'down',
        qdrant: qdrant.status === 'fulfilled' && qdrant.value ? 'ok' : 'down',
      },
      provider_router: 'ok',
      memory_router: 'ok',
      browser_router: 'ok',
      queues: queues.status === 'fulfilled' ? queues.value : [],
    },
    timestamp: new Date().toISOString(),
  });
});

enterpriseRouter.get('/program/status', (_req: Request, res: Response) => {
  res.json(getProgramRuntimeStatus());
});

enterpriseRouter.get('/program/phases', (req: Request, res: Response) => {
  res.json({ phases: listProgramPhases(String(req.query.program || '')) });
});

enterpriseRouter.get('/program/phases/:phase', (req: Request, res: Response) => {
  const phase = getProgramPhase(req.params.phase);
  if (!phase) return res.status(404).json({ error: 'phase not found' });
  res.json({ phase });
});

enterpriseRouter.get('/program/priorities/:priority', (req: Request, res: Response) => {
  res.json({ priority: req.params.priority, phases: getPriorityPlan(req.params.priority) });
});

enterpriseRouter.get('/program/omega-briefing', (req: Request, res: Response) => {
  res.json(buildOmegaBriefing(String(req.query.input || 'Mi, dieu gi la quan trong nhat hom nay?')));
});

enterpriseRouter.get('/brain-v4/status', (_req: Request, res: Response) => {
  res.json(getEnterpriseBrainStatus());
});

enterpriseRouter.get('/brain-v4/domains', (_req: Request, res: Response) => {
  res.json({ domains: listEnterpriseBrainDomains() });
});

enterpriseRouter.get('/brain-v4/connectors', (_req: Request, res: Response) => {
  res.json(getEnterpriseBrainConnectorLayer());
});

enterpriseRouter.get('/brain-v4/ontology', (_req: Request, res: Response) => {
  res.json(getEnterpriseBrainOntology());
});

enterpriseRouter.get('/brain-v4/snapshot', (_req: Request, res: Response) => {
  res.json(getEnterpriseBrainSnapshot());
});

enterpriseRouter.get('/brain-v4/acceptance', async (_req: Request, res: Response) => {
  res.json(await runEnterpriseBrainAcceptance());
});

enterpriseRouter.get('/brain-v4/answer', async (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'q required' });
  res.json(await answerEnterpriseBrainQuestion(q));
});

enterpriseRouter.post('/brain-v4/answer', async (req: Request, res: Response) => {
  const q = String(req.body?.question || req.body?.q || '');
  if (!q) return res.status(400).json({ error: 'question required' });
  res.json(await answerEnterpriseBrainQuestion(q));
});

enterpriseRouter.get('/brain-v4/health/answer', (req: Request, res: Response) => {
  const q = String(req.query.q || '');
  if (!q) return res.status(400).json({ error: 'q required' });
  res.json(answerHealthQuestion(q));
});

enterpriseRouter.post('/brain-v4/health/import', (req: Request, res: Response) => {
  const sourcePath = String(req.body?.source_path || '');
  if (!sourcePath) return res.status(400).json({ error: 'source_path required' });
  const result = importHealthDataFromFile(sourcePath);
  res.status(result.ok ? 200 : 400).json(result);
});

enterpriseRouter.get('/brain-v4/health/certification', (_req: Request, res: Response) => {
  res.json(certifyHealthRuntime());
});

enterpriseRouter.get('/brain-v4/connector-proof', async (req: Request, res: Response) => {
  const q = String(req.query.q || 'Hôm nay anh có gì cần xử lý?');
  res.json(await answerUniversalConnectorQuestion(q));
});

enterpriseRouter.post('/brain-v4/connector-proof', async (req: Request, res: Response) => {
  const q = String(req.body?.question || req.body?.q || 'Hôm nay anh có gì cần xử lý?');
  res.json(await answerUniversalConnectorQuestion(q));
});

enterpriseRouter.get('/brain-v4/google-connector-certification', async (_req: Request, res: Response) => {
  res.json(await certifyGoogleConnectorRuntime());
});

enterpriseRouter.get('/brain-v4/final-certification', async (_req: Request, res: Response) => {
  res.json(await finalEnterpriseBrainV4Certification());
});

enterpriseRouter.get('/providers', (_req: Request, res: Response) => {
  res.json({
    router: 'providerRouter',
    operations: ['generateText', 'generateEmbedding', 'vision', 'transcribe', 'rank'],
    text_order: process.env.MI_TEXT_PROVIDER_ORDER || 'openai-compatible,anthropic,openai,gemini,deepseek,minimax,ollama',
    embedding_order: process.env.MI_EMBED_PROVIDER_ORDER || 'openai-compatible,openai,ollama',
  });
});

enterpriseRouter.post('/providers/generate-text', async (req: Request, res: Response) => {
  try {
    const result = await providerRouter.generateText(req.body.messages || [], {
      providers: req.body.providers,
      model: req.body.model,
      timeoutMs: req.body.timeout_ms,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(502).json({ ok: false, error: runtimeError(e) });
  }
});

enterpriseRouter.post('/providers/embedding', async (req: Request, res: Response) => {
  try {
    const result = await providerRouter.generateEmbedding(String(req.body.input || ''), {
      providers: req.body.providers,
      model: req.body.model,
      timeoutMs: req.body.timeout_ms,
    });
    res.json({ ok: true, provider: result.provider, model: result.model, dimensions: result.embedding.length });
  } catch (e) {
    res.status(502).json({ ok: false, error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/jobs', async (req: Request, res: Response) => {
  try {
    const job = await enqueueJob(req.body);
    res.json({ ok: true, job });
  } catch (e) {
    res.status(503).json({ ok: false, error: runtimeError(e) });
  }
});

enterpriseRouter.get('/queue/jobs', async (req: Request, res: Response) => {
  try {
    const jobs = await listQueueJobs(parseInt(String(req.query.limit || '100'), 10));
    res.json({ jobs, count: jobs.length });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.get('/queue/jobs/:id', async (req: Request, res: Response) => {
  try {
    const job = await getQueueJob(parseInt(req.params.id, 10));
    if (!job) return res.status(404).json({ error: 'job not found' });
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.get('/queue/stats', async (_req: Request, res: Response) => {
  try {
    res.json({ stats: await queueStats() });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/claim', async (req: Request, res: Response) => {
  try {
    const job = await claimNextJob(req.body.queue_name || 'default', req.body.worker_id || 'api-worker');
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/:id/complete', async (req: Request, res: Response) => {
  try {
    const job = await completeJob(parseInt(req.params.id, 10), req.body.result_json || {});
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/:id/fail', async (req: Request, res: Response) => {
  try {
    const job = await failJob(parseInt(req.params.id, 10), String(req.body.error || 'failed'));
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/:id/cancel', async (req: Request, res: Response) => {
  try {
    const job = await cancelJob(parseInt(req.params.id, 10), String(req.body.reason || 'cancelled'));
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/queue/:id/retry', async (req: Request, res: Response) => {
  try {
    const job = await retryJob(parseInt(req.params.id, 10));
    res.json({ job });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/memory/add', async (req: Request, res: Response) => {
  try {
    res.json(await addMemory(req.body));
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.get('/memory/search', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    if (!q) return res.status(400).json({ error: 'q required' });
    res.json({ results: await searchMemory(q, req.query as Record<string, string>) });
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.get('/memory/summary', async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '');
    if (!q) return res.status(400).json({ error: 'q required' });
    res.json(await summarizeMemory(q, req.query as Record<string, string>));
  } catch (e) {
    res.status(503).json({ error: runtimeError(e) });
  }
});

enterpriseRouter.post('/memory/sync', async (req: Request, res: Response) => {
  try {
    res.json(await syncMemory(req.body.source_id));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
