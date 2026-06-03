import type {
  AnthropicTool,
  AnthropicToolChoice,
  ContentBlock,
  TextBlock,
  ToolUseBlock,
  UniversalChatRequest,
  UniversalChatResponse,
} from '../types.js';

/**
 * Convert an incoming Anthropic-format request (/v1/messages) to Universal format.
 * Messages are already in Anthropic-native format, so this is mostly field mapping.
 */
export function anthropicToUniversal(body: Record<string, unknown>): UniversalChatRequest {
  return {
    model: String(body.model ?? 'default'),
    messages: (body.messages as UniversalChatRequest['messages']) ?? [],
    system: typeof body.system === 'string' ? body.system : undefined,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : 4096,
    stream: body.stream === true,
    tools: Array.isArray(body.tools) ? (body.tools as AnthropicTool[]) : undefined,
    toolChoice: body.tool_choice as AnthropicToolChoice | undefined,
    metadata:
      typeof body.metadata === 'object' && body.metadata
        ? (body.metadata as Record<string, unknown>)
        : undefined,
    thinking:
      typeof body.thinking === 'object' && body.thinking
        ? (body.thinking as { type: 'enabled'; budget_tokens: number })
        : undefined,
  };
}

/**
 * Convert a Universal response to Anthropic Messages API format.
 * Content blocks pass through as-is (they are already in Anthropic format).
 */
export function universalToAnthropic(response: UniversalChatResponse): Record<string, unknown> {
  const stopReason =
    response.finishReason === 'stop' ? 'end_turn'
    : response.finishReason === 'tool_use' ? 'tool_use'
    : response.finishReason || 'end_turn';

  return {
    id: response.id,
    type: 'message',
    role: 'assistant',
    model: response.model,
    content: response.content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: response.usage.inputTokens,
      output_tokens: response.usage.outputTokens,
    },
    _gateway_provider: response.providerId,
  };
}

/**
 * Build a fake-streaming Anthropic SSE response from a complete Universal response.
 * Used as fallback when real streaming unavailable (e.g. non-streaming provider
 * serving a streaming client request).
 */
export function anthropicStream(response: UniversalChatResponse): string {
  const message = universalToAnthropic(response);
  const sse = (event: string, data: unknown) =>
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  const events: string[] = [
    sse('message_start', {
      type: 'message_start',
      message: { ...message, content: [], stop_reason: null },
    }),
  ];

  let blockIndex = 0;
  for (const block of response.content) {
    if (block.type === 'text') {
      const textBlock = block as TextBlock;
      events.push(sse('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } }));
      events.push(sse('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: textBlock.text } }));
      events.push(sse('content_block_stop', { type: 'content_block_stop', index: blockIndex }));
    } else if (block.type === 'tool_use') {
      const tb = block as ToolUseBlock;
      events.push(sse('content_block_start', { type: 'content_block_start', index: blockIndex, content_block: { type: 'tool_use', id: tb.id, name: tb.name, input: {} } }));
      events.push(sse('content_block_delta', { type: 'content_block_delta', index: blockIndex, delta: { type: 'input_json_delta', partial_json: JSON.stringify(tb.input) } }));
      events.push(sse('content_block_stop', { type: 'content_block_stop', index: blockIndex }));
    } else if (block.type === 'thinking') {
      // Omit thinking blocks in simulated stream for brevity
    }
    blockIndex++;
  }

  const stopReason =
    response.finishReason === 'stop' ? 'end_turn'
    : response.finishReason === 'tool_use' ? 'tool_use'
    : response.finishReason || 'end_turn';

  events.push(sse('message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null },
    usage: { output_tokens: response.usage.outputTokens },
  }));
  events.push(sse('message_stop', { type: 'message_stop' }));

  return events.join('');
}
