/**
 * Phase 4 privacy and network verification.
 *
 * Rather than asserting that the code *looks* local, this instruments global
 * fetch, runs a real coding task end to end against a real local model, and
 * then inspects every request that was actually made. A single non-loopback
 * destination fails the suite.
 *
 * It also checks the inverse direction: that source and secrets do not leak
 * into evidence, and that no cloud provider credential is consulted.
 */

import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { runFixtureWithModel } from '../benchmark/harness';
import { getFixture } from '../__fixtures__/fixtures';
import { assertLoopbackEndpoint, resolveOllamaEndpoint } from '../llm/ollama-client';
import { minimalEnv } from '../llm/tools';
import { LlmCodingEngine } from '../llm/engine';

let checks = 0;
function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) throw new Error(`FAILED: ${label} ${detail}`);
  checks += 1;
  console.log(`[coding-privacy] ok  ${label}`);
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const CLOUD_MARKERS = [
  'openai.com', 'anthropic.com', 'googleapis.com', 'azure.com', 'cohere.ai',
  'mistral.ai', 'groq.com', 'huggingface.co', 'ollama.com', 'ollama.ai',
  'amazonaws.com', 'x.ai', 'replicate.com',
];

async function run(): Promise<void> {
  const recorded: string[] = [];
  const realFetch = globalThis.fetch;

  // Record every outbound request made while the engine runs.
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    recorded.push(url);
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;

  let outcome: Awaited<ReturnType<typeof runFixtureWithModel>>;
  try {
    outcome = await runFixtureWithModel(getFixture('task-a-bug-fix'), 'qwen2.5-coder:7b');
  } finally {
    globalThis.fetch = realFetch;
  }

  check('a real model-backed task was executed', recorded.length > 0, `${recorded.length} requests`);
  check('the task actually invoked the engine', outcome.evalTokens > 0, `evalTokens=${outcome.evalTokens}`);

  const destinations = new Set<string>();
  for (const url of recorded) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`FAILED: unparseable request URL recorded: ${url}`);
    }
    destinations.add(parsed.host);
    check(
      `request stayed on loopback: ${parsed.host}${parsed.pathname}`,
      LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()),
      url
    );
  }
  console.log(`[coding-privacy] destinations observed: ${[...destinations].join(', ')}`);

  for (const marker of CLOUD_MARKERS) {
    check(`no request reached ${marker}`, !recorded.some(url => url.includes(marker)));
  }

  // The configured endpoint itself must be loopback.
  const endpoint = resolveOllamaEndpoint();
  check('resolved endpoint is loopback', assertLoopbackEndpoint(endpoint) === endpoint, endpoint);

  // Cloud fallback must be off, and no provider key may be consulted by the engine.
  const engineSource = fs.readFileSync(path.join(__dirname, '..', 'llm', 'engine.ts'), 'utf8');
  const clientSource = fs.readFileSync(path.join(__dirname, '..', 'llm', 'ollama-client.ts'), 'utf8');
  for (const key of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'XAI_API_KEY']) {
    check(`engine never reads ${key}`, !engineSource.includes(key) && !clientSource.includes(key));
  }
  check(
    'client exposes no non-loopback provider base url',
    !/https:\/\/api\./.test(clientSource)
  );

  // Spawned validation processes get a minimal environment with telemetry off.
  const env = minimalEnv();
  check('spawned env carries no API keys', Object.keys(env).every(key => !/API_KEY|TOKEN|SECRET|PASSWORD/i.test(key)));
  check('spawned env disables third-party telemetry', env.DO_NOT_TRACK === '1' && env.NEXT_TELEMETRY_DISABLED === '1');

  // Evidence must not carry raw prompts or file bodies off the task.
  const engine = new LlmCodingEngine();
  const evidence = await engine.collectEvidence(os.tmpdir());
  const serialized = JSON.stringify(evidence);
  check('evidence records no prompt text', !/RANKED CANDIDATE FILES|FILE CONTENTS/.test(serialized));
  check('evidence records no raw file bodies', !/--- FILE: /.test(serialized));
  check('evidence is JSON-serialisable', serialized.length > 0);

  assert.ok(outcome.model === 'qwen2.5-coder:7b');
  console.log(`\n[coding-privacy] PASS — ${checks} privacy assertions over ${recorded.length} observed requests`);
}

run().catch(err => {
  console.error(`[coding-privacy] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
