/**
 * Antigravity Gateway — Provider State Facade
 *
 * Public read-only view of the current active provider execution state.
 * Aggregates data from the quota orchestrator and circuit breakers into
 * a single, coherent snapshot for monitoring, alerting, and the supervisor.
 *
 * Architecture rule:
 *   This module ONLY reads state — it never modifies orchestration logic.
 *   Mutations belong exclusively in quota-orchestrator.ts.
 */

import { quotaOrchestrator, ROTATION_ORDER, ROTATION_CONFIG } from './quota-orchestrator.js';
import { circuitBreakers } from './circuit-breaker.js';

// ── Public types ─────────────────────────────────────────────────────────────

export interface ProviderRuntimeState {
    /** ID of the provider currently holding the active rotation slot. */
    activeProvider: string;
    /** Requests used in the current active batch. */
    currentBatchCount: number;
    /** Max requests in the current active batch before rotation. */
    currentBatchLimit: number;
    /** Requests remaining before the orchestrator switches providers. */
    requestsUntilSwitch: number;
    /** Whether the active provider is currently available. */
    activeProviderAvailable: boolean;

    /** Per-provider detail for all managed providers. */
    providers: {
        nkq: ProviderRuntimeDetail;
        opus: ProviderRuntimeDetail;
    };

    /** True when BOTH managed providers are unavailable. */
    allExhausted: boolean;

    /** Unix-ms timestamp of the snapshot. */
    snapshotAt: number;
}

export interface ProviderRuntimeDetail {
    id: string;
    label: string;
    status: string;
    usedQuota: number;
    totalQuota: number;
    remainingQuota: number;
    /** Fraction of quota used, 0–1. */
    quotaFraction: number;
    currentBatchCount: number;
    currentBatchLimit: number;
    firstRequestAt: number | null;
    resetAt: number | null;
    /** Ms until window resets. null if window not started. */
    msUntilReset: number | null;
    consecutiveFailures: number;
    totalRequests: number;
    totalFailures: number;
    circuitBreakerOpen: boolean;
}

// ── Implementation ───────────────────────────────────────────────────────────

/**
 * Snapshot the full provider runtime state.
 * Safe to call on every request — no writes, no side effects.
 */
export function getProviderRuntimeState(): ProviderRuntimeState {
    const metrics = quotaOrchestrator.getMetrics();
    const now = Date.now();

    const buildDetail = (providerId: string): ProviderRuntimeDetail => {
        const s = quotaOrchestrator.getProviderState(providerId);
        const conf = ROTATION_CONFIG[providerId];
        const msUntilReset = s.resetAt !== null ? Math.max(0, s.resetAt - now) : null;
        const quotaFraction = s.totalQuota > 0 ? s.usedQuota / s.totalQuota : 0;

        return {
            id: providerId,
            label: providerId === 'antigravity' ? 'NKQ (Antigravity)' : 'OpusMax',
            status: s.state,
            usedQuota: s.usedQuota,
            totalQuota: s.totalQuota,
            remainingQuota: s.remainingQuota,
            quotaFraction,
            currentBatchCount: s.currentBatchUsage,
            currentBatchLimit: s.currentBatchLimit,
            firstRequestAt: s.firstRequestAt,
            resetAt: s.resetAt,
            msUntilReset,
            consecutiveFailures: s.consecutiveFailures,
            totalRequests: s.totalRequests,
            totalFailures: s.totalFailures,
            circuitBreakerOpen: !circuitBreakers.canExecute(providerId),
        };
    };

    const nkqDetail = buildDetail('antigravity');
    const opusDetail = buildDetail('opusmax');

    const activeProvider = metrics.currentActiveProvider;
    const activeState = quotaOrchestrator.getProviderState(activeProvider);
    const activeProviderAvailable =
        activeState.state !== 'EXHAUSTED' &&
        activeState.state !== 'DEGRADED' &&
        activeState.state !== 'BREAKER_OPEN';

    const allExhausted = !activeProviderAvailable &&
        nkqDetail.status === 'EXHAUSTED' &&
        opusDetail.status === 'EXHAUSTED';

    return {
        activeProvider,
        currentBatchCount: activeState.currentBatchUsage,
        currentBatchLimit: activeState.currentBatchLimit,
        requestsUntilSwitch: metrics.requestsUntilSwitch,
        activeProviderAvailable,
        providers: {
            nkq: nkqDetail,
            opus: opusDetail,
        },
        allExhausted,
        snapshotAt: now,
    };
}

