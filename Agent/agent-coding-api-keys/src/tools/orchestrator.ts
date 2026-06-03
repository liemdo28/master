/**
 * Antigravity Gateway — Tool Orchestration Layer
 *
 * Responsibilities:
 *  1. Schema validation — verify tool definitions before sending upstream
 *  2. Protocol bridging — re-export the tool-bridge conversions
 *  3. Compatibility warnings — surface issues the IDE/client should know about
 *  4. Tool call tracking — count tool invocations per request for logging
 *
 * The actual OpenAI↔Anthropic conversion logic lives in src/compatibility/tool-bridge.ts.
 * This layer adds validation and observability on top.
 */

export {
  openAIToolsToAnthropic,
  openAIToolChoiceToAnthropic,
  openAIMessagesToUniversal,
  anthropicToolsToOpenAI,
  anthropicToolChoiceToOpenAI,
  universalMessagesToOpenAI,
  extractToolUseBlocks,
  toolUseToOpenAIToolCalls,
} from '../compatibility/tool-bridge.js';

import type { AnthropicTool, ContentBlock, ToolUseBlock } from '../types.js';
import { registry } from '../registry/model-registry.js';

// ── Schema validation ──────────────────────────────────────────────────────

export interface ToolValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

/** Validate Anthropic-format tool definitions before sending to provider. */
export function validateTools(tools: AnthropicTool[]): ToolValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  for (const tool of tools) {
    if (!tool.name) {
      errors.push('Tool missing required "name" field.');
    } else if (!/^[a-zA-Z0-9_-]{1,64}$/.test(tool.name)) {
      warnings.push(`Tool name "${tool.name}" contains characters that some providers may reject.`);
    }

    if (!tool.input_schema) {
      errors.push(`Tool "${tool.name ?? 'unknown'}" missing "input_schema".`);
    } else if ((tool.input_schema as Record<string, unknown>).type !== 'object') {
      warnings.push(`Tool "${tool.name}" input_schema.type is not "object" — may fail on strict providers.`);
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}

/** Validate that a model supports tool calling before routing. */
export function checkModelToolSupport(modelId: string, toolCount: number): string[] {
  if (toolCount === 0) return [];
  const warnings: string[] = [];
  const warn = registry.toolCompatibilityWarning(modelId);
  if (warn) warnings.push(warn);
  return warnings;
}

// ── Tool call tracking ─────────────────────────────────────────────────────

/** Count tool_use blocks in a content array. */
export function countToolCalls(content: ContentBlock[]): number {
  return content.filter((b): b is ToolUseBlock => b.type === 'tool_use').length;
}

/** Extract tool names from content for logging. */
export function toolNames(content: ContentBlock[]): string[] {
  return content
    .filter((b): b is ToolUseBlock => b.type === 'tool_use')
    .map((b) => b.name);
}
