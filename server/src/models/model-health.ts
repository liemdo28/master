/**
 * Model Health — pings local models and updates registry health status.
 */

import { MODEL_REGISTRY, updateModelHealth } from './model-registry';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';

export async function checkOllamaHealth(): Promise<{ online: boolean; models: string[] }> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { online: false, models: [] };
    const data = await res.json() as { models?: Array<{ name: string }> };
    return { online: true, models: (data.models || []).map(m => m.name) };
  } catch { return { online: false, models: [] }; }
}

export async function refreshModelHealth(): Promise<void> {
  const { online, models } = await checkOllamaHealth();
  for (const model of MODEL_REGISTRY.filter(m => m.provider === 'ollama')) {
    const present = models.some(m => m.includes(model.name.split(':')[0]));
    updateModelHealth(model.id, online && present ? 'healthy' : online ? 'degraded' : 'offline');
  }
}

export async function getModelHealthSummary() {
  await refreshModelHealth();
  return MODEL_REGISTRY.map(m => ({
    id: m.id, name: m.name, locality: m.locality, health: m.health,
    enabled: m.enabled, role: m.role,
  }));
}
