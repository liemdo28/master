/**
 * Antigravity Gateway — Fallback Chain Execution
 *
 * Provides structured fallback behavior:
 *  - Provider fallback: primary → secondary → tertiary
 *  - Model fallback: opus → sonnet → haiku
 *  - Protocol fallback: native → translated → degraded
 *  - Retry policies: exponential backoff, jitter
 *  - Degraded-mode handling: reduced features when all primaries fail
 *
 * Example:
 *   OpusMax fail → Anthropic fallback → OpenRouter fallback
 *   without IDE awareness.
 */

import type { BaseProvider } from '../providers/base-provider.js';
import type { UniversalChatRequest, UniversalChatResponse, RouteAttempt } from '../types.js';
import { sandboxChat, sandboxStream, type SandboxError } from '../sandbox/provider-sandbox.js';

export interface FallbackChainConfig {
    /** Maximum number of providers to try before giving up. */
    maxAttempts: number;
    /** Base timeout for each provider attempt (ms). */
    timeoutMs: number;
    /** Whether to retry on recoverable errors within the same provider. */
    retryRecoverable: boolean;
    /** Maximum retries per provider. */
    maxRetriesPerProvider: number;
    /** Delay between retries (ms), multiplied by attempt number. */
    retryDelayMs: number;
    /** Model fallback chain: try these models in order if the requested model fails. */
    modelFallbacks: Record<string, string[]>;
    /** Whether to allow degraded mode (reduced features) as last resort. */
    allowDegradedMode: boolean;
}

export interface FallbackResult<T> {
    success: boolean;
    value?: T;
    attempts: FallbackAttempt[];
    degraded: boolean;
    finalProvider?: string;
    finalModel?: string;
    totalDurationMs: number;
}

export interface FallbackAttempt {
    providerId: string;
    model: string;
    durationMs: number;
    status: 'ok' | 'error' | 'timeout' | 'skipped';
    error?: string | undefined;
    errorType?: SandboxError['type'] | undefined;
    recoverable?: boolean | undefined;
}

const DEFAULT_CONFIG: FallbackChainConfig = {
    maxAttempts: 5,
    timeoutMs: 120_000,
    retryRecoverable: true,
    maxRetriesPerProvider: 1,
    retryDelayMs: 1000,
    modelFallbacks: {
        'claude-opus-4-7': ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022'],
        'claude-sonnet-4-20250514': ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'],
        'gpt-4o': ['gpt-4o-mini', 'gpt-3.5-turbo'],
    },
    allowDegradedMode: true,
};

/**
 * Execute a chat request through the fallback chain.
 * Tries providers in order, with model fallback and retry logic.
 */
