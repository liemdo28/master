/**
 * Antigravity Gateway — Protocol Registry
 *
 * The gateway supports two inbound protocols:
 *  - Anthropic Messages API  (/v1/messages)
 *  - OpenAI Chat Completions (/v1/chat/completions)
 *
 * And routes to providers speaking any of:
 *  - Anthropic (native)
 *  - OpenAI-compatible (opusmax, openrouter, deepseek, gemini, ollama)
 *
 * All provider-side streaming transforms live in src/streaming/.
 * All tool format conversions live in src/tools/.
 */

export * from './anthropic.js';
export * from './openai.js';

export type InboundProtocol = 'anthropic' | 'openai';

/** Detect which inbound protocol a request uses based on its pathname. */
export function detectInboundProtocol(pathname: string): InboundProtocol {
  if (pathname === '/v1/messages' || pathname === '/messages') return 'anthropic';
  return 'openai';
}

export const PROTOCOL_SUMMARY = {
  anthropic: {
    name: 'Anthropic Messages API',
    inboundPath: '/v1/messages',
    supportsTools: true,
    supportsThinking: true,
    supportsStreaming: true,
  },
  openai: {
    name: 'OpenAI Chat Completions',
    inboundPath: '/v1/chat/completions',
    supportsTools: true,
    supportsThinking: false,
    supportsStreaming: true,
  },
} as const;
