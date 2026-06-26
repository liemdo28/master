/**
 * Antigravity Gateway — Provider Isolation Sandbox
 *
 * Ensures one provider failure NEVER:
 *  - crashes the stream engine
 *  - corrupts reasoning state
 *  - breaks orchestration
 *
 * Each provider call runs in an isolated execution context with:
 *  - timeout enforcement
 *  - error boundary
 *  - state isolation (no shared mutable state between providers)
 *  - resource cleanup on failure
 */

import type { UniversalChatRequest, UniversalChatResponse } from '../types.js';
import type { BaseProvider } from '../providers/base-provider.js';

export interface SandboxResult<T> {
    ok: boolean;
    value?: T;
    error?: SandboxError;
    durationMs: number;
    providerId: string;
}

export interface SandboxError {
    type: 'timeout' | 'network' | 'protocol' | 'provider' | 'unknown';
    message: string;
    recoverable: boolean;
    retryAfterMs?: number;
}

export interface SandboxOptions {
    timeoutMs?: number;
    maxRetries?: number;
    retryDelayMs?: number;
    onError?: (error: SandboxError, providerId: string) => void;
}

const DEFAULT_OPTIONS: Required<SandboxOptions> = {
    timeoutMs: 120_000,
    maxRetries: 0,
    retryDelayMs: 1000,
    onError: () => { },
};

/**
 * Execute a provider chat call inside an isolation boundary.
 * Catches all errors, classifies them, and returns a structured result.
 */
export async function sandboxChat(
    provider: BaseProvider,
    request: UniversalChatRequest,
    options?: SandboxOptions,
): Promise<SandboxResult<UniversalChatResponse>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const start = Date.now();

    try {
        const response = await Promise.race([
            provider.chat(request),
            timeoutPromise<UniversalChatResponse>(opts.timeoutMs, provider.id),
        ]);

        return {
            ok: true,
            value: response,
            durationMs: Date.now() - start,
            providerId: provider.id,
        };
    } catch (err) {
        const sandboxError = classifyError(err);
        opts.onError(sandboxError, provider.id);

        return {
            ok: false,
            error: sandboxError,
            durationMs: Date.now() - start,
            providerId: provider.id,
        };
    }
}

/**
 * Execute a provider stream fetch inside an isolation boundary.
 * Returns the raw Response for streaming, or a classified error.
 */
export async function sandboxStream(
    provider: BaseProvider,
    request: UniversalChatRequest,
    options?: SandboxOptions,
): Promise<SandboxResult<Response>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const start = Date.now();

    try {
        const upstream = await Promise.race([
            provider.fetchStream(request),
            timeoutPromise<Response>(opts.timeoutMs, provider.id),
        ]);

        if (!upstream.ok) {
            const body = await upstream.text().catch(() => '');
            throw new Error(`HTTP ${upstream.status}: ${body.slice(0, 300)}`);
        }

        return {
            ok: true,
            value: upstream,
            durationMs: Date.now() - start,
            providerId: provider.id,
        };
    } catch (err) {
        const sandboxError = classifyError(err);
        opts.onError(sandboxError, provider.id);

        return {
            ok: false,
            error: sandboxError,
            durationMs: Date.now() - start,
            providerId: provider.id,
        };
    }
}

/**
 * Execute with automatic retry inside sandbox.
 * Only retries on recoverable errors.
 */
export async function sandboxWithRetry<T>(
    fn: () => Promise<T>,
    providerId: string,
    options?: SandboxOptions,
): Promise<SandboxResult<T>> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError: SandboxError | undefined;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        const start = Date.now();
        try {
            const value = await Promise.race([
                fn(),
                timeoutPromise<T>(opts.timeoutMs, providerId),
            ]);
            return { ok: true, value, durationMs: Date.now() - start, providerId };
        } catch (err) {
            lastError = classifyError(err);
            opts.onError(lastError, providerId);

            if (!lastError.recoverable || attempt >= opts.maxRetries) {
                return { ok: false, error: lastError, durationMs: Date.now() - start, providerId };
            }

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs * (attempt + 1)));
        }
    }

    return { ok: false, error: lastError ?? { type: 'unknown', message: 'No attempts made', recoverable: false }, durationMs: 0, providerId };
}

// ── Internal helpers ────────────────────────────────────────────────────────

function timeoutPromise<T>(ms: number, providerId: string): Promise<T> {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new TimeoutError(providerId, ms)), ms),
    );
}

class TimeoutError extends Error {
    constructor(providerId: string, ms: number) {
        super(`Provider ${providerId} timed out after ${ms}ms`);
        this.name = 'TimeoutError';
    }
}

function classifyError(err: unknown): SandboxError {
    if (err instanceof TimeoutError) {
        return { type: 'timeout', message: err.message, recoverable: true, retryAfterMs: 5000 };
    }

    const message = err instanceof Error ? err.message : String(err);

    // Network errors
    if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND') || message.includes('fetch failed')) {
        return { type: 'network', message, recoverable: true, retryAfterMs: 2000 };
    }

    // Rate limiting
    if (message.includes('429') || message.includes('rate limit')) {
        return { type: 'provider', message, recoverable: true, retryAfterMs: 10_000 };
    }

    // Auth errors (not recoverable without config change)
    if (message.includes('401') || message.includes('403') || message.includes('invalid_api_key')) {
        return { type: 'provider', message, recoverable: false };
    }

    // Server errors (potentially recoverable)
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
        return { type: 'provider', message, recoverable: true, retryAfterMs: 3000 };
    }

    // Protocol errors
    if (message.includes('JSON') || message.includes('parse') || message.includes('unexpected')) {
        return { type: 'protocol', message, recoverable: false };
    }

    return { type: 'unknown', message, recoverable: false };
}