export async function executeFallbackChain(
    providers: BaseProvider[],
    request: UniversalChatRequest,
    resolveModel: (model: string, provider: BaseProvider) => string,
    config: Partial<FallbackChainConfig> = {},
): Promise<FallbackResult<UniversalChatResponse>> {
    const opts = { ...DEFAULT_CONFIG, ...config };
    const start = Date.now();
    const attempts: FallbackAttempt[] = [];
    let attemptCount = 0;

    // Try each provider
    for (const provider of providers) {
        if (attemptCount >= opts.maxAttempts) break;
        if (!provider.config.enabled) continue;

        const model = resolveModel(request.model, provider);
        attemptCount++;

        const result = await sandboxChat(provider, { ...request, model }, {
            timeoutMs: opts.timeoutMs,
            maxRetries: opts.retryRecoverable ? opts.maxRetriesPerProvider : 0,
            retryDelayMs: opts.retryDelayMs,
        });

        if (result.ok && result.value) {
            attempts.push({
                providerId: provider.id,
                model,
                durationMs: result.durationMs,
                status: 'ok',
            });
            return {
                success: true,
                value: result.value,
                attempts,
                degraded: false,
                finalProvider: provider.id,
                finalModel: model,
                totalDurationMs: Date.now() - start,
            };
        }

        attempts.push({
            providerId: provider.id,
            model,
            durationMs: result.durationMs,
            status: result.error?.type === 'timeout' ? 'timeout' : 'error',
            error: result.error?.message,
            errorType: result.error?.type,
            recoverable: result.error?.recoverable,
        });
    }

    // Model fallback: try alternative models on the same providers
    const modelFallbacks = opts.modelFallbacks[request.model] ?? [];
    for (const fallbackModel of modelFallbacks) {
        if (attemptCount >= opts.maxAttempts) break;

        for (const provider of providers) {
            if (attemptCount >= opts.maxAttempts) break;
            if (!provider.config.enabled) continue;

            const model = resolveModel(fallbackModel, provider);
            attemptCount++;

            const result = await sandboxChat(provider, { ...request, model }, {
                timeoutMs: opts.timeoutMs,
                maxRetries: 0, // No retries on fallback models
                retryDelayMs: opts.retryDelayMs,
            });

            if (result.ok && result.value) {
                attempts.push({
                    providerId: provider.id,
                    model,
                    durationMs: result.durationMs,
                    status: 'ok',
                });
                return {
                    success: true,
                    value: result.value,
                    attempts,
                    degraded: true, // Using fallback model = degraded
                    finalProvider: provider.id,
                    finalModel: model,
                    totalDurationMs: Date.now() - start,
                };
            }

            attempts.push({
                providerId: provider.id,
                model,
                durationMs: result.durationMs,
                status: result.error?.type === 'timeout' ? 'timeout' : 'error',
                error: result.error?.message,
                errorType: result.error?.type,
                recoverable: result.error?.recoverable,
            });
        }
    }

    // All attempts failed
    return {
        success: false,
        attempts,
        degraded: false,
        totalDurationMs: Date.now() - start,
    };
}

/**
 * Execute a streaming request through the fallback chain.
 * Returns the first successful upstream Response.
 */
export async function executeFallbackStreamChain(
    providers: BaseProvider[],
    request: UniversalChatRequest,
    resolveModel: (model: string, provider: BaseProvider) => string,
    config: Partial<FallbackChainConfig> = {},
): Promise<FallbackResult<{ upstream: Response; provider: BaseProvider; model: string }>> {
    const opts = { ...DEFAULT_CONFIG, ...config };
    const start = Date.now();
    const attempts: FallbackAttempt[] = [];
    let attemptCount = 0;

    for (const provider of providers) {
        if (attemptCount >= opts.maxAttempts) break;
        if (!provider.config.enabled) continue;

        const model = resolveModel(request.model, provider);
        attemptCount++;

        const result = await sandboxStream(provider, { ...request, model }, {
            timeoutMs: opts.timeoutMs,
        });

        if (result.ok && result.value) {
            attempts.push({
                providerId: provider.id,
                model,
                durationMs: result.durationMs,
                status: 'ok',
            });
            return {
                success: true,
                value: { upstream: result.value, provider, model },
                attempts,
                degraded: false,
                finalProvider: provider.id,
                finalModel: model,
                totalDurationMs: Date.now() - start,
            };
        }

        attempts.push({
            providerId: provider.id,
            model,
            durationMs: result.durationMs,
            status: result.error?.type === 'timeout' ? 'timeout' : 'error',
            error: result.error?.message,
            errorType: result.error?.type,
            recoverable: result.error?.recoverable,
        });
    }

    return {
        success: false,
        attempts,
        degraded: false,
        totalDurationMs: Date.now() - start,
    };
}

/**
 * Convert fallback attempts to the gateway's RouteAttempt format.
 */
export function toRouteAttempts(attempts: FallbackAttempt[]): RouteAttempt[] {
    return attempts.map((a) => ({
        providerId: a.providerId,
        model: a.model,
        latencyMs: a.durationMs,
        ok: a.status === 'ok',
        error: a.error,
    }));
}
