import crypto from 'crypto';
import { providerRouter, type ChatMessage } from '../../providers/provider-router';
import { PROFILE_DIR, checkLoginStatus, chatGptBrowserProvider } from './chatgpt-browser-provider';
import type { AIProviderHealthStatus } from './ai-provider';

export type SeoProviderName = 'cloud_api' | 'chatgpt_browser' | 'local_model' | 'policy_template';

export interface ProviderStatus {
  provider: SeoProviderName;
  status: AIProviderHealthStatus;
  model?: string;
  latency_ms?: number;
  error?: string;
  category?: AIProviderHealthStatus;
  profile_dir?: string;
  configured?: boolean;
}

export interface SeoGenerateResult {
  ok: boolean;
  text: string;
  provider: SeoProviderName;
  provider_status: AIProviderHealthStatus;
  model?: string;
  latency_ms: number;
  checksum: string;
  prompt_version: string;
  fallback_used: boolean;
  error_category?: AIProviderHealthStatus;
  error?: string;
}

export interface StructuredSchema {
  required: Record<string, 'string' | 'boolean' | 'number' | 'array' | 'object'>;
}

const DEFAULT_PROMPT_VERSION = 'seo-provider-gateway-v1';
const OLLAMA_URL = process.env.OLLAMA_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

function checksum(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function categorizeError(error: unknown): AIProviderHealthStatus {
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error || '');
  if (/not configured|api_key|credential/i.test(msg)) return 'BLOCKED_CREDENTIALS';
  if (/401|unauthorized|license key is not active|inactive/i.test(msg)) return 'BLOCKED_CREDENTIALS';
  if (/not authenticated|login|captcha|mfa/i.test(msg)) return 'BLOCKED_LOGIN';
  if (/timeout|aborted|AbortError|TimeoutError/i.test(msg)) return 'FAILED_TIMEOUT';
  if (/schema|json|parse/i.test(msg)) return 'FAILED_SCHEMA';
  if (/fetch failed|ECONNREFUSED|connection refused|ENOTFOUND|network/i.test(msg)) return 'FAILED_NETWORK';
  return 'DEGRADED';
}

function configuredCloudProvider(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_COMPATIBLE_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.GEMINI_API_KEY,
  );
}

function localModel(): string {
  return process.env.SEO_LOCAL_MODEL || process.env.OLLAMA_SEO_MODEL || process.env.OLLAMA_FAST_MODEL || 'qwen2.5-coder:7b';
}

function extractJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) return JSON.parse(fenced[1]);
    const first = raw.indexOf('{');
    const last = raw.lastIndexOf('}');
    if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1));
    throw new Error('FAILED_SCHEMA: no JSON object found');
  }
}

function validateSchema(obj: unknown, schema: StructuredSchema): { ok: true } | { ok: false; error: string } {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'root must be object' };
  const record = obj as Record<string, unknown>;
  for (const [key, type] of Object.entries(schema.required)) {
    const value = record[key];
    if (type === 'array') {
      if (!Array.isArray(value)) return { ok: false, error: `${key} must be array` };
      continue;
    }
    if (type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: `${key} must be object` };
      continue;
    }
    if (typeof value !== type) return { ok: false, error: `${key} must be ${type}` };
  }
  return { ok: true };
}

async function localText(messages: ChatMessage[], timeoutMs: number, jsonMode = false): Promise<{ text: string; model: string }> {
  if (localTextOverride) return localTextOverride(messages, timeoutMs);
  const result = await providerRouter.generateText(messages, {
    providers: ['ollama'],
    model: localModel(),
    timeoutMs,
    jsonMode,
  });
  return { text: result.text, model: result.model };
}

function messagePrompt(messages: ChatMessage[]): string {
  return messages.map(m => `${m.role.toUpperCase()}:\n${m.content}`).join('\n\n');
}

