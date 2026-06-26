/**
 * Local Model Router — routes AI requests to local models first.
 * Cloud fallback only when: local fails, confidence too low, CEO allows.
 * Logs every local vs cloud decision.
 */

import { getModelsForRole, ModelRole, updateModelHealth } from './model-registry';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.env.GLOBAL_DIR || 'D:/Project/Master/.local-agent-global', 'models');
const LOG_PATH = path.join(LOG_DIR, 'routing-log.jsonl');

function logRouting(entry: Record<string, unknown>) {
  try {
    if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch { /* log must never crash */ }
}

export interface RoutingDecision {
  model_id: string;
  model_name: string;
  locality: 'local' | 'cloud';
  reason: string;
  fallback: boolean;
}

export function selectModel(role: ModelRole, hint?: { preferFast?: boolean; requireDeep?: boolean }): RoutingDecision | null {
  const candidates = getModelsForRole(role);
  if (!candidates.length) return null;

  // Apply hints
  let selected = candidates[0];
  if (hint?.preferFast) selected = candidates.find(m => m.avg_latency_ms < 2000) || candidates[0];
  if (hint?.requireDeep) selected = candidates.find(m => m.max_context_tokens > 50000) || candidates[candidates.length - 1];

  // Only pick cloud if no local available
  const localCandidates = candidates.filter(m => m.locality === 'local');
  if (localCandidates.length > 0) selected = localCandidates[0];

  const decision: RoutingDecision = {
    model_id: selected.id,
    model_name: selected.name,
    locality: selected.locality,
    reason: selected.locality === 'local' ? 'local_first_policy' : 'no_local_available',
    fallback: selected.locality === 'cloud',
  };

  logRouting({ ...decision, role, timestamp: new Date().toISOString() });
  return decision;
}

export function recordModelOutcome(modelId: string, success: boolean, latencyMs: number) {
  const health = success ? 'healthy' : 'degraded';
  updateModelHealth(modelId, health, latencyMs);
  logRouting({ event: 'outcome', model_id: modelId, success, latency_ms: latencyMs, timestamp: new Date().toISOString() });
}
