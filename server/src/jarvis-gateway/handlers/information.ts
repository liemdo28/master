/**
 * INFORMATION — catch-all for free-text that the deterministic classifier
 * didn't match to a more specific type. Directive §13/§14: reuses the
 * existing canonical provider-router (services/ai-client.ts's askAi(),
 * itself a thin wrapper over providers/provider-router.ts, which already
 * has multi-provider fallback and a circuit breaker around Ollama) — no new
 * model-routing layer, and no silent provider substitution beyond what the
 * canonical router itself already does. If every provider fails, this
 * reports DEGRADED honestly rather than inventing content (§14).
 */
import { askAi } from '../../services/ai-client';
import type { JarvisResponse } from '../types';
import { baseResponse } from '../response';

export async function handleInformation(requestId: string, text: string, projectId: string | null): Promise<JarvisResponse> {
  const response = baseResponse(requestId, 'INFORMATION', projectId);
  try {
    const result = await askAi([{ role: 'user', content: text }]);
    response.answer = result.text;
    response.inferences = [{ kind: 'INFERENCE', statement: result.text }];
    response.status = 'ANSWERED';
  } catch (err) {
    response.status = 'DEGRADED';
    response.answer = 'No model provider is currently available to answer this — try a more specific request (task, project, goal, knowledge, health) that can be answered deterministically.';
    response.unknowns = [err instanceof Error ? err.message : 'model provider unavailable'];
    response.degradedCapabilities = ['Free-text generation is unavailable.'];
  }
  return response;
}
