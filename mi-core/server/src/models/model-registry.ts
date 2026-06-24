/**
 * Model Registry — single source of truth for all AI models used by Mi.
 * Tracks: name, role, provider, local/cloud, health, latency, cost, fallback priority.
 * Policy: 95% local, 5% cloud fallback only.
 */

export type ModelProvider = 'ollama' | 'openai' | 'anthropic' | 'groq' | 'local';
export type ModelRole = 'chat' | 'compliance' | 'coding' | 'embedding' | 'rerank' | 'vision' | 'ocr' | 'speech' | 'tts';
export type ModelLocality = 'local' | 'cloud';

export interface ModelDef {
  id: string;
  name: string;
  role: ModelRole[];
  provider: ModelProvider;
  locality: ModelLocality;
  enabled: boolean;
  priority: number;           // lower = higher priority within same role
  max_context_tokens: number;
  supported_tasks: string[];
  cost_per_1k_tokens: number; // 0 for local
  avg_latency_ms: number;
  success_rate: number;       // 0–1, updated at runtime
  fallback_for?: string;      // model id this is a fallback for
  health: 'healthy' | 'degraded' | 'offline' | 'unknown';
  notes?: string;
}

export const MODEL_REGISTRY: ModelDef[] = [
  // ── Local LLMs (Ollama) ─────────────────────────────────────────────────
  {
    id: 'qwen3-1.7b', name: 'qwen3:1.7b', role: ['chat'], provider: 'ollama', locality: 'local',
    enabled: true, priority: 1, max_context_tokens: 32768, cost_per_1k_tokens: 0,
    avg_latency_ms: 1500, success_rate: 0.95, health: 'unknown',
    supported_tasks: ['quick_reply', 'classification', 'simple_query'],
    notes: 'Fast model for simple queries',
  },
  {
    id: 'qwen3-8b', name: 'qwen3:8b', role: ['chat', 'compliance'], provider: 'ollama', locality: 'local',
    enabled: true, priority: 2, max_context_tokens: 65536, cost_per_1k_tokens: 0,
    avg_latency_ms: 4000, success_rate: 0.92, health: 'unknown',
    supported_tasks: ['general_chat', 'compliance_query', 'analysis', 'briefing'],
    notes: 'Balanced model — primary for most tasks',
  },
  {
    id: 'qwen3-14b', name: 'qwen3:14b', role: ['chat', 'compliance'], provider: 'ollama', locality: 'local',
    enabled: true, priority: 3, max_context_tokens: 131072, cost_per_1k_tokens: 0,
    avg_latency_ms: 8000, success_rate: 0.90, health: 'unknown',
    supported_tasks: ['deep_analysis', 'complex_reasoning', 'report_generation'],
    notes: 'Deep model for complex tasks',
  },
  {
    id: 'qwen2.5-coder-7b', name: 'qwen2.5-coder:7b', role: ['coding'], provider: 'ollama', locality: 'local',
    enabled: true, priority: 1, max_context_tokens: 32768, cost_per_1k_tokens: 0,
    avg_latency_ms: 5000, success_rate: 0.88, health: 'unknown',
    supported_tasks: ['code_generation', 'code_review', 'debugging'],
    notes: 'Primary coding model',
  },
  {
    id: 'nomic-embed-text', name: 'nomic-embed-text', role: ['embedding'], provider: 'ollama', locality: 'local',
    enabled: true, priority: 1, max_context_tokens: 8192, cost_per_1k_tokens: 0,
    avg_latency_ms: 200, success_rate: 0.99, health: 'unknown',
    supported_tasks: ['embedding', 'similarity_search', 'rag'],
    notes: 'Primary embedding model',
  },

  // ── Local Speech ────────────────────────────────────────────────────────
  {
    id: 'faster-whisper-medium', name: 'faster-whisper/medium', role: ['speech'], provider: 'local', locality: 'local',
    enabled: true, priority: 1, max_context_tokens: 0, cost_per_1k_tokens: 0,
    avg_latency_ms: 5000, success_rate: 0.85, health: 'unknown',
    supported_tasks: ['speech_to_text', 'vietnamese_asr'],
    notes: 'Vietnamese speech recognition',
  },

  // ── Cloud Fallbacks (disabled by default) ──────────────────────────────
  {
    id: 'claude-sonnet', name: 'claude-sonnet-4-6', role: ['chat', 'compliance', 'coding'], provider: 'anthropic', locality: 'cloud',
    enabled: false, priority: 10, max_context_tokens: 200000, cost_per_1k_tokens: 3,
    avg_latency_ms: 3000, success_rate: 0.99, health: 'unknown',
    supported_tasks: ['all'],
    fallback_for: 'qwen3-14b',
    notes: 'Cloud fallback — requires CEO approval to enable',
  },
  {
    id: 'gpt-4o', name: 'gpt-4o', role: ['chat', 'vision'], provider: 'openai', locality: 'cloud',
    enabled: false, priority: 11, max_context_tokens: 128000, cost_per_1k_tokens: 5,
    avg_latency_ms: 2000, success_rate: 0.99, health: 'unknown',
    supported_tasks: ['all', 'vision'],
    fallback_for: 'qwen3-14b',
    notes: 'Cloud fallback — requires CEO approval to enable',
  },
];

export function getModelsForRole(role: ModelRole): ModelDef[] {
  return MODEL_REGISTRY
    .filter(m => m.enabled && m.role.includes(role))
    .sort((a, b) => a.priority - b.priority);
}

export function getLocalModels(): ModelDef[] {
  return MODEL_REGISTRY.filter(m => m.locality === 'local' && m.enabled);
}

export function getCloudModels(): ModelDef[] {
  return MODEL_REGISTRY.filter(m => m.locality === 'cloud' && m.enabled);
}

export function updateModelHealth(id: string, health: ModelDef['health'], latency?: number, successRate?: number) {
  const model = MODEL_REGISTRY.find(m => m.id === id);
  if (!model) return;
  model.health = health;
  if (latency !== undefined) model.avg_latency_ms = latency;
  if (successRate !== undefined) model.success_rate = successRate;
}

export function getRegistrySummary() {
  const local = MODEL_REGISTRY.filter(m => m.locality === 'local' && m.enabled);
  const cloud = MODEL_REGISTRY.filter(m => m.locality === 'cloud' && m.enabled);
  const totalEnabled = MODEL_REGISTRY.filter(m => m.enabled).length;
  const localPercent = totalEnabled > 0 ? Math.round(local.length / totalEnabled * 100) : 0;
  return {
    total: MODEL_REGISTRY.length,
    enabled: totalEnabled,
    local: local.length,
    cloud: cloud.length,
    local_percent: localPercent,
    policy: '95% local / 5% cloud fallback',
    cloud_enabled: cloud.length > 0,
    models: MODEL_REGISTRY.map(m => ({
      id: m.id, role: m.role, locality: m.locality, enabled: m.enabled, health: m.health,
    })),
  };
}
