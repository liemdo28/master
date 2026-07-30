/**
 * Model Benchmark — quick latency probe for local models.
 * Sends a fixed prompt and measures time-to-first-token.
 */

import { updateModelHealth } from './model-registry';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PROBE_PROMPT = 'Hello. Reply with one word: OK';

export interface BenchmarkResult {
  model_id: string;
  model_name: string;
  latency_ms: number;
  status: 'pass' | 'timeout' | 'error';
}

export async function benchmarkModel(modelName: string, modelId: string): Promise<BenchmarkResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: PROBE_PROMPT, stream: false }),
      signal: AbortSignal.timeout(30_000),
    });
    const latency_ms = Date.now() - start;
    if (!res.ok) { updateModelHealth(modelId, 'degraded', latency_ms); return { model_id: modelId, model_name: modelName, latency_ms, status: 'error' }; }
    updateModelHealth(modelId, 'healthy', latency_ms);
    return { model_id: modelId, model_name: modelName, latency_ms, status: 'pass' };
  } catch (e: unknown) {
    const latency_ms = Date.now() - start;
    const isTimeout = e instanceof Error && e.name === 'TimeoutError';
    updateModelHealth(modelId, isTimeout ? 'degraded' : 'offline');
    return { model_id: modelId, model_name: modelName, latency_ms, status: isTimeout ? 'timeout' : 'error' };
  }
}

export async function runAllBenchmarks(): Promise<BenchmarkResult[]> {
  const { MODEL_REGISTRY } = await import('./model-registry');
  const locals = MODEL_REGISTRY.filter(m => m.locality === 'local' && m.provider === 'ollama' && m.enabled);
  const results: BenchmarkResult[] = [];
  for (const model of locals) {
    results.push(await benchmarkModel(model.name, model.id));
  }
  return results;
}
