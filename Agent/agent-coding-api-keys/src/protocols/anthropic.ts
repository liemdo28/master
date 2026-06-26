/**
 * Antigravity Gateway — Anthropic Protocol Layer
 *
 * This module owns everything about the Anthropic Messages API:
 *  - Protocol metadata & feature flags
 *  - Request normalisation (Anthropic wire → Universal)
 *  - Response serialisation (Universal → Anthropic wire)
 *  - SSE stream simulation from a buffered Universal response
 *
 * Server and router import from here; never from src/adapters directly.
 * src/adapters/anthropic-adapter.ts is preserved for backward compat.
 */

export {
  anthropicToUniversal,
  universalToAnthropic,
  anthropicStream,
} from '../adapters/anthropic-adapter.js';

// ── Protocol metadata ──────────────────────────────────────────────────────

export const ANTHROPIC_PROTOCOL = {
  name: 'Anthropic Messages API',
  version: '2023-06-01',
  endpoint: '/v1/messages',
  requiredHeaders: ['anthropic-version'],
  optionalHeaders: ['anthropic-beta', 'x-api-key'],
  features: {
    tools: true,
    thinking: true,
    streaming: true,
    vision: true,
    systemPrompt: true,
    toolChoice: true,
    maxTokens: 32_000,
  },
} as const;

/** Detect if an incoming HTTP request targets the Anthropic protocol. */
export function isAnthropicRequest(pathname: string): boolean {
  return pathname === '/v1/messages' || pathname === '/messages';
}

/** Required headers to forward to an Anthropic-protocol upstream. */
export function buildAnthropicHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_PROTOCOL.version,
    ...extra,
  };
}
