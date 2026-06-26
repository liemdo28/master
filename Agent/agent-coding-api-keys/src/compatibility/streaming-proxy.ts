/**
 * Real SSE streaming proxy with on-the-fly protocol transformation.
 *
 * Three modes:
 *  1. pipeAnthropicToOpenAIStream — upstream speaks Anthropic SSE, client wants OpenAI SSE
 *  2. pipeStream — pass-through (same format both sides)
 *
 * The Anthropic→OpenAI transform handles:
 *  - text_delta → content delta
 *  - tool_use content_block_start → tool_calls id/name chunk
 *  - input_json_delta → tool_calls arguments chunk
 *  - message_delta stop_reason → finish_reason mapping
 */

import type http from 'node:http';

interface SSEEvent {
  event: string;
  data: string;
}

async function* sseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let remainder = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (remainder) yield remainder;
        break;
      }
      const text = decoder.decode(value, { stream: true });
      const lines = (remainder + text).split('\n');
      remainder = lines.pop() ?? '';
      for (const line of lines) yield line;
    }
  } finally {
    reader.releaseLock();
  }
}

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  let event = '';
  const data: string[] = [];

  for await (const rawLine of sseLines(body)) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line === '') {
      if (data.length > 0) {
        yield { event, data: data.join('\n') };
      }
      event = '';
      data.length = 0;
    } else if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data.push(line.slice(5).trim());
    }
    // ignore comment lines (':')
  }

  if (data.length > 0) yield { event, data: data.join('\n') };
}

/** Pass SSE stream through unchanged (same protocol both sides). */
export async function pipeStream(upstream: Response, res: http.ServerResponse): Promise<void> {
  if (!upstream.body) {
    res.write('data: [DONE]\n\n');
    return;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Stream peek helpers ───────────────────────────────────────────────────────

export interface StreamPeekOk {
  ok: true;
  /** Reconstructed upstream Response with peeked bytes prepended. */
  upstream: Response;
}

export interface StreamPeekError {
  ok: false;
  errorType: string;
  errorMessage: string;
}

export type StreamPeekResult = StreamPeekOk | StreamPeekError;

/**
 * Reads the first complete SSE event from an Anthropic stream WITHOUT consuming it.
 *
 * If the first event is an error (e.g. overloaded_error, api_error), returns
 * {ok:false} so the caller can avoid committing HTTP 200 and retry the request.
 *
 * If the first event is message_start (or any non-error event), returns
 * {ok:true, upstream} where upstream is a RECONSTRUCTED Response whose body
 * replays the already-read bytes before continuing from the original reader.
 *
 * This lets server.ts call res.writeHead(200) only AFTER confirming the stream
 * is healthy — enabling transparent provider fallback for transient overload errors.
 */
export async function peekAnthropicStreamStart(
  upstream: Response,
): Promise<StreamPeekResult> {
  if (!upstream.body) {
    return { ok: true, upstream };
  }

  const reader = upstream.body.getReader();
  const bufferedChunks: Uint8Array[] = [];
  const decoder = new TextDecoder();
  let text = '';
  let timedOut = false;

  // Read until we've seen at least one complete SSE event (blank line separator)
  // Timeout after 15 s to avoid hanging forever.
  const timeout = setTimeout(() => { timedOut = true; }, 15_000);

  try {
    outer: while (!timedOut) {
      const { done, value } = await reader.read();
      if (done) break;
      bufferedChunks.push(value);
      text += decoder.decode(value, { stream: true });
      // An SSE event ends with \n\n (or \r\n\r\n)
      if (text.includes('\n\n') || text.includes('\r\n\r\n')) break outer;
    }
  } finally {
    clearTimeout(timeout);
  }

  // Parse the buffered text to find the first event
  const lines = text.split(/\r?\n/);
  let eventType = '';
  let dataLines: string[] = [];

  for (const line of lines) {
    if (line === '') {
      if (dataLines.length > 0) break; // first complete event found
    } else if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const dataStr = dataLines.join('\n');
  let parsed: Record<string, unknown> = {};
  try { parsed = JSON.parse(dataStr) as Record<string, unknown>; } catch { /* ignore */ }

  const resolvedType = eventType || String(parsed['type'] ?? '');

  if (!resolvedType) {
    const sample = text.trim().slice(0, 160);
    reader.releaseLock();
    return {
      ok: false,
      errorType: 'stream_protocol_error',
      errorMessage: sample
        ? `Invalid Anthropic SSE start: ${sample}`
        : 'Invalid Anthropic SSE start: no event data received',
    };
  }

  if (resolvedType === 'error') {
    const err = (parsed['error'] ?? parsed) as Record<string, unknown>;
    reader.releaseLock();
    return {
      ok: false,
      errorType:    String(err['type']    ?? 'api_error'),
      errorMessage: String(err['message'] ?? 'Unknown upstream error'),
    };
  }

  // Not an error — reconstruct a new Response whose body replays the buffered
  // chunks first, then continues from the original reader.
  const reconstructed = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of bufferedChunks) {
        controller.enqueue(chunk);
      }
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });

  const newResponse = new Response(reconstructed, {
    status: upstream.status,
    headers: upstream.headers,
  });

  return { ok: true, upstream: newResponse };
}

