/**
 * Antigravity Gateway — Provider Priority Engine
 *
 * Quota-aware, circuit-breaker-aware provider scoring.
 *
 * Priority table (lower score = higher priority):
 *   1  OpusMax          — primary, quota-based
 *   2  Antigravity NKQ  — fallback, 2 keys rotating every 5 min
 *   3  Anthropic        — direct pay-as-you-go
 *   4  OpenRouter       — aggregator
 *   5  OpenAI           — direct OpenAI
 *   6  Gemini           — Google
 *   7  DeepSeek         — coding specialist
 *   8  Ollama           — local fallback
 *
 * Scoring rules (additive penalties):
 *   - Base priority score: from PROVIDER_BASE_PRIORITY table
 *   - Quota low (< 20% remaining): +5 (still usable, slightly deprioritised)
 *   - Quota exhausted: → marked unavailable (skipped entirely)
 *   - Circuit breaker OPEN/HALF_OPEN with max probes: → unavailable
 *   - Circuit breaker HALF_OPEN with probe slots: allowed (recovery probe)
 *
 * Providers without a quota entry are treated as unlimited (no penalty).
 * Providers without a circuit breaker entry are treated as CLOSED.
 *
 * The IDE never sees this logic — it only talks to the gateway endpoint.
 */

import { circuitBreakers } from '../runtime/circuit-breaker.js';
import { quotaManager } from '../runtime/quota-manager.js';

// ── Authoritative default provider ──────────────────────────────────────────

/**
 * The DEFAULT provider that ALL requests MUST start at.
 * NO exceptions. The QuotaOrchestrator enforces rotation AFTER this provider's
 * quota limit is reached.
 */
export const DEFAULT_PROVIDER = 'opusmax' as const;

/**
 * Canonical provider ID mapping.
 * The runtime uses 'opusmax' internally; this alias exists for
 * operator-facing clarity.
 */
export const DEFAULT_PROVIDER_ID = 'opusmax';

// ── Base priority table ─────────────────────────────────────────────────────

/**
 * Static base priorities.
 * Any provider not listed gets priority 90 (last resort).
 *
 * MANDATORY PRIORITY ORDER:
 *   1. opusmax       (priority: 1, preferred: true)
 *   2. antigravity   (priority: 20, NKQ fallback)
 *   3. anthropic
 *   4. openrouter
 *   5. openai / local
 */
export const PROVIDER_BASE_PRIORITY: Record<string, number> = {
    opusmax: 1,      // PRIMARY — quota-based, first priority
    antigravity: 20,  // FALLBACK — NKQ provider, 2 keys rotating every 5 min
    anthropic: 30,
    openrouter: 40,
    openai: 50,
    gemini: 60,
    deepseek: 70,
    ollama: 80,
};

/**
 * Provider preference flags.
 * preferred: true means the orchestrator MUST select this provider first
 * when it has available quota.
 */
export const PROVIDER_PREFERENCES: Record<string, { preferred: boolean; priority: number }> = {
    opusmax: { preferred: true, priority: 1 },
    antigravity: { preferred: false, priority: 2 },
    anthropic: { preferred: false, priority: 3 },
    openrouter: { preferred: false, priority: 4 },
    ollama: { preferred: false, priority: 5 },
};

/** Score penalty when a provider's quota is running low (< lowWaterMarkPct%). */
const QUOTA_LOW_PENALTY = 5;

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface ProviderScore {
    providerId: string;
    /** Effective priority score (lower = preferred). Infinity = unavailable. */
    score: number;
    /** Whether this provider can accept requests right now. */
    available: boolean;
    /** Human-readable reason why the provider is unavailable, if applicable. */
    reason?: string;
}

/**
 * Compute the effective priority score for a single provider.
 * Checks circuit breaker state and quota status.
 */
export function scoreProvider(providerId: string): ProviderScore {
    const basePriority = PROVIDER_BASE_PRIORITY[providerId] ?? 90;

    // ── Circuit breaker check ─────────────────────────────────────────
    if (!circuitBreakers.canExecute(providerId)) {
        return { providerId, score: Infinity, available: false, reason: 'circuit_open' };
    }

    // ── Quota check ───────────────────────────────────────────────────
    if (quotaManager.isExhausted(providerId)) {
        return { providerId, score: Infinity, available: false, reason: 'quota_exhausted' };
    }

    // ── Soft penalties ────────────────────────────────────────────────
    const lowPenalty = quotaManager.isLow(providerId) ? QUOTA_LOW_PENALTY : 0;

    return {
        providerId,
        score: basePriority + lowPenalty,
        available: true,
    };
}

/**
 * Score and sort a list of provider IDs by effective priority.
 * Unavailable providers (circuit open / quota exhausted) are excluded.
 * Returns only the IDs, in preferred order.
 */
export function rankProviders(providerIds: string[]): string[] {
    return providerIds
        .map(scoreProvider)
        .sort((a, b) => a.score - b.score)
        .filter((s) => s.available)
        .map((s) => s.providerId);
}

/**
 * Full diagnostic snapshot — all providers with their scores.
 * Includes unavailable providers so callers can report why they're skipped.
 */
export function getPrioritySnapshot(providerIds: string[]): ProviderScore[] {
    return providerIds
        .map(scoreProvider)
        .sort((a, b) => a.score - b.score);
}

/**
 * Determine whether a provider switch has occurred (for timeline events).
 * Returns true if the previously preferred provider is now different from the new one.
 */
export function detectPrioritySwitch(
    previousPrimary: string | undefined,
    currentPrimary: string | undefined,
): boolean {
    if (!previousPrimary || !currentPrimary) return false;
    return previousPrimary !== currentPrimary;
}
