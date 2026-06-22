/**
 * Phase 21 Benchmark Runner
 *
 * Runs all 50 scenarios against the Executive Intelligence Layer.
 * CLI: node run-phase21-benchmark.mjs [--base-url http://127.0.0.1:4001]
 *
 * Outputs: phase21-results.json + console summary
 */

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const BASE_URL = process.argv.find(a => a.startsWith('--base-url='))?.split('=')[1]
  || process.env.EXECUTIVE_URL
  || 'http://127.0.0.1:4001';

async function loadScenarios() {
  const raw = await fs.readFile(new URL('./phase21-scenarios.json', import.meta.url), 'utf8');
  return JSON.parse(raw);
}

async function runScenario(scenario, baseUrl) {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/executive-intelligence/objective`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        objective: scenario.input,
        actor: 'benchmark',
        channel: 'api',
      }),
      signal: AbortSignal.timeout(120_000), // 2min max per scenario
    });

    const payload = await res.json();
    const latencyMs = Date.now() - started;

    return {
      id: scenario.id,
      category: scenario.category,
      input: scenario.input,
      latencyMs,
      status: 'ok',
      intentDetected: payload.intent?.primary_intent?.intent || 'unknown',
      intentCorrect: (payload.intent?.primary_intent?.intent || '') === scenario.expected_intent
        || (payload.recommended_entry_point || '').includes(scenario.expected_intent.split('_')[0]),
      confidence: payload.intent?.primary_intent?.confidence ?? 0,
      confidenceAcceptable: (payload.intent?.primary_intent?.confidence ?? 0) >= scenario.min_confidence,
      hasRequiredContent: scenario.must_contain.some(kw =>
        JSON.stringify(payload).toLowerCase().includes(kw)
      ),
      noForbiddenContent: !scenario.must_NOT_contain.some(kw =>
        JSON.stringify(payload).toLowerCase().includes(kw)
      ),
      briefHeadline: payload.brief?.headline || null,
    };
  } catch (err) {
    return {
      id: scenario.id,
      category: scenario.category,
      input: scenario.input,
      latencyMs: Date.now() - started,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      intentDetected: null,
      intentCorrect: false,
      confidence: 0,
      confidenceAcceptable: false,
      hasRequiredContent: false,
      noForbiddenContent: true,
      briefHeadline: null,
    };
  }
}

async function main() {
  console.log(`\n[Mi] Phase 21 Benchmark Runner`);
  console.log(`[Mi] Base URL: ${BASE_URL}`);
  console.log(`[Mi] Loading scenarios...\n`);

  const scenarios = await loadScenarios();
  console.log(`[Mi] Running ${scenarios.length} scenarios...\n`);

  const results = [];
  for (const scenario of scenarios) {
    process.stdout.write(`  S${String(scenario.id).padStart(2, '0')} [${scenario.category}] `);
    const result = await runScenario(scenario, BASE_URL);
    results.push(result);

    const icon = result.status === 'error' ? '❌'
      : result.intentCorrect && result.confidenceAcceptable ? '✅'
        : result.status === 'ok' ? '⚠️' : '❌';
    console.log(`${icon} ${result.latencyMs}ms confidence=${(result.confidence * 100).toFixed(0)}%`);
  }

  // Write results
  await fs.writeFile(
    new URL('./phase21-results.json', import.meta.url),
    JSON.stringify(results, null, 2),
  );

  // Summary
  const ok = results.filter(r => r.status === 'ok');
  const errors = results.filter(r => r.status === 'error');
  const intentCorrect = ok.filter(r => r.intentCorrect).length;
  const confidenceOk = ok.filter(r => r.confidenceAcceptable).length;
  const contentOk = ok.filter(r => r.hasRequiredContent).length;
  const latencies = results.map(r => r.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.floor(latencies.length * 0.95) - 1] || 0;

  const summary = {
    total: scenarios.length,
    ok: ok.length,
    errors: errors.length,
    intent_accuracy: `${intentCorrect}/${ok.length} (${(intentCorrect / Math.max(ok.length, 1) * 100).toFixed(1)}%)`,
    confidence_pass: `${confidenceOk}/${ok.length} (${(confidenceOk / Math.max(ok.length, 1) * 100).toFixed(1)}%)`,
    content_pass: `${contentOk}/${ok.length} (${(contentOk / Math.max(ok.length, 1) * 100).toFixed(1)}%)`,
    p95_latency_ms: p95,
  };

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`[Mi] Phase 21 Benchmark Summary`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`Total:     ${summary.total}`);
  console.log(`OK:        ${summary.ok}`);
  console.log(`Errors:    ${summary.errors}`);
  console.log(`Intent:    ${summary.intent_accuracy}`);
  console.log(`Confidence: ${summary.confidence_pass}`);
  console.log(`Content:   ${summary.content_pass}`);
  console.log(`P95 Latency: ${summary.p95_latency_ms}ms`);
  console.log(`${'═'.repeat(50)}\n`);

  await fs.writeFile(
    new URL('./phase21-summary.json', import.meta.url),
    JSON.stringify(summary, null, 2),
  );

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('[Mi] Benchmark runner failed:', err);
  process.exit(1);
});