/**
 * Diagnose the current orchestration health.
 * Returns a list of anomaly descriptions (empty = healthy).
 * Used by the supervisor for alert generation.
 */
export interface OrchestrationAnomaly {
    severity: 'warning' | 'critical';
    code: string;
    message: string;
    providerId?: string;
}

export function detectOrchestrationAnomalies(): OrchestrationAnomaly[] {
    const state = getProviderRuntimeState();
    const anomalies: OrchestrationAnomaly[] = [];
    const now = Date.now();

    // ── NKQ completely inactive while OpusMax has all the traffic ─────
    const nkq = state.providers.nkq;
    const opus = state.providers.opus;

    if (
        nkq.totalRequests === 0 &&
        opus.totalRequests > 10
    ) {
        anomalies.push({
            severity: 'warning',
            code: 'NKQ_INACTIVITY',
            message: `NKQ has received 0 requests while OpusMax has handled ${opus.totalRequests}. Check rotation state.`,
            providerId: 'antigravity',
        });
    }

    // ── Significant quota imbalance (one provider far exceeds expected ratio) ─
    const totalRequests = nkq.totalRequests + opus.totalRequests;
    if (totalRequests > 30) {
        // Expected: NKQ handles ~25% (20/80), OpusMax ~75% (60/80) of requests
        const nkqFraction = nkq.totalRequests / totalRequests;
        if (nkqFraction > 0.60) {
            anomalies.push({
                severity: 'warning',
                code: 'ROTATION_IMBALANCE_NKQ_HIGH',
                message: `NKQ serving ${Math.round(nkqFraction * 100)}% of requests (expected ~25%). Rotation may be stuck.`,
                providerId: 'antigravity',
            });
        }
        if (nkqFraction < 0.10) {
            anomalies.push({
                severity: 'warning',
                code: 'ROTATION_IMBALANCE_OPUS_HIGH',
                message: `OpusMax serving ${Math.round((1 - nkqFraction) * 100)}% of requests (expected ~75%). NKQ may be blocked.`,
                providerId: 'opusmax',
            });
        }
    }

    // ── Both providers exhausted ───────────────────────────────────────
    if (state.allExhausted) {
        anomalies.push({
            severity: 'critical',
            code: 'ALL_PROVIDERS_EXHAUSTED',
            message: 'All managed providers are exhausted or unavailable. Requests falling back to Anthropic/Ollama.',
        });
    }

    // ── Provider degraded (consecutive failures) ───────────────────────
    for (const p of [nkq, opus]) {
        if (p.consecutiveFailures >= 3) {
            anomalies.push({
                severity: p.consecutiveFailures >= 5 ? 'critical' : 'warning',
                code: 'PROVIDER_CONSECUTIVE_FAILURES',
                message: `${p.label} has ${p.consecutiveFailures} consecutive failures.`,
                providerId: p.id,
            });
        }
    }

    // ── Circuit breaker tripped ────────────────────────────────────────
    for (const p of [nkq, opus]) {
        if (p.circuitBreakerOpen) {
            anomalies.push({
                severity: 'critical',
                code: 'CIRCUIT_BREAKER_OPEN',
                message: `${p.label} circuit breaker is OPEN. Provider temporarily removed from rotation.`,
                providerId: p.id,
            });
        }
    }

    // ── Quota nearly exhausted (warning at 85%) ────────────────────────
    for (const p of [nkq, opus]) {
        if (p.quotaFraction >= 0.85 && p.quotaFraction < 1.0) {
            anomalies.push({
                severity: 'warning',
                code: 'QUOTA_NEARLY_EXHAUSTED',
                message: `${p.label} is at ${Math.round(p.quotaFraction * 100)}% quota usage. Exhaustion imminent.`,
                providerId: p.id,
            });
        }
    }

    return anomalies;
}

/**
 * Quick check: is the orchestration healthy?
 * True = no critical anomalies found.
 */
export function isOrchestrationHealthy(): boolean {
    return detectOrchestrationAnomalies().every((a) => a.severity !== 'critical');
}
