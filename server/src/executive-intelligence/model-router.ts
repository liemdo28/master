/**
 * Executive Model Router — Phase 21
 *
 * Routes LLM calls to the appropriate model based on role.
 * Uses env vars for configuration, falls back to sensible defaults.
 *
 * Roles:
 *   intent/planner/decision/reflection/brief → qwen3:14b (deep reasoning)
 *   tools (execution, coding, QA) → qwen3:8b (fast, tool-capable)
 *   embeddings → qwen3-embedding or nomic-embed-text
 *   premium → qwen3.6:27b (optional, heavy compute)
 */

import { ExecutiveModelRole, ModelRoute } from './types';

// ── Model configuration from env ──────────────────────────────────────────────

const MODELS: Record<ExecutiveModelRole, string> = {
  intent:      process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  planner:     process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  reasoner:    process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  decision:    process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  reflection:  process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  brief:       process.env.MI_EXEC_MODEL        || 'qwen3:14b',
  tools:       process.env.MI_EXEC_TOOL_MODEL   || 'qwen3:8b',
  embeddings:  process.env.MI_EMBED_MODEL       || 'nomic-embed-text',
  premium:     process.env.MI_EXEC_PREMIUM_MODEL || 'qwen3.6:27b',
};

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the model name for a given executive role.
 */
export function getModelForRole(role: ExecutiveModelRole): string {
  return MODELS[role];
}

/**
 * Get all configured model routes (for health/status reporting).
 */
export function getModelRoutes(): Record<string, string> {
  const routes: Record<string, string> = {};
  for (const [role, model] of Object.entries(MODELS)) {
    routes[role] = model;
  }
  return routes;
}

/**
 * Build a ModelRoute object for a given role.
 */
export function buildModelRoute(role: ExecutiveModelRole): ModelRoute {
  return {
    role,
    model: MODELS[role],
    provider: 'ollama',
  };
}

/**
 * Check if Ollama is reachable.
 */
export async function checkOllamaHealth(): Promise<{ reachable: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { reachable: false, models: [] };
    const data = await res.json() as { models?: Array<{ name: string }> };
    return {
      reachable: true,
      models: (data.models || []).map(m => m.name),
    };
  } catch {
    return { reachable: false, models: [] };
  }
}

/**
 * Get the Ollama base URL.
 */
export function getOllamaBaseUrl(): string {
  return OLLAMA_BASE;
}
