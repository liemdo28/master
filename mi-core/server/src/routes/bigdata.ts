/**
 * Big Data API Routes — Phase 3
 *
 * GET  /api/bigdata/health
 * GET  /api/bigdata/sources
 * POST /api/bigdata/sources
 * POST /api/bigdata/ingest/json
 * POST /api/bigdata/ingest/file
 * POST /api/bigdata/index-memory
 * GET  /api/bigdata/search
 * GET  /api/bigdata/events
 * GET  /api/bigdata/jobs
 * GET  /api/bigdata/quality
 * POST /api/bigdata/quality/run
 * GET  /api/bigdata/query
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { isPostgresAvailable } from '../bigdata/db-client';
import { isMinioAvailable, ensureAllBuckets } from '../bigdata/minio-client';
import { isQdrantAvailable, indexTextChunks } from '../bigdata/memory-indexer';
import { listSources, registerSource } from '../bigdata/source-registry';
import { listRawObjects } from '../bigdata/object-store';
import { ingestJson, ingestFile, listJobs } from '../bigdata/ingestion-service';
import { hybridSearch, listEvents } from '../bigdata/search-service';
import { runAllChecks } from '../bigdata/data-quality';
import { answerOperationalQuestion } from '../bigdata/ceo-query-service';
import { enqueueJob } from '../queue/job-queue';

export const bigdataRouter = Router();
const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB limit

// ── Health ──────────────────────────────────────────────────────────────────
bigdataRouter.get('/health', async (_req: Request, res: Response) => {
  const [pg, minio, qdrant] = await Promise.allSettled([
    isPostgresAvailable(),
    isMinioAvailable(),
    isQdrantAvailable(),
  ]);

  const status = {
    postgres: pg.status === 'fulfilled' && pg.value ? 'ok' : 'down',
    minio:    minio.status === 'fulfilled' && minio.value ? 'ok' : 'down',
    qdrant:   qdrant.status === 'fulfilled' && qdrant.value ? 'ok' : 'down',
    timestamp: new Date().toISOString(),
  };
  const allOk = Object.values(status).every(v => v === 'ok' || typeof v !== 'string' || v === status.timestamp);
  const overall = (status.postgres === 'ok' && status.minio === 'ok' && status.qdrant === 'ok') ? 'ok' : 'degraded';
  res.status(overall === 'ok' ? 200 : 207).json({ ...status, overall });
});

// ── Sources ─────────────────────────────────────────────────────────────────
bigdataRouter.get('/sources', async (_req: Request, res: Response) => {
  try {
    const sources = await listSources();
    res.json({ sources, count: sources.length });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('AggregateError') || msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      return res.json({ sources: [], count: 0, warning: 'PostgreSQL unavailable' });
    }
    res.status(500).json({ error: msg });
  }
});

bigdataRouter.post('/sources', async (req: Request, res: Response) => {
  try {
    const source = await registerSource(req.body);
    res.json({ ok: true, source });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Ingest JSON ─────────────────────────────────────────────────────────────
bigdataRouter.post('/ingest/json', async (req: Request, res: Response) => {
  const { source_name, payload, filename, index_memory } = req.body as {
    source_name: string;
    payload: Record<string, unknown>;
    filename?: string;
    index_memory?: boolean;
  };
  if (!source_name || !payload) return res.status(400).json({ error: 'source_name and payload required' });
  try {
    const result = await ingestJson({ source_name, payload, filename, index_memory, actor: 'api' });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

bigdataRouter.post('/ingest/json/queue', async (req: Request, res: Response) => {
  const { source_name, payload } = req.body as { source_name: string; payload: Record<string, unknown> };
  if (!source_name || !payload) return res.status(400).json({ error: 'source_name and payload required' });
  try {
    const job = await enqueueJob({
      queue_name: 'ingestion',
      job_type: 'ingest_json',
      payload_json: req.body,
      created_by: 'api',
    });
    res.status(202).json({ ok: true, queued: true, job });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Ingest File ─────────────────────────────────────────────────────────────
bigdataRouter.post('/ingest/file', upload.single('file'), async (req: Request, res: Response) => {
  const file = (req as Request & { file?: Express.Multer.File }).file;
  const { source_name, index_memory } = req.body as { source_name: string; index_memory?: string };
  if (!file) return res.status(400).json({ error: 'file required' });
  if (!source_name) return res.status(400).json({ error: 'source_name required' });
  try {
    const result = await ingestFile({
      source_name,
      filename: file.originalname,
      buffer: file.buffer,
      content_type: file.mimetype,
      index_memory: index_memory !== 'false',
      actor: 'api',
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Index Memory ─────────────────────────────────────────────────────────────
bigdataRouter.post('/index-memory', async (req: Request, res: Response) => {
  const { text, title, source_id, raw_object_id, chunk_type, store_id, tags } = req.body as {
    text: string; title: string; source_id: number;
    raw_object_id?: number; chunk_type?: string; store_id?: string; tags?: string[];
  };
  if (!text || !title || !source_id) return res.status(400).json({ error: 'text, title, source_id required' });
  try {
    const result = await indexTextChunks({ text, title, source_id, raw_object_id, chunk_type, store_id, tags, actor: 'api' });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

bigdataRouter.post('/index-memory/queue', async (req: Request, res: Response) => {
  const { text, title, source_id } = req.body as { text: string; title: string; source_id: number };
  if (!text || !title || !source_id) return res.status(400).json({ error: 'text, title, source_id required' });
  try {
    const job = await enqueueJob({
      queue_name: 'memory',
      job_type: 'index_memory',
      payload_json: req.body,
      created_by: 'api',
    });
    res.status(202).json({ ok: true, queued: true, job });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Search ───────────────────────────────────────────────────────────────────
bigdataRouter.get('/search', async (req: Request, res: Response) => {
  const { q, store_id, event_type, date_from, date_to, limit } = req.query as Record<string, string>;
  if (!q) return res.status(400).json({ error: 'q (query) required' });
  try {
    const results = await hybridSearch(q, { store_id, event_type, date_from, date_to }, parseInt(limit || '20'));
    res.json({ query: q, results, count: results.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Events ───────────────────────────────────────────────────────────────────
bigdataRouter.get('/events', async (req: Request, res: Response) => {
  const { store_id, event_type, source, date_from, date_to, limit } = req.query as Record<string, string>;
  try {
    const events = await listEvents({ store_id, event_type, source, date_from, date_to, limit: parseInt(limit || '50') });
    res.json({ events, count: events.length });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('AggregateError') || msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      return res.json({ events: [], count: 0, warning: 'PostgreSQL unavailable' });
    }
    res.status(500).json({ error: msg });
  }
});

// ── Jobs ─────────────────────────────────────────────────────────────────────
bigdataRouter.get('/jobs', async (req: Request, res: Response) => {
  const { limit } = req.query as { limit?: string };
  try {
    const jobs = await listJobs(parseInt(limit || '50'));
    res.json({ jobs, count: jobs.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Objects ───────────────────────────────────────────────────────────────────
bigdataRouter.get('/objects', async (req: Request, res: Response) => {
  const { source_id, limit } = req.query as { source_id?: string; limit?: string };
  try {
    const objects = await listRawObjects(source_id ? parseInt(source_id) : undefined, parseInt(limit || '50'));
    res.json({ objects, count: objects.length });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Data Quality ─────────────────────────────────────────────────────────────
bigdataRouter.post('/quality/run', async (_req: Request, res: Response) => {
  try {
    const { results, summary } = await runAllChecks();
    res.json({ ok: true, summary, results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── CEO Query ─────────────────────────────────────────────────────────────────
bigdataRouter.get('/query', async (req: Request, res: Response) => {
  const { q, store, date_from, date_to } = req.query as Record<string, string>;
  if (!q) return res.status(400).json({ error: 'q (question) required' });
  try {
    const result = await answerOperationalQuestion(q, { store, date_from, date_to });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Init buckets (called on server start) ────────────────────────────────────
export async function initBigData(): Promise<void> {
  try {
    await ensureAllBuckets();
    console.log('[BigData] MinIO buckets ready');
  } catch (e) {
    console.warn('[BigData] MinIO not available (start with docker-compose):', (e as Error).message);
  }
}
