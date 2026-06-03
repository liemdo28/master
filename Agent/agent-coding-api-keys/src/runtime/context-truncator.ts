/**
 * Antigravity Gateway — Context Truncator
 *
 * Estimates token count and truncates message history when a request exceeds
 * the target provider's context limit. Protects against prompt_too_large errors
 * BEFORE the request is sent upstream.
 *
 * Strategy — "keep head + tail, drop middle":
 *   1. Always keep the system prompt (counts toward budget).
 *   2. Always keep the first ANCHOR_MESSAGES messages (establishes conversation context).
 *   3. Always keep the last message (the current user turn).
 *   4. Fill remaining token budget with the most recent messages working backwards.
 *   5. CRITICAL: tool_call / tool_result pairs are ATOMIC — never keep one without
 *      the other. Orphan tool messages cause provider HTTP 400 errors.
 *   6. If the middle was dropped, inject a one-line summary placeholder so the
 *      model knows context was elided.
 *
 * Token estimation: characters / 3.5 (conservative approximation; real tiktoken
 * would be more accurate but adds 40 MB of wasm dependency).
 */

import type { UniversalChatRequest, UniversalMessage, ToolUseBlock, ToolResultBlock } from '../types.js';

// ── Per-provider context limits (tokens) ────────────────────────────────────
// Use ~90% of the real limit to leave headroom for output tokens.

const PROVIDER_TOKEN_LIMITS: Record<string, number> = {
  antigravity: 180_000,   // Anthropic Claude via NKQ proxy  (200k window)
  anthropic:   180_000,   // Anthropic direct                (200k window)
  opusmax:     900_000,   // OpusMax gpt-5.4                 (1,050,000 window — use 900k, matches auto-compact)
  openrouter:  115_000,   // OpenRouter (varies; 128k safe)
  openai:      115_000,   // OpenAI                          (128k window)
  gemini:      900_000,   // Gemini 2.0 Flash                (1M window)
  deepseek:     57_000,   // DeepSeek                        (64k window)
  ollama:        7_000,   // Ollama local (conservative)     (8k typical)
};

const DEFAULT_TOKEN_LIMIT = 90_000;

/** Number of leading messages to always preserve (establishes context anchor). */
const ANCHOR_MESSAGES = 2;

/** Rough token estimate: chars / 3.5 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function messageText(msg: UniversalMessage): string {
  if (typeof msg.content === 'string') return msg.content;
  return msg.content
    .map((b) => {
      if ('text' in b && typeof (b as { text: string }).text === 'string') {
        return (b as { text: string }).text;
      }
      return '';
    })
    .join('');
}

function messageCost(msg: UniversalMessage): number {
  return estimateTokens(messageText(msg));
}

// ── Tool-pair helpers ────────────────────────────────────────────────────────

function hasToolUse(msg: UniversalMessage): boolean {
  if (typeof msg.content === 'string') return false;
  return msg.content.some((b) => b.type === 'tool_use');
}

function hasToolResult(msg: UniversalMessage): boolean {
  if (typeof msg.content === 'string') return false;
  return msg.content.some((b) => b.type === 'tool_result');
}

/** Collect all tool_use IDs from a message. */
function toolUseIds(msg: UniversalMessage): Set<string> {
  if (typeof msg.content === 'string') return new Set();
  return new Set(
    msg.content
      .filter((b): b is ToolUseBlock => b.type === 'tool_use')
      .map((b) => b.id),
  );
}

/** Collect all tool_use_ids referenced by tool_result blocks in a message. */
function toolResultIds(msg: UniversalMessage): Set<string> {
  if (typeof msg.content === 'string') return new Set();
  return new Set(
    msg.content
      .filter((b): b is ToolResultBlock => b.type === 'tool_result')
      .map((b) => b.tool_use_id),
  );
}

/**
 * Returns true if `msg` contains tool_result blocks whose tool_use IDs are
 * NOT present in any of the `precedingMessages`. Such a message would cause
 * a "No tool output found" error on the provider side.
 */
function isOrphanToolResult(msg: UniversalMessage, precedingMessages: UniversalMessage[]): boolean {
  const needed = toolResultIds(msg);
  if (needed.size === 0) return false;

  const available = new Set<string>();
  for (const m of precedingMessages) {
    for (const id of toolUseIds(m)) available.add(id);
  }

  for (const id of needed) {
    if (!available.has(id)) return true; // at least one ID has no matching tool_call
  }
  return false;
}

export interface TruncationResult {
  request: UniversalChatRequest;
  /** true if any messages were dropped */
  truncated: boolean;
  /** estimated token count BEFORE truncation */
  originalTokens: number;
  /** estimated token count AFTER truncation */
  truncatedTokens: number;
  /** number of messages dropped */
  droppedCount: number;
}

/**
 * Returns a (possibly truncated) copy of the request.
 * If the estimated token count is within the provider's limit, returns the
 * original request unchanged (no copy overhead).
 */
