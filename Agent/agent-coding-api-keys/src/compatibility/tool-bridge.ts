/**
 * Bidirectional protocol bridge for tool calling.
 *
 * Anthropic tools use `input_schema`; OpenAI tools use `parameters`.
 * Anthropic tool results live in a user-turn ContentBlock array;
 * OpenAI tool results are standalone messages with role="tool".
 *
 * This module converts in both directions so providers can speak their
 * native protocol while the Universal layer always uses Anthropic format.
 */

import type {
  AnthropicTool,
  AnthropicToolChoice,
  ChatMessage,
  ContentBlock,
  OpenAIToolCall,
  TextBlock,
  ToolResultBlock,
  ToolUseBlock,
  UniversalMessage,
} from '../types.js';

// ─── OpenAI → Anthropic ────────────────────────────────────────────────────

export function openAIToolsToAnthropic(tools: unknown[]): AnthropicTool[] {
  return tools.map((t) => {
    const tool = t as Record<string, unknown>;
    // Already Anthropic format
    if (tool.input_schema) {
      const base: AnthropicTool = {
        name: String(tool.name ?? ''),
        input_schema: tool.input_schema as Record<string, unknown>,
      };
      if (typeof tool.description === 'string') base.description = tool.description;
      return base;
    }
    // OpenAI function format
    if (tool.type === 'function') {
      const fn = (tool.function ?? {}) as Record<string, unknown>;
      const base: AnthropicTool = {
        name: String(fn.name ?? ''),
        input_schema: (fn.parameters as Record<string, unknown>) ?? { type: 'object', properties: {} },
      };
      if (typeof fn.description === 'string') base.description = fn.description;
      return base;
    }
    return { name: String(tool.name ?? 'unknown'), input_schema: { type: 'object', properties: {} } };
  });
}

export function openAIToolChoiceToAnthropic(choice: unknown): AnthropicToolChoice | undefined {
  if (choice === undefined || choice === null) return undefined;
  if (choice === 'none') return { type: 'none' };
  if (choice === 'auto') return { type: 'auto' };
  if (choice === 'required') return { type: 'any' };
  const obj = choice as Record<string, unknown>;
  if (obj.type === 'function') {
    const fn = (obj.function ?? {}) as Record<string, unknown>;
    return { type: 'tool', name: String(fn.name ?? '') };
  }
  return { type: 'auto' };
}

/**
 * Convert OpenAI-format messages (including role="tool" and assistant tool_calls)
 * to Universal/Anthropic-native format. Also extracts system messages.
 */
export function openAIMessagesToUniversal(messages: ChatMessage[]): {
  system: string | undefined;
  messages: UniversalMessage[];
} {
  const systemParts: string[] = [];
  const universal: UniversalMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system' || msg.role === 'developer') {
      if (typeof msg.content === 'string') systemParts.push(msg.content);
      continue;
    }

    if (msg.role === 'user') {
      universal.push({ role: 'user', content: normalizeInboundContent(msg.content) });
      continue;
    }

    if (msg.role === 'assistant') {
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        // Convert OpenAI tool_calls → Anthropic tool_use content blocks
        const blocks: ContentBlock[] = [];
        if (typeof msg.content === 'string' && msg.content.trim()) {
          blocks.push({ type: 'text', text: msg.content });
        }
        for (const call of msg.tool_calls) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>;
          } catch { /* malformed args — use empty object */ }
          blocks.push({ type: 'tool_use', id: call.id, name: call.function.name, input });
        }
        universal.push({ role: 'assistant', content: blocks });
      } else {
        universal.push({ role: 'assistant', content: normalizeInboundContent(msg.content) });
      }
      continue;
    }

    if (msg.role === 'tool') {
      // OpenAI tool result → Anthropic tool_result block inside a user turn
      const block: ToolResultBlock = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id ?? '',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      };
      // Merge consecutive tool results into the same user turn
      const prev = universal[universal.length - 1];
      if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
        (prev.content as ContentBlock[]).push(block);
      } else {
        universal.push({ role: 'user', content: [block] });
      }
      continue;
    }
  }

  return {
    system: systemParts.length ? systemParts.join('\n\n') : undefined,
    messages: universal,
  };
}

function normalizeInboundContent(content: ChatMessage['content']): string | ContentBlock[] {
  if (content === null || content === undefined) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content as ContentBlock[];
  return String(content);
}

// ─── Anthropic → OpenAI ────────────────────────────────────────────────────

export function anthropicToolsToOpenAI(tools: AnthropicTool[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      ...(t.description ? { description: t.description } : {}),
      parameters: t.input_schema,
    },
  }));
}

export function anthropicToolChoiceToOpenAI(choice: AnthropicToolChoice | undefined): unknown {
  if (!choice) return undefined;
  if (choice.type === 'auto') return 'auto';
  if (choice.type === 'none') return 'none';
  if (choice.type === 'any') return 'required';
  if (choice.type === 'tool') return { type: 'function', function: { name: choice.name } };
  return 'auto';
}

/**
 * Convert Universal/Anthropic-native messages back to OpenAI format.
 * Used by OpenAI-compatible providers when sending upstream.
 */
export function universalMessagesToOpenAI(messages: UniversalMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    const blocks = msg.content as ContentBlock[];

    if (msg.role === 'assistant') {
      const textParts = blocks
        .filter((b): b is TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const toolUses = blocks.filter((b): b is ToolUseBlock => b.type === 'tool_use');

      const assistantMsg: ChatMessage = { role: 'assistant', content: textParts || null };
      if (toolUses.length > 0) {
        assistantMsg.tool_calls = toolUses.map((t) => ({
          id: t.id,
          type: 'function' as const,
          function: { name: t.name, arguments: JSON.stringify(t.input) },
        }));
      }
      result.push(assistantMsg);
      continue;
    }

    if (msg.role === 'user') {
      const toolResults = blocks.filter((b): b is ToolResultBlock => b.type === 'tool_result');
      const others = blocks.filter((b) => b.type !== 'tool_result');

      for (const tr of toolResults) {
        result.push({
          role: 'tool',
          tool_call_id: tr.tool_use_id,
          content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
        });
      }
      if (others.length > 0) {
        const text = others
          .filter((b): b is TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('');
        result.push({ role: 'user', content: text || null });
      }
    }
  }

  return result;
}

// ─── Utility ───────────────────────────────────────────────────────────────

export function extractToolUseBlocks(content: ContentBlock[]): ToolUseBlock[] {
  return content.filter((b): b is ToolUseBlock => b.type === 'tool_use');
}

export function toolUseToOpenAIToolCalls(blocks: ToolUseBlock[]): OpenAIToolCall[] {
  return blocks.map((t) => ({
    id: t.id,
    type: 'function' as const,
    function: { name: t.name, arguments: JSON.stringify(t.input) },
  }));
}