async function cloudText(messages: ChatMessage[], timeoutMs: number, jsonMode = false): Promise<{ text: string; model: string; provider: string }> {
  const providers = (process.env.SEO_CLOUD_PROVIDER_ORDER || process.env.MI_TEXT_PROVIDER_ORDER || 'anthropic,openai-compatible,openai,gemini')
    .split(',')
    .map(p => p.trim())
    .filter(provider => {
      if (!provider) return false;
      if (provider === 'anthropic') return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
      if (provider === 'openai-compatible') return Boolean(process.env.OPENAI_COMPATIBLE_API_KEY || process.env.OPENAI_API_KEY);
      if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
      if (provider === 'gemini') return Boolean(process.env.GEMINI_API_KEY);
      return false;
    });

  let lastError = '';
  if (providers.length === 0) throw new Error('No cloud/API provider credentials configured.');
  for (const provider of providers) {
    try {
      if (provider === 'anthropic') {
        const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
        if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
        const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest';
        const baseUrl = (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '');
        const system = messages.find(m => m.role === 'system')?.content;
        const chatMessages = messages.filter(m => m.role !== 'system');
        const res = await fetch(`${baseUrl}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({ model, max_tokens: 4096, system, messages: chatMessages }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`anthropic text error: ${res.status} ${await res.text()}`);
        const data = await res.json() as { content?: Array<{ text?: string }> };
        return { text: data.content?.map(c => c.text || '').join('\n') || '', model, provider };
      }

      const result = await providerRouter.generateText(messages, {
        providers: [provider as any],
        timeoutMs,
        jsonMode,
      });
      return { text: result.text, model: result.model, provider: result.provider };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastError || 'cloud provider failed');
}

async function browserText(messages: ChatMessage[]): Promise<{ text: string; model: string }> {
  const prompt = messagePrompt(messages);
  const result = await chatGptBrowserProvider.submit({
    task_id: `seo-provider-${Date.now()}`,
    brand_id: 'system',
    template: 'provider-gateway',
    prompt,
    idempotency_key: checksum(prompt),
  });
  if (result.status !== 'completed' || !result.raw_response) {
    throw new Error(result.error || result.status);
  }
  return { text: result.raw_response, model: 'chatgpt-browser' };
}

let localTextOverride: ((messages: ChatMessage[], timeoutMs: number) => Promise<{ text: string; model: string }>) | null = null;

export function __setLocalTextOverrideForTests(fn: ((messages: ChatMessage[], timeoutMs: number) => Promise<{ text: string; model: string }>) | null): void {
  if (process.env.NODE_ENV !== 'test' && process.env.SEO_SECURITY_TEST_MODE !== '1') {
    throw new Error('__setLocalTextOverrideForTests is only available in test mode');
  }
  localTextOverride = fn;
}

export async function checkLocalProvider(): Promise<ProviderStatus> {
  const started = Date.now();
  try {
    const tags = await fetch(`${OLLAMA_URL.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(5_000) });
    if (!tags.ok) throw new Error(`Ollama tags error: ${tags.status}`);
    const data = await tags.json() as { models?: Array<{ name?: string; model?: string }> };
    const model = localModel();
    const exists = (data.models || []).some(m => m.name === model || m.model === model);
    return {
      provider: 'local_model',
      status: exists ? 'HEALTHY' : 'DEGRADED',
      model,
      latency_ms: Date.now() - started,
      error: exists ? undefined : `Configured model ${model} is not installed`,
    };
  } catch (e) {
    return {
      provider: 'local_model',
      status: categorizeError(e),
      model: localModel(),
      latency_ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function checkChatGptBrowserProvider(): Promise<ProviderStatus> {
  const started = Date.now();
  try {
    const { chromium } = await import('playwright');
    const context = await chromium.launchPersistentContext(PROFILE_DIR, {
      headless: true,
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();
    const login = await checkLoginStatus(page);
    await context.close();
    return {
      provider: 'chatgpt_browser',
      status: login.status === 'logged_in' ? 'HEALTHY' : 'BLOCKED_LOGIN',
      latency_ms: Date.now() - started,
      profile_dir: PROFILE_DIR,
      error: login.status === 'logged_in' ? undefined : `ChatGPT browser profile not authenticated: ${login.reason}`,
    };
  } catch (e) {
    return {
      provider: 'chatgpt_browser',
      status: categorizeError(e),
      latency_ms: Date.now() - started,
      profile_dir: PROFILE_DIR,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function checkCloudProvider(): Promise<ProviderStatus> {
  const started = Date.now();
  if (!configuredCloudProvider()) {
    return {
      provider: 'cloud_api',
      status: 'BLOCKED_CREDENTIALS',
      configured: false,
      latency_ms: Date.now() - started,
      error: 'No cloud/API provider credentials configured.',
    };
  }

  try {
    const result = await cloudText([{ role: 'user', content: 'Return exactly: SEO_CLOUD_HEALTHY' }], Number(process.env.SEO_PROVIDER_PROBE_TIMEOUT_MS || 30_000));
    return {
      provider: 'cloud_api',
      status: 'HEALTHY',
      configured: true,
      model: result.model,
      latency_ms: Date.now() - started,
    };
  } catch (e) {
    return {
      provider: 'cloud_api',
      status: categorizeError(e),
      configured: true,
      latency_ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getSeoProviderStatus(options: { includeBrowser?: boolean } = {}): Promise<{ providers: ProviderStatus[]; active_provider: SeoProviderName; overall: AIProviderHealthStatus }> {
  const cloud = await checkCloudProvider();
  const local = await checkLocalProvider();
  const browser = options.includeBrowser ? await checkChatGptBrowserProvider() : {
    provider: 'chatgpt_browser',
    status: 'BLOCKED_LOGIN',
    profile_dir: PROFILE_DIR,
    error: 'Browser login check skipped; call with includeBrowser=true to verify active session.',
  } as ProviderStatus;

  const policyTemplate: ProviderStatus = { provider: 'policy_template', status: 'FALLBACK_ACTIVE' };
  const providers: ProviderStatus[] = [cloud, browser, local, policyTemplate];
  if (cloud.status === 'HEALTHY') return { providers, active_provider: 'cloud_api', overall: 'HEALTHY' };
  if (browser.status === 'HEALTHY') return { providers, active_provider: 'chatgpt_browser', overall: 'HEALTHY' };
  if (local.status === 'HEALTHY') return { providers, active_provider: 'local_model', overall: 'DEGRADED' };
  return { providers, active_provider: 'policy_template', overall: 'FALLBACK_ACTIVE' };
}

export async function generateText(
  messages: ChatMessage[],
  options: { timeoutMs?: number; promptVersion?: string; fallbackText?: string; jsonMode?: boolean } = {},
): Promise<SeoGenerateResult> {
  const timeoutMs = options.timeoutMs || Number(process.env.SEO_PROVIDER_TIMEOUT_MS || 120_000);
  const promptVersion = options.promptVersion || DEFAULT_PROMPT_VERSION;
  const started = Date.now();

  try {
    const cloud = await checkCloudProvider();
    if (cloud.status === 'HEALTHY') {
      const result = await cloudText(messages, timeoutMs, options.jsonMode === true);
      return {
        ok: true,
        text: result.text,
        provider: 'cloud_api',
        provider_status: 'HEALTHY',
        model: result.model,
        latency_ms: Date.now() - started,
        checksum: checksum(result.text),
        prompt_version: promptVersion,
        fallback_used: false,
      };
    }
  } catch {
    // Fall through to browser/local/fallback.
  }

  try {
    const browser = await checkChatGptBrowserProvider();
    if (browser.status === 'HEALTHY') {
      const result = await browserText(messages);
      return {
        ok: true,
        text: result.text,
        provider: 'chatgpt_browser',
        provider_status: 'HEALTHY',
        model: result.model,
        latency_ms: Date.now() - started,
        checksum: checksum(result.text),
        prompt_version: promptVersion,
        fallback_used: false,
      };
    }
  } catch {
    // Fall through to local/fallback.
  }

  try {
    const result = await localText(messages, timeoutMs, options.jsonMode === true);
    return {
      ok: true,
      text: result.text,
      provider: 'local_model',
      provider_status: 'HEALTHY',
      model: result.model,
      latency_ms: Date.now() - started,
      checksum: checksum(result.text),
      prompt_version: promptVersion,
      fallback_used: false,
    };
  } catch (e) {
    const category = categorizeError(e);
    const fallback = options.fallbackText || '';
    return {
      ok: Boolean(fallback),
      text: fallback,
      provider: fallback ? 'policy_template' : 'local_model',
      provider_status: fallback ? 'FALLBACK_ACTIVE' : category,
      latency_ms: Date.now() - started,
      checksum: checksum(fallback),
      prompt_version: promptVersion,
      fallback_used: Boolean(fallback),
      error_category: category,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function generateStructured<T extends Record<string, unknown>>(
  messages: ChatMessage[],
  schema: StructuredSchema,
  options: { timeoutMs?: number; promptVersion?: string; repairOnce?: boolean } = {},
): Promise<SeoGenerateResult & { parsed?: T }> {
  const first = await generateText(messages, { ...options, jsonMode: true });
  if (!first.ok) return first;
  try {
    const parsed = extractJson(first.text) as T;
    const validation = validateSchema(parsed, schema);
    if (!validation.ok) throw new Error(`FAILED_SCHEMA: ${validation.error}`);
    return { ...first, parsed };
  } catch (e) {
    if (options.repairOnce === false || first.fallback_used) {
      return { ...first, ok: false, provider_status: 'FAILED_SCHEMA', error_category: 'FAILED_SCHEMA', error: e instanceof Error ? e.message : String(e) };
    }
    const repairPrompt = [
      ...messages,
      { role: 'user' as const, content: `Your previous response failed JSON schema validation. Return ONLY valid JSON matching these required fields: ${JSON.stringify(schema.required)}.` },
    ];
    const repaired = await generateText(repairPrompt, { ...options, promptVersion: `${options.promptVersion || DEFAULT_PROMPT_VERSION}:repair` });
    try {
      const parsed = extractJson(repaired.text) as T;
      const validation = validateSchema(parsed, schema);
      if (!validation.ok) throw new Error(`FAILED_SCHEMA: ${validation.error}`);
      return { ...repaired, parsed };
    } catch (repairError) {
      return { ...repaired, ok: false, provider_status: 'FAILED_SCHEMA', error_category: 'FAILED_SCHEMA', error: repairError instanceof Error ? repairError.message : String(repairError) };
    }
  }
}

export async function healthCheck(): Promise<{ status: AIProviderHealthStatus; active_provider: SeoProviderName; providers: ProviderStatus[] }> {
  const status = await getSeoProviderStatus({ includeBrowser: false });
  return { status: status.overall, active_provider: status.active_provider, providers: status.providers };
}
