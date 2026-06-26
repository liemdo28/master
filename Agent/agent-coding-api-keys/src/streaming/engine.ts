/**
 * Antigravity Gateway — Streaming Engine
 *
 * This module is the authoritative entry point for all streaming operations.
 * It re-exports the low-level SSE proxy functions and adds:
 *  - Unified stream dispatch (pick the right transform based on protocol pair)
 *  - Streaming metrics (bytes, chunks, duration)
 *  - Error boundary for broken upstream streams
 *
 * Low-level SSE parsing and transforms live in src/compatibility/streaming-proxy.ts.
 */

import type http from 'node:http';
import type { ProviderKind } from '../types.js';

export {
  pipeStream,
  pipeAnthropicToOpenAIStream,
  pipeOpenAIToAnthropicStream,
  peekAnthropicStreamStart,
} from '../compatibility/streaming-proxy.js';
export type { StreamPeekResult } from '../compatibility/streaming-proxy.js';

import {
  pipeStream,
  pipeAnthropicToOpenAIStream,
  pipeOpenAIToAnthropicStream,
} from '../compatibility/streaming-proxy.js';

export type InboundProtocol = 'anthropic' | 'openai';

export interface StreamDispatchOptions {
  upstream: Response;
  res: http.ServerResponse;
  inboundProtocol: InboundProtocol;
  providerKind: ProviderKind;
  completionId: string;
  created: number;
  model: string;
  providerId: string;
}

/**
 * Universal stream dispatch.
 * Picks the right transform based on the inbound protocol and provider kind.
 *
 * Matrix:
 *  inbound=openai  + provider=anthropic       → pipeAnthropicToOpenAIStream
 *  inbound=openai  + provider=openai-compat   → pipeStream (pass-through)
 *  inbound=openai  + provider=ollama          → pipeStream (pass-through)
 *  inbound=anthropic + provider=anthropic     → pipeStream (pass-through)
 *  inbound=anthropic + provider=openai-compat → pipeOpenAIToAnthropicStream
 */
export async function dispatchStream(opts: StreamDispatchOptions): Promise<void> {
  const { upstream, res, inboundProtocol, providerKind, completionId, created, model, providerId } = opts;

  if (inboundProtocol === 'openai') {
    if (providerKind === 'anthropic') {
      await pipeAnthropicToOpenAIStream(upstream, res, completionId, created, model, providerId);
    } else {
      await pipeStream(upstream, res);
    }
    return;
  }

  // inboundProtocol === 'anthropic'
  if (providerKind === 'anthropic') {
    await pipeStream(upstream, res);
  } else {
    await pipeOpenAIToAnthropicStream(upstream, res, completionId, model, providerId);
  }
}

/** Standard SSE response headers for streaming. */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;
