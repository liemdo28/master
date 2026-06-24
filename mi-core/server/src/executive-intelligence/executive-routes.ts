/**
 * Executive Intelligence Routes — Phase 21
 *
 * Express router for the Executive Intelligence Layer.
 * All endpoints are under /api/executive-intelligence/*
 *
 * Routes:
 *   GET  /api/executive-intelligence/health         — Health + version + model routes
 *   POST /api/executive-intelligence/objective      — Process CEO objective end-to-end
 *   GET  /api/executive-intelligence/objectives     — List all objective runs
 *   GET  /api/executive-intelligence/objectives/:id — Get run status + evidence + QA
 *   POST /api/executive-intelligence/memory/upsert  — Store a memory item
 *   POST /api/executive-intelligence/memory/search  — Keyword + tag memory search
 *   GET  /api/executive-intelligence/skills         — List approved skills
 *   POST /api/executive-intelligence/skills/validate — Validate a SKILL.md
 *   POST /api/executive-intelligence/benchmark/run  — Run 50-scenario benchmark suite
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { getModelRoutes, checkOllamaHealth } from './model-router';
import { processCEOInput } from './executive-intelligence-orchestrator';
import { evidenceStore } from './evidence-store';
import { objectiveRunStore } from './db/objective-run-store';
import { memoryStore } from './db/memory-store';
import { skillRegistry } from './skill-registry';
import { runBenchmark, formatBenchmarkReport } from './executive-intelligence-benchmark';

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
    objective_runs: {
      total: objectiveRunStore.listRuns(1000).length,
      path: process.env.GLOBAL_DIR || '.local-agent-global/executive-intelligence/runs',
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
      usage: 'POST /api/executive-intelligence/objective { "objective": "Are we okay today?" }',
    });
  }

  try {
    const result = processCEOInput(objective, {
      channel: (channel as any) || 'api',
      actor: actor || 'ceo',
      readOnlyDefault: readOnlyDefault !== false,
    });

    return res.json({
      runId: result.runId,
      ok: true,
      mode: result.mode,
      evidenceCount: result.evidenceCount,
      qaResult: result.qaResult,
      autonomyDecision: result.autonomyDecision,
      brief: result.brief,
      intent: result.intent.primary_intent,
      processing_time_ms: result.processing_time_ms,
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

// ── List Objective Runs ───────────────────────────────────────────────────────

executiveRouter.get('/objectives', async (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const status = req.query.status as string | undefined;

  let runs;
  if (status) {
    runs = objectiveRunStore.getRunsByStatus(status as any);
  } else {
    runs = objectiveRunStore.listRuns(limit);
  }

  res.json({
    ok: true,
    count: runs.length,
    runs,
  });
});

// ── Get Objective Status ──────────────────────────────────────────────────────

executiveRouter.get('/objectives/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const run = objectiveRunStore.getRun(id);

  if (!run) {
    return res.status(404).json({
      id,
      status: 'not_found',
      message: `Objective run "${id}" not found`,
    });
  }

  // Get evidence for this run
  const evidence = evidenceStore.listEvidence(id);

  res.json({
    ok: true,
    run,
    evidence: {
      count: evidence.length,
      items: evidence.map(e => ({
        id: e.id,
        sourceType: e.sourceType,
        sourceRef: e.sourceRef,
        summary: e.summary,
        capturedAt: e.capturedAt,
      })),
    },
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

  const item = memoryStore.upsert({ namespace, kind, title, body, tags, sourceRefs });

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

  const results = memoryStore.search(query, { namespace, limit: limit || 10 });

  res.json({
    ok: true,
    query,
    namespace: namespace || 'all',
    count: results.length,
    results: results.map(r => ({
      id: r.item.id,
      namespace: r.item.namespace,
      kind: r.item.kind,
      title: r.item.title,
      body: r.item.body,
      tags: r.item.tags,
      relevance: Math.round(r.relevance * 100) / 100,
      createdAt: r.item.createdAt,
    })),
  });
});

executiveRouter.get('/memory/list/:namespace', async (req: Request, res: Response) => {
  const { namespace } = req.params;
  const limit = parseInt(String(req.query.limit || '50'), 10);
  const items = memoryStore.listItems(namespace, limit);
  res.json({ ok: true, namespace, count: items.length, items });
});

executiveRouter.delete('/memory/:namespace/:id', async (req: Request, res: Response) => {
  const { namespace, id } = req.params;
  const deleted = memoryStore.deleteItem(id, namespace);
  if (!deleted) {
    return res.status(404).json({ error: `Memory item "${id}" not found in namespace "${namespace}"` });
  }
  res.json({ ok: true, deleted: true, id, namespace });
});

// ── Skills Endpoints ──────────────────────────────────────────────────────────

executiveRouter.get('/skills', async (_req: Request, res: Response) => {
  try {
    const loaded = skillRegistry.loadAll();
    const approved = skillRegistry.listApproved();

    res.json({
      ok: true,
      total_loaded: loaded.length,
      approved_count: approved.length,
      skills: loaded.map(s => ({
        name: s.manifest.name,
        version: s.manifest.version,
        approved: s.manifest.approved,
        scope: s.manifest.scope,
        policy_mode: s.manifest.policy.mode,
        sha256: s.manifest.sha256,
        loadedAt: s.loadedAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

executiveRouter.post('/skills/validate', async (req: Request, res: Response) => {
  const { name } = req.body as { name?: string };
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  const result = skillRegistry.validateSkill(name);
  res.json({ ok: true, ...result });
});

executiveRouter.get('/skills/prompt/:name', async (req: Request, res: Response) => {
  const { name } = req.params;
  const prompt = skillRegistry.getSkillPrompt(name);
  if (!prompt) {
    return res.status(404).json({ error: `Skill "${name}" not found or not approved` });
  }
  res.json({ ok: true, skill: name, prompt });
});

// ── Benchmark Endpoint ────────────────────────────────────────────────────────

executiveRouter.post('/benchmark/run', async (_req: Request, res: Response) => {
  try {
    console.log('[Executive] Starting benchmark run (50 scenarios)...');
    const report = runBenchmark();
    const formatted = formatBenchmarkReport(report);

    res.json({
      ok: true,
      certification: report.certification,
      overall_score: report.overall_score,
      passed: report.passed,
      total: report.total_scenarios,
      by_category: report.by_category,
      by_dimension: report.by_dimension,
      execution_time_ms: report.execution_time_ms,
      failing_count: report.failing_scenarios.length,
      report: formatted,
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

executiveRouter.get('/benchmark/report', async (_req: Request, res: Response) => {
  try {
    console.log('[Executive] Starting benchmark run (50 scenarios)...');
    const report = runBenchmark();
    const formatted = formatBenchmarkReport(report);

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(formatted);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});
