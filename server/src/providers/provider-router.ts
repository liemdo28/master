import { pgQuery } from '../bigdata/db-client';
import { ensureEnterpriseSchema } from '../queue/job-queue';
import { chatMetrics } from '../chat/chat-metrics';

export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'ollama' | 'minimax' | 'openai-compatible';
export type ProviderOperation = 'generateText' | 'generateEmbedding' | 'vision' | 'transcribe' | 'rank';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderTextResult {
  text: string;
  provider: ProviderName;
  model: string;
}

export interface ProviderEmbeddingResult {
  embedding: number[];
  provider: ProviderName;
  model: string;
}

const OLLAMA_URL = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// ── Ollama Circuit Breaker ────────────────────────────────────────────────────
// Opens after CB_FAILURE_THRESHOLD consecutive failures; resets after CB_RESET_MS.
const CB_FAILURE_THRESHOLD = 3;
const CB_RESET_MS = 30_000;

let cbFailures = 0;
let cbOpenUntil = 0;

function isCbOpen(): boolean {
  if (cbOpenUntil && Date.now() < cbOpenUntil) return true;
  if (cbOpenUntil && Date.now() >= cbOpenUntil) {
    cbFailures = 0; cbOpenUntil = 0; chatMetrics.circuitClose();
  }
  return false;
}

function recordCbSuccess() { cbFailures = 0; }

function recordCbFailure() {
  cbFailures++;
  if (cbFailures >= CB_FAILURE_THRESHOLD) {
    cbOpenUntil = Date.now() + CB_RESET_MS;
    chatMetrics.circuitOpen();
    console.warn(`[CB] Ollama circuit OPEN — pausing for ${CB_RESET_MS / 1000}s after ${cbFailures} failures`);
  }
}

const DEFAULTS: Record<ProviderOperation, ProviderName[]> = {
  generateText: ['openai-compatible', 'anthropic', 'openai', 'gemini', 'deepseek', 'minimax', 'ollama'],
  generateEmbedding: ['openai-compatible', 'openai', 'ollama'],
  vision: ['openai-compatible', 'openai', 'gemini', 'ollama'],
  transcribe: ['openai-compatible', 'openai'],
  rank: ['openai-compatible', 'openai', 'ollama'],
};

function envList(name: string, fallback: ProviderName[]): ProviderName[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.split(',').map(v => v.trim()).filter(Boolean) as ProviderName[];
}

