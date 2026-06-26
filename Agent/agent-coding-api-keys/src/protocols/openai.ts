/**
 * Antigravity Gateway — OpenAI Protocol Layer
 *
 * This module owns everything about the OpenAI Chat Completions API:
 *  - Protocol metadata & feature flags
 *  - Request normalisation (OpenAI wire → Universal)
 *  - Response serialisation (Universal → OpenAI wire)
 *  - SSE stream simulation from a buffered Universal response
 *
 * Server and router import from here; never from src/adapters directly.
 * src/adapters/openai-adapter.ts is preserved for backward compat.
 */

export {
  openAIToUniversal,
  universalToOpenAI,
  openAIStreamChunk,
} from '../adapters/openai-adapter.js';

// ── Protocol metadata ──────────────────────────────────────────────────────

export const OPENAI_PROTOCOL = {
  name: 'OpenAI Chat Completions API',
  version: 'v1',
  endpoint: '/v1/chat/completions',
  requiredHeaders: ['Authorization'],
  optionalHeaders: ['OpenAI-Organization'],
  features: {
    tools: true,
    thinking: false,
    streaming: true,
    vision: true,
    systemPrompt: true,
    toolChoice: true,
    functionCalling: true,
    maxTokens: 32_768,
  },
} as const;

/** Detect if an incoming HTTP request targets the OpenAI-compatible protocol. */
export function isOpenAIRequest(pathname: string): boolean {
  return pathname === '/v1/chat/completions' || pathname === '/chat/completions';
}

/** Required headers to forward to an OpenAI-compatible upstream. */
export function buildOpenAIHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

/** Map OpenAI finish_reason → Universal finish reason string. */
export function normaliseFinishReason(openAIReason: string | null | undefined): string {
  switch (openAIReason) {
    case 'tool_calls': return 'tool_use';
    case 'stop': return 'stop';
    case 'length': return 'max_tokens';
    case 'content_filter': return 'content_filter';
    default: return openAIReason ?? 'stop';
  }
}

/** Map Universal finish reason → OpenAI finish_reason. */
export function toOpenAIFinishReason(universalReason: string): string {
  switch (universalReason) {
    case 'tool_use': return 'tool_calls';
    case 'stop': return 'stop';
    case 'max_tokens': return 'length';
    default: return universalReason;
  }
}
