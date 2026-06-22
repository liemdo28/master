/**
 * Executive Intelligence Routes — Phase 21
 *
 * Express router for the Executive Intelligence Layer.
 * All endpoints are under /api/executive/*
 *
 * Routes:
 *   GET  /api/executive/health         — Health + version + model routes
 *   POST /api/executive/objective      — Process CEO objective end-to-end
 *   GET  /api/executive/objectives/:id — Get run status + evidence + QA
 *   POST /api/executive/memory/upsert  — Store a memory item
 *   POST /api/executive/memory/search  — Semantic + keyword memory search
 *   GET  /api/executive/skills         — List approved skills
 *   POST /api/executive/skills/validate — Validate a SKILL.md
 *   POST /api/executive/benchmark/run  — Run benchmark suite
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getModelRoutes, checkOllamaHealth } from './model-router';
import { processCEOInput } from './executive-intelligence-orchestrator';
import { evidenceStore } from './evidence-store';

export const executiveRouter = Router();

// ── Health ────────────────────────────────────────────────────────────────────

executiveRouter.get('/health', async (_req: Request, res: Response) => {
  const ollama = await checkOllamaHealth();
  const startedAt = process.env.APP_START_TIME || new Date().toISOString();

  res.json({
    ok: true,
    service: 'executive-intelligence-layer',
    version: process.env.APP_VERSION || 'phase21',
    model_routes: getModelRoutes(),
    ollama: {
      reachable: ollama.reachable,
      model_count: ollama.models.length,
    },
    evidence_store: {
      path: evidenceStore.getRootPath(),
    },
    uptime: Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// ── Process Objective ─────────────────────────────────────────────────────────

executiveRouter.post('/objective', async (req: Request, res: Response) => {
  const { objective, actor, channel, readOnlyDefault } = req.body as {
    objective?: string;
    actor?: string;
    channel?: string;
    readOnlyDefault?: boolean;
  };

  if (!objective || typeof objective !== 'string') {
    return res.status(400).json({
      error: 'Missing or invalid "objective" field',
      usage: 'POST /api/executive/objective { "objective": "Are we okay today?" }',
    });
  }

  try {
    const result = await processCEOInput(objective, {
      channel: (channel as any) || 'api',
      actor: actor || 'ceo',
      readOnlyDefault: readOnlyDefault !== false,
    });

    return res.json({
      runId: crypto.randomUUID(),
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Executive] Objective processing failed: ${message}`);
    return res.status(500).json({
      error: 'Executive processing failed',
      message,
    });
  }
});

// ── Get Objective Status ──────────────────────────────────────────────────────

executiveRouter.get('/objectives/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // TODO: Query from Postgres objective_runs table when DB is wired
  // For now, return a placeholder
  res.json({
    id,
    status: 'not_found',
    message: 'Objective run lookup requires Postgres connection (Week 2)',
  });
});

// ── Memory Endpoints ──────────────────────────────────────────────────────────

executiveRouter.post('/memory/upsert', async (req: Request, res: Response) => {
  const { namespace, kind, title, body, tags, sourceRefs } = req.body as {
    namespace?: string;
    kind?: string;
    title?: string;
    body?: string;
    tags?: string[];
    sourceRefs?: string[];
  };

  if (!title) {
    return res.status(400).json({ error: 'Missing required field: title' });
  }

  const id = `mem-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const item = {
    id,
    namespace: namespace || 'default',
    kind: kind || 'general',
    title,
    body: body || '',
    tags: tags || [],
    sourceRefs: sourceRefs || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // TODO: Store in Postgres memory_items table when DB is wired
  // For now, return the item
  res.json({ ok: true, item });
});

executiveRouter.post('/memory/search', async (req: Request, res: Response) => {
  const { query, namespace, limit } = req.body as {
    query?: string;
    namespace?: string;
    limit?: number;
  };

  if (!query) {
    return res.status(400).json({ error: 'Missing required field: query' });
  }

  // TODO: Hybrid search (keyword + vector) when DB is wired
  res.json({
    query,
    namespace: namespace || 'all',
    results: [],
    message: 'Memory search requires Postgres connection (Week 2)',
  });
});

// ── Skills Endpoints ──────────────────────────────────────────────────────────

executiveRouter.get('/skills', async (_req: Request, res: Response) => {
  // TODO: Load from skill_manifests table
  res.json({
    skills: [],
    message: 'Skill listing requires Postgres connection (Week 4)',
  });
});

executiveRouter.post('/skills/validate', async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  // TODO: Validate SKILL.md + policy
  res.json({
    name,
    valid: false,
    message: 'Skill validation requires SKILL.md system (Week 4)',
  });
});

// ── Benchmark Endpoint ────────────────────────────────────────────────────────

executiveRouter.post('/benchmark/run', async (_req: Request, res: Response) => {
  // TODO: Load scenarios and run benchmark suite
  res.json({
    status: 'not_implemented',
    message: 'Benchmark runner requires completed intelligence layer (Week 5)',
  });
});