function textModel(provider: ProviderName): string {
  const key = `MI_PROVIDER_${provider.toUpperCase().replace(/-/g, '_')}_TEXT_MODEL`;
  if (process.env[key]) return process.env[key]!;
  if (provider === 'anthropic') return process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
  if (provider === 'ollama') return process.env.OLLAMA_FAST_MODEL || 'qwen3:8b';
  if (provider === 'gemini') return process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  if (provider === 'deepseek') return process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  if (provider === 'minimax') return process.env.MINIMAX_MODEL || 'abab6.5s-chat';
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

function embeddingModel(provider: ProviderName): string {
  if (provider === 'ollama') return process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  return process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
}

async function auditProviderCall(params: {
  operation: ProviderOperation;
  primary_provider?: ProviderName;
  selected_provider?: ProviderName;
  model?: string;
  status: string;
  latency_ms: number;
  error_message?: string;
}) {
  try {
    await ensureEnterpriseSchema();
    await pgQuery(
      `INSERT INTO provider_call_audit
       (operation, primary_provider, selected_provider, model, status, latency_ms, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        params.operation,
        params.primary_provider || null,
        params.selected_provider || null,
        params.model || null,
        params.status,
        params.latency_ms,
        params.error_message || null,
      ],
    );
  } catch {
    // Provider audit must never break the user-facing call.
  }
}

async function callOllamaText(messages: ChatMessage[], model: string, timeoutMs: number): Promise<ProviderTextResult> {
  if (isCbOpen()) throw new Error('Ollama circuit breaker OPEN — skipping to fallback');
  chatMetrics.ollamaCall();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: false }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) { recordCbFailure(); throw new Error(`Ollama text error: ${res.status}`); }
    const data = await res.json() as { message?: { content?: string } };
    recordCbSuccess();
    return { text: data.message?.content || '', provider: 'ollama', model };
  } catch (e) {
    const isTimeout = e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError');
    if (isTimeout) { chatMetrics.ollamaTimeout(); recordCbFailure(); }
    else if (!(e instanceof Error && e.message.startsWith('Ollama circuit'))) recordCbFailure();
    throw e;
  }
}

async function callAnthropicText(messages: ChatMessage[], model: string, timeoutMs: number): Promise<ProviderTextResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
  const system = messages.find(m => m.role === 'system')?.content;
  const chatMessages = messages.filter(m => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: chatMessages }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Anthropic text error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { content?: Array<{ text?: string }> };
  return { text: data.content?.map(c => c.text || '').join('\n') || '', provider: 'anthropic', model };
}

async function callOpenAiCompatibleText(
  provider: ProviderName,
  messages: ChatMessage[],
  model: string,
  timeoutMs: number,
): Promise<ProviderTextResult> {
  const envPrefix = provider.toUpperCase().replace(/-/g, '_');
  const baseUrl = process.env[`${envPrefix}_BASE_URL`] || process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env[`${envPrefix}_API_KEY`] || process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`${envPrefix}_API_KEY not configured`);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${provider} text error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return { text: data.choices?.[0]?.message?.content || '', provider, model };
}

async function callOllamaEmbedding(input: string, model: string, timeoutMs: number): Promise<ProviderEmbeddingResult> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: input }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Ollama embedding error: ${res.status}`);
  const data = await res.json() as { embedding: number[] };
  return { embedding: data.embedding, provider: 'ollama', model };
}

async function callOpenAiCompatibleEmbedding(provider: ProviderName, input: string, model: string, timeoutMs: number): Promise<ProviderEmbeddingResult> {
  const envPrefix = provider.toUpperCase().replace(/-/g, '_');
  const baseUrl = process.env[`${envPrefix}_BASE_URL`] || process.env.OPENAI_COMPATIBLE_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const apiKey = process.env[`${envPrefix}_API_KEY`] || process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`${envPrefix}_API_KEY not configured`);
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${provider} embedding error: ${res.status} ${await res.text()}`);
  const data = await res.json() as { data?: Array<{ embedding?: number[] }> };
  return { embedding: data.data?.[0]?.embedding || [], provider, model };
}

async function tryProviders<T>(
  operation: ProviderOperation,
  providers: ProviderName[],
  runner: (provider: ProviderName) => Promise<T & { provider: ProviderName; model: string }>,
): Promise<T> {
  const started = Date.now();
  const primary = providers[0];
  let lastError = '';
  for (const provider of providers) {
    try {
      const result = await runner(provider);
      await auditProviderCall({
        operation,
        primary_provider: primary,
        selected_provider: result.provider,
        model: result.model,
        status: provider === primary ? 'ok' : 'fallback_ok',
        latency_ms: Date.now() - started,
      });
      return result;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  await auditProviderCall({
    operation,
    primary_provider: primary,
    status: 'failed',
    latency_ms: Date.now() - started,
    error_message: lastError,
  });
  throw new Error(`${operation} failed across providers: ${lastError}`);
}

export const providerRouter = {
  generateText(messages: ChatMessage[], options: { providers?: ProviderName[]; model?: string; timeoutMs?: number } = {}) {
    const providers = options.providers || envList('MI_TEXT_PROVIDER_ORDER', DEFAULTS.generateText);
    const timeoutMs = options.timeoutMs || 60000;
    return tryProviders('generateText', providers, async (provider) => {
      const model = options.model || textModel(provider);
      if (provider === 'ollama') return callOllamaText(messages, model, timeoutMs);
      if (provider === 'anthropic') return callAnthropicText(messages, model, timeoutMs);
      return callOpenAiCompatibleText(provider, messages, model, timeoutMs);
    });
  },

  generateEmbedding(input: string, options: { providers?: ProviderName[]; model?: string; timeoutMs?: number } = {}) {
    const providers = options.providers || envList('MI_EMBED_PROVIDER_ORDER', DEFAULTS.generateEmbedding);
    const timeoutMs = options.timeoutMs || 30000;
    return tryProviders('generateEmbedding', providers, async (provider) => {
      const model = options.model || embeddingModel(provider);
      if (provider === 'ollama') return callOllamaEmbedding(input, model, timeoutMs);
      return callOpenAiCompatibleEmbedding(provider, input, model, timeoutMs);
    });
  },

  async vision(): Promise<never> {
    throw new Error('providerRouter.vision boundary is defined; provider adapter implementation is pending.');
  },

  async transcribe(): Promise<never> {
    throw new Error('providerRouter.transcribe boundary is defined; provider adapter implementation is pending.');
  },

  async rank(): Promise<never> {
    throw new Error('providerRouter.rank boundary is defined; provider adapter implementation is pending.');
  },
};
