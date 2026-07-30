/**
 * Provider Router — routes prompts to the best AI provider
<<<<<<< HEAD
 * Supports: OpenAI (GPT-4o), Anthropic (Claude), Gemini, DeepSeek
 * Uses https.request directly — no SDK dependencies
=======
 * Providers: OpenAI, Anthropic, Gemini, DeepSeek, xAI (Grok)
 * No SDK deps — uses https.request directly
>>>>>>> seo/phase-29-revenue-execution-loop
 */

import https from 'https';

export type ProviderTier = 'ceo-brain' | 'coding' | 'vision';

export interface ProviderRequest {
<<<<<<< HEAD
  tier:        ProviderTier;
  prompt:      string;
  model?:      string;
  context?:    string;
  max_tokens?: number;
  temperature?: number;
  image_b64?:  string;   // base64 image for vision tier
=======
  tier:         ProviderTier;
  prompt:       string;
  model?:       string;
  context?:     string;
  max_tokens?:  number;
  temperature?: number;
  image_b64?:   string;
>>>>>>> seo/phase-29-revenue-execution-loop
}

export interface ProviderResponse {
  content:    string;
  model:      string;
  provider:   string;
  tokens:     number;
  latency_ms: number;
  error?:     string;
}

<<<<<<< HEAD
// Default model per tier
=======
>>>>>>> seo/phase-29-revenue-execution-loop
const TIER_DEFAULTS: Record<ProviderTier, { provider: string; model: string }> = {
  'ceo-brain': { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  'coding':    { provider: 'openai',    model: 'gpt-4o-mini' },
  'vision':    { provider: 'gemini',    model: 'gemini-2.0-flash' },
};

<<<<<<< HEAD
// Model → provider lookup
=======
>>>>>>> seo/phase-29-revenue-execution-loop
const MODEL_PROVIDER: Record<string, string> = {
  'gpt-4o':              'openai',
  'gpt-4o-mini':         'openai',
  'claude-opus-4-8':     'anthropic',
  'claude-sonnet-4-6':   'anthropic',
  'claude-haiku-4-5':    'anthropic',
  'gemini-2.0-flash':    'gemini',
  'gemini-1.5-pro':      'gemini',
  'deepseek-coder':      'deepseek',
  'deepseek-chat':       'deepseek',
  'grok-beta':           'xai',
  'grok-2':              'xai',
  'grok-2-mini':         'xai',
};

export async function routeToProvider(req: ProviderRequest): Promise<ProviderResponse> {
<<<<<<< HEAD
  const start = Date.now();

=======
  const start    = Date.now();
>>>>>>> seo/phase-29-revenue-execution-loop
  const defaults = TIER_DEFAULTS[req.tier];
  const model    = req.model || defaults.model;
  const provider = MODEL_PROVIDER[model] || defaults.provider;

  const messages: { role: string; content: string }[] = [];
  if (req.context) messages.push({ role: 'system', content: req.context });
  messages.push({ role: 'user', content: req.prompt });

  try {
    switch (provider) {
<<<<<<< HEAD
      case 'openai':    return await callOpenAI(model, messages, req, start);
      case 'anthropic': return await callAnthropic(model, messages, req, start);
      case 'gemini':    return await callGemini(model, req, start);
      case 'deepseek':  return await callDeepSeek(model, messages, req, start);
      case 'xai':       return await callXAI(model, messages, req, start);
=======
      case 'openai':    return callOpenAI(model, messages, req, start);
      case 'anthropic': return callAnthropic(model, messages, req, start);
      case 'gemini':    return callGemini(model, req, start);
      case 'deepseek':  return callDeepSeek(model, messages, req, start);
      case 'xai':       return callXAI(model, messages, req, start);
>>>>>>> seo/phase-29-revenue-execution-loop
      default:
        return { content: '', model, provider, tokens: 0, latency_ms: 0, error: `Unknown provider: ${provider}` };
    }
  } catch (e: any) {
    return { content: '', model, provider, tokens: 0, latency_ms: Date.now() - start, error: e.message };
  }
}

function post(options: https.RequestOptions, body: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

<<<<<<< HEAD
async function callOpenAI(
  model: string,
  messages: any[],
  req: ProviderRequest,
  start: number,
): Promise<ProviderResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { content: '', model, provider: 'openai', tokens: 0, latency_ms: 0, error: 'OPENAI_API_KEY not set' };

  const body = JSON.stringify({
    model,
    messages,
    max_tokens:  req.max_tokens  || 1024,
    temperature: req.temperature ?? 0.3,
  });

  const raw = await post({
    hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  const j = JSON.parse(raw);
  if (j.error) return { content: '', model, provider: 'openai', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
  return {
    content:    j.choices?.[0]?.message?.content || '',
    model,
    provider:   'openai',
    tokens:     j.usage?.total_tokens || 0,
    latency_ms: Date.now() - start,
  };
}

async function callAnthropic(
  model: string,
  messages: any[],
  req: ProviderRequest,
  start: number,
): Promise<ProviderResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { content: '', model, provider: 'anthropic', tokens: 0, latency_ms: 0, error: 'ANTHROPIC_API_KEY not set' };

  const system  = messages.find(m => m.role === 'system')?.content;
  const filtered = messages.filter(m => m.role !== 'system');

  const body = JSON.stringify({
    model,
    max_tokens:  req.max_tokens || 1024,
    ...(system ? { system } : {}),
    messages: filtered,
  });

  const raw = await post({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: {
      'x-api-key':          key,
      'anthropic-version':  '2023-06-01',
      'Content-Type':       'application/json',
      'Content-Length':     Buffer.byteLength(body),
    },
  }, body);

  const j = JSON.parse(raw);
  if (j.error) return { content: '', model, provider: 'anthropic', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
  return {
    content:    j.content?.[0]?.text || '',
    model,
    provider:   'anthropic',
    tokens:     (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0),
    latency_ms: Date.now() - start,
  };
}

async function callGemini(
  model: string,
  req: ProviderRequest,
  start: number,
): Promise<ProviderResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { content: '', model, provider: 'gemini', tokens: 0, latency_ms: 0, error: 'GEMINI_API_KEY not set' };

  const body = JSON.stringify({
    contents: [{ parts: [{ text: req.prompt }] }],
    generationConfig: {
      maxOutputTokens: req.max_tokens || 1024,
      temperature:     req.temperature ?? 0.3,
    },
  });

  const path = `/v1beta/models/${model}:generateContent?key=${key}`;
  const raw = await post({
    hostname: 'generativelanguage.googleapis.com', path, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);

  const j = JSON.parse(raw);
  if (j.error) return { content: '', model, provider: 'gemini', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
  return {
    content:    j.candidates?.[0]?.content?.parts?.[0]?.text || '',
    model,
    provider:   'gemini',
    tokens:     j.usageMetadata?.totalTokenCount || 0,
    latency_ms: Date.now() - start,
  };
}

async function callDeepSeek(
  model: string,
  messages: any[],
  req: ProviderRequest,
  start: number,
): Promise<ProviderResponse> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return { content: '', model, provider: 'deepseek', tokens: 0, latency_ms: 0, error: 'DEEPSEEK_API_KEY not set' };

  const body = JSON.stringify({
    model,
    messages,
    max_tokens:  req.max_tokens  || 1024,
    temperature: req.temperature ?? 0.3,
  });

  const raw = await post({
    hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, body);

  const j = JSON.parse(raw);
  if (j.error) return { content: '', model, provider: 'deepseek', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
  return {
    content:    j.choices?.[0]?.message?.content || '',
    model,
    provider:   'deepseek',
    tokens:     j.usage?.total_tokens || 0,
    latency_ms: Date.now() - start,
  };
}

// ── xAI (Grok) — OpenAI-compatible endpoint ───────────────────────────────────
async function callXAI(model: string, messages: any[], req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.XAI_API_KEY;
  if (!key) return { content: '', model, provider: 'xai', tokens: 0, latency_ms: 0, error: 'XAI_API_KEY not set' };
  const body = JSON.stringify({ model, messages, max_tokens: req.max_tokens || 1024, temperature: req.temperature ?? 0.3 });
  const raw = await post({
    hostname: 'api.x.ai', path: '/v1/chat/completions', method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body);
  const j = JSON.parse(raw);
  if (j.error) return { content: '', model, provider: 'xai', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
  return { content: j.choices?.[0]?.message?.content || '', model, provider: 'xai', tokens: j.usage?.total_tokens || 0, latency_ms: Date.now() - start };
=======
function callOpenAI(model: string, messages: any[], req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return Promise.resolve({ content: '', model, provider: 'openai', tokens: 0, latency_ms: 0, error: 'OPENAI_API_KEY not set' });
  const body = JSON.stringify({ model, messages, max_tokens: req.max_tokens || 1024, temperature: req.temperature ?? 0.3 });
  return post({
    hostname: 'api.openai.com', path: '/v1/chat/completions', method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body).then(raw => {
    const j = JSON.parse(raw);
    if (j.error) return { content: '', model, provider: 'openai', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
    return { content: j.choices?.[0]?.message?.content || '', model, provider: 'openai', tokens: j.usage?.total_tokens || 0, latency_ms: Date.now() - start };
  });
}

function callAnthropic(model: string, messages: any[], req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Promise.resolve({ content: '', model, provider: 'anthropic', tokens: 0, latency_ms: 0, error: 'ANTHROPIC_API_KEY not set' });
  const system   = messages.find(m => m.role === 'system')?.content;
  const filtered = messages.filter(m => m.role !== 'system');
  const body = JSON.stringify({ model, max_tokens: req.max_tokens || 1024, ...(system ? { system } : {}), messages: filtered });
  return post({
    hostname: 'api.anthropic.com', path: '/v1/messages', method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body).then(raw => {
    const j = JSON.parse(raw);
    if (j.error) return { content: '', model, provider: 'anthropic', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
    return { content: j.content?.[0]?.text || '', model, provider: 'anthropic', tokens: (j.usage?.input_tokens || 0) + (j.usage?.output_tokens || 0), latency_ms: Date.now() - start };
  });
}

function callGemini(model: string, req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return Promise.resolve({ content: '', model, provider: 'gemini', tokens: 0, latency_ms: 0, error: 'GEMINI_API_KEY not set' });

  const parts: any[] = [{ text: req.prompt }];
  if (req.image_b64) parts.unshift({ inlineData: { mimeType: 'image/jpeg', data: req.image_b64 } });

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: req.max_tokens || 1024, temperature: req.temperature ?? 0.3 },
  });
  return post({
    hostname: 'generativelanguage.googleapis.com', path: `/v1beta/models/${model}:generateContent?key=${key}`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body).then(raw => {
    const j = JSON.parse(raw);
    if (j.error) return { content: '', model, provider: 'gemini', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
    return { content: j.candidates?.[0]?.content?.parts?.[0]?.text || '', model, provider: 'gemini', tokens: j.usageMetadata?.totalTokenCount || 0, latency_ms: Date.now() - start };
  });
}

function callDeepSeek(model: string, messages: any[], req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return Promise.resolve({ content: '', model, provider: 'deepseek', tokens: 0, latency_ms: 0, error: 'DEEPSEEK_API_KEY not set' });
  const body = JSON.stringify({ model, messages, max_tokens: req.max_tokens || 1024, temperature: req.temperature ?? 0.3 });
  return post({
    hostname: 'api.deepseek.com', path: '/v1/chat/completions', method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body).then(raw => {
    const j = JSON.parse(raw);
    if (j.error) return { content: '', model, provider: 'deepseek', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
    return { content: j.choices?.[0]?.message?.content || '', model, provider: 'deepseek', tokens: j.usage?.total_tokens || 0, latency_ms: Date.now() - start };
  });
}

// ── xAI (Grok) — OpenAI-compatible API ───────────────────────────────────────
function callXAI(model: string, messages: any[], req: ProviderRequest, start: number): Promise<ProviderResponse> {
  const key = process.env.XAI_API_KEY;
  if (!key) return Promise.resolve({ content: '', model, provider: 'xai', tokens: 0, latency_ms: 0, error: 'XAI_API_KEY not set' });
  const body = JSON.stringify({ model, messages, max_tokens: req.max_tokens || 1024, temperature: req.temperature ?? 0.3 });
  return post({
    hostname: 'api.x.ai', path: '/v1/chat/completions', method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, body).then(raw => {
    const j = JSON.parse(raw);
    if (j.error) return { content: '', model, provider: 'xai', tokens: 0, latency_ms: Date.now() - start, error: j.error.message };
    return { content: j.choices?.[0]?.message?.content || '', model, provider: 'xai', tokens: j.usage?.total_tokens || 0, latency_ms: Date.now() - start };
  });
>>>>>>> seo/phase-29-revenue-execution-loop
}

export function listProviders(): { provider: string; configured: boolean; models: string[] }[] {
  return [
    { provider: 'openai',    configured: !!process.env.OPENAI_API_KEY,    models: ['gpt-4o', 'gpt-4o-mini'] },
    { provider: 'anthropic', configured: !!process.env.ANTHROPIC_API_KEY, models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'] },
    { provider: 'gemini',    configured: !!process.env.GEMINI_API_KEY,    models: ['gemini-2.0-flash', 'gemini-1.5-pro'] },
    { provider: 'deepseek',  configured: !!process.env.DEEPSEEK_API_KEY,  models: ['deepseek-coder', 'deepseek-chat'] },
    { provider: 'xai',       configured: !!process.env.XAI_API_KEY,       models: ['grok-2', 'grok-2-mini', 'grok-beta'] },
  ];
}
