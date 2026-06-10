/**
 * Ollama Model Router — detect installed models, auto-select best for task,
 * benchmark speed, show status in UI. Offline-first.
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export type ModelRole = 'fast_chat' | 'deep_reasoning' | 'coding' | 'qa_review' | 'embeddings';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface ModelStatus {
  available: OllamaModel[];
  selected: Record<ModelRole, string | null>;
  ollama_online: boolean;
  offline_ready: boolean;
}

// Priority lists per role — first match wins
const ROLE_PRIORITY: Record<ModelRole, string[]> = {
  fast_chat:      ['qwen3:8b', 'qwen2.5:7b', 'llama3.2:3b', 'phi3:mini', 'mistral:7b'],
  deep_reasoning: ['qwen3:14b', 'qwen3:8b', 'deepseek-r1:14b', 'llama3.1:8b', 'mistral:7b'],
  coding:         ['qwen2.5-coder:7b', 'deepseek-coder-v2:16b', 'codellama:7b', 'qwen3:8b'],
  qa_review:      ['qwen3:14b', 'qwen3:8b', 'qwen2.5-coder:7b', 'llama3.1:8b'],
  embeddings:     ['nomic-embed-text', 'mxbai-embed-large', 'all-minilm'],
};

let _cache: OllamaModel[] | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

export async function getInstalledModels(force = false): Promise<OllamaModel[]> {
  if (!force && _cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { models: OllamaModel[] };
    _cache = data.models || [];
    _cacheTime = Date.now();
    return _cache;
  } catch {
    return _cache || [];
  }
}

export async function selectModel(role: ModelRole): Promise<string | null> {
  const models = await getInstalledModels();
  const names = models.map(m => m.name);
  for (const candidate of ROLE_PRIORITY[role]) {
    // Fuzzy match: "qwen3:8b" matches "qwen3:8b-q4_K_M" etc.
    const found = names.find(n => n === candidate || n.startsWith(candidate.split(':')[0] + ':'));
    if (found) return found;
  }
  // Fallback: first available non-embedding model
  if (role !== 'embeddings') {
    return names.find(n => !n.includes('embed')) || null;
  }
  return null;
}

export async function getModelStatus(): Promise<ModelStatus> {
  const models = await getInstalledModels();
  const ollamaOnline = models.length > 0 || await pingOllama();

  const selected: Record<ModelRole, string | null> = {
    fast_chat: null, deep_reasoning: null, coding: null, qa_review: null, embeddings: null,
  };
  for (const role of Object.keys(ROLE_PRIORITY) as ModelRole[]) {
    selected[role] = await selectModel(role);
  }

  const offlineReady = ollamaOnline && selected.fast_chat !== null;

  return { available: models, selected, ollama_online: ollamaOnline, offline_ready: offlineReady };
}

async function pingOllama(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function benchmarkModel(modelName: string): Promise<{ model: string; tokens_per_sec: number; ok: boolean }> {
  const start = Date.now();
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: 'Hello', stream: false }),
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json() as { eval_count?: number; eval_duration?: number };
    const elapsed = Date.now() - start;
    const tps = data.eval_duration
      ? Math.round((data.eval_count || 1) / (data.eval_duration / 1e9))
      : Math.round(1000 / elapsed * 10);
    return { model: modelName, tokens_per_sec: tps, ok: true };
  } catch {
    return { model: modelName, tokens_per_sec: 0, ok: false };
  }
}
