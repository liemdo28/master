/**
 * Model Registry routes — list, health, benchmark, policy.
 */

import { Router } from 'express';
import { getRegistrySummary, getLocalModels, getCloudModels } from '../models/model-registry';
import { getModelHealthSummary, checkOllamaHealth } from '../models/model-health';
import { runAllBenchmarks, benchmarkModel } from '../models/model-benchmark';
import { getPolicySummary } from '../models/model-policy';

export const modelsRegistryRouter = Router();

// GET /api/models/registry — full registry summary
modelsRegistryRouter.get('/registry', (_req, res) => {
  res.json(getRegistrySummary());
});

// GET /api/models/registry/local — local models only
modelsRegistryRouter.get('/registry/local', (_req, res) => {
  res.json({ models: getLocalModels() });
});

// GET /api/models/registry/cloud — cloud models
modelsRegistryRouter.get('/registry/cloud', (_req, res) => {
  res.json({ models: getCloudModels() });
});

// GET /api/models/registry/health — health check all models
modelsRegistryRouter.get('/registry/health', async (_req, res) => {
  const summary = await getModelHealthSummary();
  res.json({ models: summary });
});

// GET /api/models/registry/ollama — Ollama connectivity
modelsRegistryRouter.get('/registry/ollama', async (_req, res) => {
  const result = await checkOllamaHealth();
  res.json(result);
});

// GET /api/models/registry/policy — cloud policy
modelsRegistryRouter.get('/registry/policy', (_req, res) => {
  res.json(getPolicySummary());
});

// POST /api/models/registry/benchmark — run all benchmarks
modelsRegistryRouter.post('/registry/benchmark', async (_req, res) => {
  const results = await runAllBenchmarks();
  res.json({ results, total: results.length, passed: results.filter(r => r.status === 'pass').length });
});

// POST /api/models/registry/benchmark/:name — benchmark a single model
modelsRegistryRouter.post('/registry/benchmark/:name', async (req, res) => {
  const modelName = req.params.name;
  const modelId = req.query.id as string || modelName;
  const result = await benchmarkModel(modelName, modelId);
  res.json(result);
});
