/**
 * Phase 4 local-only Ollama client.
 *
 * Hard guarantees enforced here rather than by convention:
 *  - the endpoint must resolve to a loopback host; anything else throws before a socket opens
 *  - every call is bounded by an explicit timeout and an optional AbortSignal
 *  - prompts and responses are never written to remote telemetry
 *  - no provider other than the configured loopback Ollama is reachable from this module
 */

export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]', '0:0:0:0:0:0:0:1']);

export class CloudEndpointDeniedError extends Error {
  readonly code = 'POLICY_DENIED';
  constructor(endpoint: string) {
    super(`coding engine endpoint must be loopback, refused: ${endpoint}`);
    this.name = 'CloudEndpointDeniedError';
  }
}

export class ModelTimeoutError extends Error {
  readonly code = 'MODEL_TIMEOUT';
  constructor(model: string, timeoutMs: number) {
    super(`model ${model} exceeded ${timeoutMs}ms`);
    this.name = 'ModelTimeoutError';
  }
}

export class ModelUnavailableError extends Error {
  readonly code = 'MODEL_UNAVAILABLE';
  constructor(message: string) {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

/** Throws unless `endpoint` is a loopback http(s) URL. Returns the normalised origin. */
export function assertLoopbackEndpoint(endpoint: string): string {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new CloudEndpointDeniedError(endpoint);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new CloudEndpointDeniedError(endpoint);
  if (!LOOPBACK_HOSTS.has(url.hostname.toLowerCase())) throw new CloudEndpointDeniedError(endpoint);
  return url.origin;
}

export function resolveOllamaEndpoint(): string {
  const raw = process.env.MI_CODING_OLLAMA_URL || process.env.OLLAMA_URL || DEFAULT_OLLAMA_ENDPOINT;
  return assertLoopbackEndpoint(raw);
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  system?: string;
  /** JSON schema for structured output, or 'json' for loose JSON mode. */
  format?: Record<string, unknown> | 'json';
  temperature?: number;
  numPredict?: number;
  numCtx?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Disables qwen3-style reasoning traces so latency reflects useful output. */
  think?: boolean;
}

export interface GenerateResult {
  model: string;
  response: string;
  promptTokens: number;
  evalTokens: number;
  /** Milliseconds spent generating, excluding model load. */
  evalMs: number;
  loadMs: number;
  totalMs: number;
  tokensPerSecond: number;
  truncated: boolean;
  endpoint: string;
}

export interface LoadedModelInfo {
  name: string;
  sizeBytes: number;
  vramBytes: number;
  contextLength: number;
}

export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const endpoint = resolveOllamaEndpoint();
  // An already-aborted signal never emits 'abort', so a listener alone would let
  // a cancelled task start one more inference before noticing.
  if (options.signal?.aborted) throw new Error('coding task cancelled');

  const timeoutMs = options.timeoutMs ?? 180_000;
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model: options.model,
    prompt: options.prompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0,
      num_predict: options.numPredict ?? 1024,
      ...(options.numCtx ? { num_ctx: options.numCtx } : {}),
    },
  };
  if (options.system) body.system = options.system;
  if (options.format) body.format = options.format;
  if (options.think === false) body.think = false;

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (options.signal?.aborted) throw new Error('coding task cancelled');
    if (controller.signal.aborted) throw new ModelTimeoutError(options.model, timeoutMs);
    throw new ModelUnavailableError(`ollama unreachable at ${endpoint}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ModelUnavailableError(`ollama ${res.status} for ${options.model}: ${detail.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    response?: string;
    prompt_eval_count?: number;
    eval_count?: number;
    eval_duration?: number;
    load_duration?: number;
    total_duration?: number;
    done_reason?: string;
  };

  const evalTokens = json.eval_count ?? 0;
  const evalNs = json.eval_duration ?? 0;
  return {
    model: options.model,
    response: json.response ?? '',
    promptTokens: json.prompt_eval_count ?? 0,
    evalTokens,
    evalMs: evalNs / 1e6,
    loadMs: (json.load_duration ?? 0) / 1e6,
    totalMs: json.total_duration ? json.total_duration / 1e6 : Date.now() - startedAt,
    tokensPerSecond: evalNs > 0 ? evalTokens / (evalNs / 1e9) : 0,
    truncated: json.done_reason === 'length',
    endpoint,
  };
}

export async function listModels(signal?: AbortSignal): Promise<string[]> {
  const endpoint = resolveOllamaEndpoint();
  const res = await fetch(`${endpoint}/api/tags`, { signal: signal ?? AbortSignal.timeout(10_000) });
  if (!res.ok) throw new ModelUnavailableError(`ollama tags ${res.status}`);
  const data = (await res.json()) as { models?: Array<{ name: string }> };
  return (data.models ?? []).map(model => model.name);
}

/** Currently resident models, used for VRAM accounting and concurrency guards. */
export async function loadedModels(signal?: AbortSignal): Promise<LoadedModelInfo[]> {
  const endpoint = resolveOllamaEndpoint();
  const res = await fetch(`${endpoint}/api/ps`, { signal: signal ?? AbortSignal.timeout(10_000) });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    models?: Array<{ name: string; size?: number; size_vram?: number; context_length?: number }>;
  };
  return (data.models ?? []).map(model => ({
    name: model.name,
    sizeBytes: model.size ?? 0,
    vramBytes: model.size_vram ?? 0,
    contextLength: model.context_length ?? 0,
  }));
}

/** Frees a resident model so the next one can claim VRAM. */
export async function unloadModel(model: string): Promise<void> {
  const endpoint = resolveOllamaEndpoint();
  await fetch(`${endpoint}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: '', keep_alive: 0 }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => undefined);
}