/** Transform Anthropic SSE stream → OpenAI SSE chunks in real time. */
export async function pipeAnthropicToOpenAIStream(
  upstream: Response,
  res: http.ServerResponse,
  completionId: string,
  created: number,
  model: string,
  providerId: string,
): Promise<void> {
  if (!upstream.body) {
    res.write('data: [DONE]\n\n');
    return;
  }

  // Track tool_use blocks by Anthropic block index
  const toolByIndex = new Map<number, { toolIndex: number; id: string; name: string }>();
  let nextToolIndex = 0;
  let hasEmittedRole = false;

  const emit = (choices: unknown[]) => {
    const chunk = {
      id: completionId,
      object: 'chat.completion.chunk',
      created,
      model,
      provider: providerId,
      choices,
    };
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  };

  const emitRole = () => {
    if (!hasEmittedRole) {
      emit([{ index: 0, delta: { role: 'assistant', content: null }, finish_reason: null }]);
      hasEmittedRole = true;
    }
  };

  for await (const { event, data } of parseSSE(upstream.body)) {
    if (data === '[DONE]') {
      res.write('data: [DONE]\n\n');
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = event || String(parsed.type ?? '');

    switch (type) {
      case 'message_start': {
        emitRole();
        break;
      }

      case 'content_block_start': {
        const block = (parsed.content_block ?? {}) as Record<string, unknown>;
        const blockIdx = Number(parsed.index ?? 0);

        if (block.type === 'tool_use') {
          emitRole();
          const toolId = String(block.id ?? `tool-${Date.now()}`);
          const toolName = String(block.name ?? '');
          const toolIndex = nextToolIndex++;
          toolByIndex.set(blockIdx, { toolIndex, id: toolId, name: toolName });
          emit([{
            index: 0,
            delta: {
              tool_calls: [{
                index: toolIndex,
                id: toolId,
                type: 'function',
                function: { name: toolName, arguments: '' },
              }],
            },
            finish_reason: null,
          }]);
        }
        break;
      }

      case 'content_block_delta': {
        const delta = (parsed.delta ?? {}) as Record<string, unknown>;
        const blockIdx = Number(parsed.index ?? 0);

        if (delta.type === 'text_delta') {
          emitRole();
          emit([{ index: 0, delta: { content: String(delta.text ?? '') }, finish_reason: null }]);
        } else if (delta.type === 'input_json_delta') {
          const tool = toolByIndex.get(blockIdx);
          if (tool) {
            emit([{
              index: 0,
              delta: {
                tool_calls: [{
                  index: tool.toolIndex,
                  function: { arguments: String(delta.partial_json ?? '') },
                }],
              },
              finish_reason: null,
            }]);
          }
        } else if (delta.type === 'thinking_delta') {
          // Swallow thinking deltas — not representable in OpenAI format
        }
        break;
      }

      case 'message_delta': {
        const delta = (parsed.delta ?? {}) as Record<string, unknown>;
        const stopReason = String(delta.stop_reason ?? '');
        const finishReason =
          stopReason === 'tool_use' ? 'tool_calls'
          : stopReason === 'end_turn' ? 'stop'
          : stopReason || 'stop';
        emit([{ index: 0, delta: {}, finish_reason: finishReason }]);
        break;
      }

      case 'message_stop': {
        res.write('data: [DONE]\n\n');
        return;
      }

      case 'error': {
        const err = (parsed.error ?? parsed) as Record<string, unknown>;
        const errType = String(err.type ?? 'api_error');
        const errMsg  = String(err.message ?? 'Unknown upstream error');
        console.error(`[UPSTREAM ERROR]\n  PROVIDER: ${providerId}\n  STATUS: 200-but-SSE-error-event\n  TYPE: ${errType}\n  MESSAGE: ${errMsg}\n  RAW: ${JSON.stringify(err).slice(0, 500)}`);
        const errChunk = {
          error: { type: errType, message: errMsg, providerId },
        };
        res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        return;
      }
    }
  }

  res.write('data: [DONE]\n\n');
}

/** Transform OpenAI SSE stream → Anthropic SSE events in real time. */
export async function pipeOpenAIToAnthropicStream(
  upstream: Response,
  res: http.ServerResponse,
  msgId: string,
  model: string,
  providerId: string,
): Promise<void> {
  if (!upstream.body) {
    res.write(`event: message_stop\ndata: {"type":"message_stop"}\n\n`);
    return;
  }

  const sse = (event: string, data: unknown) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  let initialized = false;
  // Track tool_call index → Anthropic block index
  const toolCallToBlock = new Map<number, number>();
  let nextBlockIndex = 0;
  let textBlockIndex = -1;

  for await (const { data } of parseSSE(upstream.body)) {
    if (data === '[DONE]') {
      sse('message_stop', { type: 'message_stop' });
      return;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const choices = parsed.choices as Array<Record<string, unknown>> | undefined;
    if (!choices?.length) continue;
    const choice = choices[0] as Record<string, unknown>;
    const delta = (choice.delta ?? {}) as Record<string, unknown>;

    if (!initialized) {
      sse('message_start', {
        type: 'message_start',
        message: { id: msgId, type: 'message', role: 'assistant', content: [], model, stop_reason: null, usage: { input_tokens: 0, output_tokens: 0 } },
      });
      initialized = true;
    }

    if (delta.content !== undefined && delta.content !== null) {
      if (textBlockIndex === -1) {
        textBlockIndex = nextBlockIndex++;
        sse('content_block_start', { type: 'content_block_start', index: textBlockIndex, content_block: { type: 'text', text: '' } });
      }
      sse('content_block_delta', { type: 'content_block_delta', index: textBlockIndex, delta: { type: 'text_delta', text: String(delta.content) } });
    }

    const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        const tcIdx = Number(tc.index ?? 0);
        if (!toolCallToBlock.has(tcIdx)) {
          const blockIdx = nextBlockIndex++;
          toolCallToBlock.set(tcIdx, blockIdx);
          const fn = (tc.function ?? {}) as Record<string, unknown>;
          sse('content_block_start', {
            type: 'content_block_start',
            index: blockIdx,
            content_block: { type: 'tool_use', id: String(tc.id ?? ''), name: String(fn.name ?? ''), input: {} },
          });
        }
        const blockIdx = toolCallToBlock.get(tcIdx)!;
        const fn = (tc.function ?? {}) as Record<string, unknown>;
        if (fn.arguments) {
          sse('content_block_delta', {
            type: 'content_block_delta',
            index: blockIdx,
            delta: { type: 'input_json_delta', partial_json: String(fn.arguments) },
          });
        }
      }
    }

    const finishReason = String(choice.finish_reason ?? '');
    if (finishReason) {
      // Close open blocks
      for (const idx of toolCallToBlock.values()) {
        sse('content_block_stop', { type: 'content_block_stop', index: idx });
      }
      if (textBlockIndex >= 0) {
        sse('content_block_stop', { type: 'content_block_stop', index: textBlockIndex });
      }
      const stopReason = finishReason === 'tool_calls' ? 'tool_use' : finishReason === 'stop' ? 'end_turn' : finishReason;
      sse('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 0 } });
      sse('message_stop', { type: 'message_stop' });
      return;
    }
  }

  if (!initialized) {
    sse('message_stop', { type: 'message_stop' });
  }
}
