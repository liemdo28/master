/**
 * Antigravity Gateway — Protocol-Native Routing
 *
 * DO NOT normalize everything into OpenAI internally.
 *
 * This module provides protocol-native flow paths:
 *  - Anthropic-native: client speaks Anthropic → provider speaks Anthropic → pass-through
 *  - OpenAI-native: client speaks OpenAI → provider speaks OpenAI → pass-through
 *  - Cross-protocol: only translate when the client and provider speak different protocols
 *
 * Benefits:
 *  - Zero-loss fidelity for native protocol pairs
 *  - No information lost in double-translation
 *  - Thinking blocks, tool_use, signatures preserved exactly
 *  - Streaming events pass through without re-serialization
 */

import type { ProviderKind } from '../types.js';

export type ClientProtocol = 'anthropic' | 'openai';
export type ProviderProtocol = 'anthropic' | 'openai-compatible' | 'ollama' | 'gemini-compatible';

export interface NativeRouteDecision {
    /** Whether the request can be passed through without translation. */
    isNative: boolean;
    /** The translation direction needed, if any. */
    translation: 'none' | 'anthropic-to-openai' | 'openai-to-anthropic';
    /** Whether streaming can be passed through directly. */
    streamPassthrough: boolean;
    /** Whether tool_use blocks need format conversion. */
    toolConversion: boolean;
    /** Whether thinking/reasoning blocks are preserved. */
    thinkingPreserved: boolean;
}

/**
 * Determine the optimal routing strategy based on client and provider protocols.
 * Prefers native pass-through when possible to avoid information loss.
 */
export function determineNativeRoute(
    clientProtocol: ClientProtocol,
    providerKind: ProviderKind,
): NativeRouteDecision {
    // Anthropic client → Anthropic provider: FULL NATIVE PASS-THROUGH
    if (clientProtocol === 'anthropic' && providerKind === 'anthropic') {
        return {
            isNative: true,
            translation: 'none',
            streamPassthrough: true,
            toolConversion: false,
            thinkingPreserved: true,
        };
    }

    // OpenAI client → OpenAI-compatible provider: FULL NATIVE PASS-THROUGH
    if (clientProtocol === 'openai' && (providerKind === 'openai-compatible' || providerKind === 'ollama' || providerKind === 'gemini-compatible')) {
        return {
            isNative: true,
            translation: 'none',
            streamPassthrough: true,
            toolConversion: false,
            thinkingPreserved: false, // OpenAI format doesn't have thinking blocks
        };
    }

    // OpenAI client → Anthropic provider: CROSS-PROTOCOL
    if (clientProtocol === 'openai' && providerKind === 'anthropic') {
        return {
            isNative: false,
            translation: 'openai-to-anthropic',
            streamPassthrough: false, // Need Anthropic→OpenAI stream transform
            toolConversion: true,    // OpenAI function format → Anthropic tool_use
            thinkingPreserved: false, // Thinking blocks swallowed in OpenAI format
        };
    }

    // Anthropic client → OpenAI-compatible provider: CROSS-PROTOCOL
    if (clientProtocol === 'anthropic' && (providerKind === 'openai-compatible' || providerKind === 'ollama' || providerKind === 'gemini-compatible')) {
        return {
            isNative: false,
            translation: 'anthropic-to-openai',
            streamPassthrough: false, // Need OpenAI→Anthropic stream transform
            toolConversion: true,    // Anthropic tool_use → OpenAI function format
            thinkingPreserved: false, // Provider doesn't support thinking
        };
    }

    // Fallback: assume cross-protocol
    return {
        isNative: false,
        translation: 'anthropic-to-openai',
        streamPassthrough: false,
        toolConversion: true,
        thinkingPreserved: false,
    };
}

/**
 * Check if a request can skip the Universal format entirely.
 * This is the fast path for native protocol pairs.
 */
export function canSkipUniversalFormat(
    clientProtocol: ClientProtocol,
    providerKind: ProviderKind,
): boolean {
    const decision = determineNativeRoute(clientProtocol, providerKind);
    return decision.isNative;
}

/**
 * Get the list of features that will be lost in cross-protocol translation.
 * Useful for logging warnings when features are degraded.
 */
export function getTranslationLosses(
    clientProtocol: ClientProtocol,
    providerKind: ProviderKind,
): string[] {
    const decision = determineNativeRoute(clientProtocol, providerKind);
    const losses: string[] = [];

    if (!decision.thinkingPreserved) {
        losses.push('thinking/reasoning blocks not preserved');
    }
    if (decision.toolConversion) {
        losses.push('tool format conversion applied (potential schema differences)');
    }
    if (!decision.streamPassthrough) {
        losses.push('streaming events re-serialized (potential timing differences)');
    }

    return losses;
}

/**
 * Protocol capability matrix — what each protocol natively supports.
 */
export const PROTOCOL_CAPABILITIES = {
    anthropic: {
        toolUse: true,
        toolResult: true,
        thinking: true,
        systemPrompt: true,
        streaming: true,
        contentBlocks: true,
        stopReason: true,
        cacheControl: true,
        vision: true,
        maxTokensRequired: true,
    },
    openai: {
        toolUse: true,       // via function calling
        toolResult: true,    // via role: 'tool'
        thinking: false,     // no native thinking support
        systemPrompt: true,  // via role: 'system'
        streaming: true,
        contentBlocks: false, // single content string
        stopReason: true,    // finish_reason
        cacheControl: false,
        vision: true,
        maxTokensRequired: false,
    },
} as const;
