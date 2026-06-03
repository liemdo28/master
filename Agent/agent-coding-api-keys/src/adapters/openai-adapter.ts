import type { ChatCompletionRequest, ContentBlock, TextBlock, ToolUseBlock, UniversalChatRequest, UniversalChatResponse } from '../types.js';
import { openAIMessagesToUniversal, openAIToolChoiceToAnthropic, openAIToolsToAnthropic } from '../compatibility/tool-bridge.js';

/** Convert an incoming OpenAI-format request to Universal (Anthropic-native) format. */
export function openAIToUniversal(body: ChatCompletionRequest): UniversalChatRequest {
  const { system, messages } = openAIMessagesToUniversal(body.messages ?? []);

  return {
    model: body.model ?? 'default',
    messages,
    system,
    temperature: body.temperature,
    maxTokens: body.max_tokens ?? body.max_completion_tokens ?? 4096,
    stream: body.stream === true,
    tools: Array.isArray(body.tools) && body.tools.length > 0
      ? openAIToolsToAnthropic(body.tools)
      : undefined,
    toolChoice: openAIToolChoiceToAnthropic(body.tool_choice),
    metadata: body.metadata,
  };
}

/** Convert a Universal response to an OpenAI-format response object. */
export function universalToOpenAI(response: UniversalChatResponse): Record<string, unknown> {
  const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  const textBlocks = response.content.filter((b): b is TextBlock => b.type === 'text');
  const text = textBlocks.map((b) => b.text).join('') || response.text;
  const hasTools = toolUseBlocks.length > 0;

  const message: Record<string, unknown> = {
    role: 'assistant',
    content: hasTools ? (text.trim() || null) : text,
  };

  if (hasTools) {
    message.tool_calls = toolUseBlocks.map((t, i) => ({
      id: t.id,
      type: 'function',
      function: { name: t.name, arguments: JSON.stringify(t.input) },
    }));
  }

  // Map Universal finish_reason (Anthropic-style) → OpenAI finish_reason
  const finishReason = response.finishReason === 'tool_use' ? 'tool_calls'
    : response.finishReason === 'stop' ? 'stop'
    : response.finishReason || 'stop';

  return {
    id: response.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: response.model,
    choices: [{
      index: 0,
      message,
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: response.usage.inputTokens,
      completion_tokens: response.usage.outputTokens,
      total_tokens: response.usage.inputTokens + response.usage.outputTokens,
    },
    provider: response.providerId,
  };
}

/**
 * Build a fake-streaming OpenAI SSE response from a complete Universal response.
 * Used as fallback when real streaming is unavailable.
 */
export function openAIStreamChunk(response: UniversalChatResponse): string {
  const id = response.id;
  const created = Math.floor(Date.now() / 1000);
  const base = { id, object: 'chat.completion.chunk', created, model: response.model, provider: response.providerId };

  const toolUseBlocks = response.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
  const textBlocks = response.content.filter((b): b is TextBlock => b.type === 'text');
  const text = textBlocks.map((b) => b.text).join('') || response.text;
  const hasTools = toolUseBlocks.length > 0;
  const finishReason = response.finishReason === 'tool_use' ? 'tool_calls'
    : response.finishReason || 'stop';

  const chunks: unknown[] = [];

  // Role delta
  chunks.push({ ...base, choices: [{ index: 0, delta: { role: 'assistant', content: null }, finish_reason: null }] });

  if (hasTools) {
    if (text.trim()) {
      chunks.push({ ...base, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
    }
    // Emit all tool calls in one chunk
    chunks.push({
      ...base,
      choices: [{
        index: 0,
        delta: {
          tool_calls: toolUseBlocks.map((t, i) => ({
            index: i,
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: JSON.stringify(t.input) },
          })),
        },
        finish_reason: null,
      }],
    });
  } else if (text) {
    chunks.push({ ...base, choices: [{ index: 0, delta: { content: text }, finish_reason: null }] });
  }

  // Finish chunk
  chunks.push({ ...base, choices: [{ index: 0, delta: {}, finish_reason: finishReason }] });

  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
}
