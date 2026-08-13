/**
 * Phase 7B — performance measurement for the canonical health endpoints.
 * Not part of the pass/fail acceptance chain (latency here is environment-
 * dependent — see the note below); this is a one-shot measurement script
 * whose output feeds docs/operations/PHASE7B_HEALTH_RUNBOOK.md.
 */
import express from 'express';
import type { AddressInfo } from 'net';
import { healthPublicRouter } from './public-router';
import { healthDetailRouter } from './detail-router';
import { getSystemHealth } from './aggregate';

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function timeRequests(url: string, headers: Record<string, string>, n: number): Promise<number[]> {
  const durations: number[] = [];
  for (let i = 0; i < n; i++) {
    const start = performance.now();
    await fetch(url, { headers });
    durations.push(performance.now() - start);
  }
  return durations.sort((a, b) => a - b);
}

async function run(): Promise<void> {
  const app = express();
  app.use('/api/health', healthPublicRouter);
  app.use('/api', (req, _res, next) => next(), healthDetailRouter); // no auth needed for a local perf measurement
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  try {
    // Isolated probe timing — how long does a single getSystemHealth() call take
    // end to end, before any HTTP overhead.
    const probeStart = performance.now();
    await getSystemHealth();
    const probeDurationMs = performance.now() - probeStart;

    const N_PUBLIC = 5;
    const N_DETAIL = 5;
    const publicDurations = await timeRequests(`${base}/api/health`, {}, N_PUBLIC);
    const detailDurations = await timeRequests(`${base}/api/health/detail`, {}, N_DETAIL);
    const depsDurations = await timeRequests(`${base}/api/health/dependencies`, {}, N_DETAIL);

    const report = {
      note: 'AI_SERVICE_URL/OLLAMA_URL are not reachable in this dev checkout, so both /api/health and /api/health/detail are dominated by the 5s AbortSignal.timeout ceiling on the Python-AI/Ollama probes, not by health-truth\'s own aggregation cost. This is the intended worst case: bounded (never hangs, unlike the pre-Phase-7B handler with no timeout at all), not fast. In a production runtime where those services are healthy and respond quickly, or where they are consistently down (same timeout every time), latency is stable either way.',
      isolatedGetSystemHealthMs: Math.round(probeDurationMs),
      publicHealth: {
        n: N_PUBLIC,
        p50Ms: Math.round(percentile(publicDurations, 50)),
        p95Ms: Math.round(percentile(publicDurations, 95)),
        maxMs: Math.round(publicDurations[publicDurations.length - 1]),
      },
      detailedHealth: {
        n: N_DETAIL,
        p50Ms: Math.round(percentile(detailDurations, 50)),
        p95Ms: Math.round(percentile(detailDurations, 95)),
        maxMs: Math.round(detailDurations[detailDurations.length - 1]),
      },
      dependenciesEndpoint: {
        n: N_DETAIL,
        p50Ms: Math.round(percentile(depsDurations, 50)),
        p95Ms: Math.round(percentile(depsDurations, 95)),
        maxMs: Math.round(depsDurations[depsDurations.length - 1]),
      },
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())));
  }
}

run().catch(err => { console.error(err); process.exit(1); });