export function truncateContext(
  request: UniversalChatRequest,
  providerId: string,
): TruncationResult {
  const limit = PROVIDER_TOKEN_LIMITS[providerId] ?? DEFAULT_TOKEN_LIMIT;

  // ── Estimate current total ───────────────────────────────────────────────
  const systemTokens = estimateTokens(request.system ?? '');
  const messageTokens = request.messages.map(messageCost);
  const totalTokens = systemTokens + messageTokens.reduce((a, b) => a + b, 0);

  if (totalTokens <= limit) {
    return {
      request,
      truncated: false,
      originalTokens: totalTokens,
      truncatedTokens: totalTokens,
      droppedCount: 0,
    };
  }

  // ── Budget available for messages ────────────────────────────────────────
  const msgBudget = limit - systemTokens - 200; // 200 token margin
  const msgs = request.messages;

  if (msgs.length <= ANCHOR_MESSAGES + 1) {
    // Nothing safe to drop — return as-is (will fail upstream with proper error)
    return {
      request,
      truncated: false,
      originalTokens: totalTokens,
      truncatedTokens: totalTokens,
      droppedCount: 0,
    };
  }

  // ── Build kept set ───────────────────────────────────────────────────────
  // Phase 1: reserve anchor messages + last message
  const head = msgs.slice(0, ANCHOR_MESSAGES);
  const tail: UniversalMessage[] = [msgs[msgs.length - 1]!];

  let usedTokens =
    head.reduce((s, m) => s + messageCost(m), 0) +
    messageCost(tail[0]!);

  // Phase 2: greedily add messages from the end (most recent context).
  // We add in PAIRS when a message contains tool_calls/tool_use so that
  // we never orphan a tool_call without its tool_result or vice versa.
  const middleStart = ANCHOR_MESSAGES;
  const middleEnd = msgs.length - 1; // exclusive of last
  const middle = msgs.slice(middleStart, middleEnd);

  // Pre-compute which middle indices are "paired" with adjacent messages.
  // A pair is: assistant message with tool_use blocks + the immediately
  // following user message with tool_result blocks for the same IDs.
  const pairedWith = new Map<number, number>(); // index → partner index
  for (let i = 0; i < middle.length - 1; i++) {
    const curr = middle[i]!;
    const next = middle[i + 1]!;
    if (hasToolUse(curr) && hasToolResult(next)) {
      pairedWith.set(i, i + 1);
      pairedWith.set(i + 1, i);
    }
  }

  const keptMiddleSet = new Set<number>();
  for (let i = middle.length - 1; i >= 0; i--) {
    if (keptMiddleSet.has(i)) continue; // already added as part of a pair

    const partner = pairedWith.get(i);

    if (partner !== undefined) {
      // This message is part of a tool pair — add both atomically
      const pairCost = messageCost(middle[i]!) + messageCost(middle[partner]!);
      if (usedTokens + pairCost > msgBudget) break;
      keptMiddleSet.add(i);
      keptMiddleSet.add(partner);
      usedTokens += pairCost;
    } else {
      const cost = messageCost(middle[i]!);
      if (usedTokens + cost > msgBudget) break;
      keptMiddleSet.add(i);
      usedTokens += cost;
    }
  }

  // Rebuild keptMiddle in original order
  const keptMiddle: UniversalMessage[] = [];
  for (let i = 0; i < middle.length; i++) {
    if (keptMiddleSet.has(i)) keptMiddle.push(middle[i]!);
  }

  // ── Sanity-check: remove orphan tool_result at the START of keptMiddle ───
  // If the first kept message is a tool_result whose tool_call was dropped,
  // remove it (and any immediately following orphans) to prevent provider errors.
  while (keptMiddle.length > 0 && isOrphanToolResult(keptMiddle[0]!, head)) {
    keptMiddle.shift();
  }

  const droppedCount = middle.length - keptMiddle.length;

  // ── Inject elision marker if anything was dropped ────────────────────────
  const elisionMarker: UniversalMessage | null =
    droppedCount > 0
      ? {
          role: 'user',
          content: `[${droppedCount} earlier messages were omitted by the gateway to fit within the context window. The conversation continues below.]`,
        }
      : null;

  const newMessages: UniversalMessage[] = [
    ...head,
    ...(elisionMarker ? [elisionMarker] : []),
    ...keptMiddle,
    ...tail,
  ];

  const truncatedTokens =
    systemTokens + newMessages.reduce((s, m) => s + messageCost(m), 0);

  return {
    request: { ...request, messages: newMessages },
    truncated: true,
    originalTokens: totalTokens,
    truncatedTokens,
    droppedCount,
  };
}

/** Returns estimated token count for a request (no modification). */
export function estimateRequestTokens(request: UniversalChatRequest): number {
  const systemTokens = estimateTokens(request.system ?? '');
  const msgTokens = request.messages.reduce((s, m) => s + messageCost(m), 0);
  return systemTokens + msgTokens;
}
