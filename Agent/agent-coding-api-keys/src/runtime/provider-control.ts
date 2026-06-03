/**
 * Antigravity Gateway — Provider Control
 *
 * Operator-assisted orchestration state.
 *
 * Two modes:
 *   manual        — Operator selects provider. Router obeys unconditionally.
 *   assisted-auto — Quota orchestrator rotates as before. Runtime emits
 *                   suggestions; operator may confirm switches via dashboard.
 *
 * Architecture rule:
 *   This module is the ONLY place that stores operator intent.
 *   The router reads activeProvider + mode on every request.
 *   Dashboard writes via POST /api/runtime/provider/switch.
 *   Nothing else should touch this state.
 */

import { timeline } from './timeline.js';
import type { UpstreamErrorType } from './upstream-error-classifier.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type ControlMode = 'manual' | 'assisted-auto';

export interface ControlSuggestion {
    providerId: string;
    reason: string;
    severity: 'info' | 'warn' | 'critical';
    suggestedAt: number;
}

export interface ProviderErrorEntry {
    type: UpstreamErrorType;
    label: string;
    at: number;
}

export interface ControlStatus {
    mode: ControlMode;
    /** In manual mode: the operator-selected provider ID. null = auto. */
    activeProvider: string | null;
    /** Unix-ms timestamp when current provider was activated. */
    activeSince: number | null;
    /** Requests successfully routed since last switch. */
    requestsRouted: number;
    /** Average latency (ms) over the last 100 requests for the active provider. */
    avgLatencyMs: number | null;
    /** Pending auto-suggestions (assisted-auto mode only). */
    suggestions: ControlSuggestion[];
    /**
     * Last known error type per provider. Used by the dashboard to show
     * real-time status (Auth Failed / Rate Limited / Provider Down / etc.).
     * Cleared when a request succeeds for that provider.
     */
    providerErrors: Record<string, ProviderErrorEntry>;
}

// ── Implementation ───────────────────────────────────────────────────────────

class ProviderControl {
    private _mode: ControlMode = 'assisted-auto';
    private _activeProvider: string | null = null;
    private _activeSince: number | null = null;
    private _requestsRouted = 0;
    private _latencies: number[] = [];
    private _suggestions: ControlSuggestion[] = [];
    private _providerErrors: Record<string, ProviderErrorEntry> = {};

    // ── Read accessors (router uses these) ─────────────────────────────

    get mode(): ControlMode { return this._mode; }
    get activeProvider(): string | null { return this._activeProvider; }

    // ── Operator commands ───────────────────────────────────────────────

    /**
     * Hot-swap the active provider. Always puts the system into manual mode.
     * Returns the previous and new provider IDs.
     */
    switchTo(providerId: string, operatorInitiated = true): { previous: string | null; current: string } {
        const previous = this._activeProvider;

        // Deactivate previous
        if (previous) {
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'provider.deactivated',
                source: 'provider-control',
                payload: {
                    providerId: previous,
                    requestsRouted: this._requestsRouted,
                    avgLatencyMs: this._avgLatency(),
                },
            });
        }

        this._activeProvider = providerId;
        this._activeSince = Date.now();
        this._requestsRouted = 0;
        this._latencies = [];
        this._mode = 'manual';
        this._suggestions = []; // clear stale suggestions on explicit switch

        // Activate new
        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'provider.activated',
            source: 'provider-control',
            payload: { providerId, operatorInitiated },
        });

        if (operatorInitiated) {
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'provider.manual_switch',
                source: 'provider-control',
                payload: {
                    from: previous === 'antigravity' ? 'antigravity-nkq' : (previous ?? 'none'),
                    to: providerId,
                    previousProvider: previous,
                    activeProvider: providerId,
                },
            });
        }

        console.log(`[provider-control] Manual switch: ${previous ?? 'none'} → ${providerId} (operator=${operatorInitiated})`);
        return { previous, current: providerId };
    }

    /**
     * Change orchestration mode.
     * Switching to assisted-auto clears the manual override.
     */
    setMode(mode: ControlMode): void {
        const prev = this._mode;
        this._mode = mode;

        if (mode === 'assisted-auto') {
            const deactivated = this._activeProvider;
            this._activeProvider = null;
            this._activeSince = null;
            this._requestsRouted = 0;
            this._latencies = [];

            if (deactivated) {
                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: 'provider.deactivated',
                    source: 'provider-control',
                    payload: { providerId: deactivated, reason: 'mode_changed_to_auto' },
                });
            }
        }

        console.log(`[provider-control] Mode: ${prev} → ${mode}`);
    }

    // ── Runtime stats recording (called by router on success) ───────────

    /**
     * Record a successfully routed request.
     * Only counted when the routed provider matches the active manual override.
     * Clears any previous error state for this provider.
     */
    recordRouted(providerId: string, latencyMs: number): void {
        // Clear error on success
        delete this._providerErrors[providerId];

        if (this._mode === 'manual' && this._activeProvider === providerId) {
            this._requestsRouted++;
            this._latencies.push(latencyMs);
            if (this._latencies.length > 100) this._latencies.shift();
        }
    }

    /**
     * Record a classified upstream error for a provider.
     * Surfaced in the dashboard as real-time status.
     */
    recordError(providerId: string, errorType: UpstreamErrorType, label: string): void {
        this._providerErrors[providerId] = { type: errorType, label, at: Date.now() };
    }

    // ── Suggestions (assisted-auto mode) ───────────────────────────────

    /** Emit an auto-suggestion to the operator. Deduplicated by providerId. */
    suggest(suggestion: Omit<ControlSuggestion, 'suggestedAt'>): void {
        const full: ControlSuggestion = { ...suggestion, suggestedAt: Date.now() };
        this._suggestions = [
            full,
            ...this._suggestions.filter((s) => s.providerId !== suggestion.providerId),
        ].slice(0, 5);

        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'provider.auto_suggest',
            source: 'provider-control',
            payload: { ...full },
        });
    }

    clearSuggestions(): void {
        this._suggestions = [];
    }

    /**
     * Set the default provider at gateway startup without emitting timeline events.
     * Only takes effect if no provider has been selected yet.
     */
    setDefault(providerId: string): void {
        if (this._activeProvider === null) {
            this._activeProvider = providerId;
            this._mode = 'manual';
            this._activeSince = Date.now();
            console.log(`[provider-control] Default active provider: ${providerId}`);
        }
    }

    // ── Snapshot ────────────────────────────────────────────────────────

    getStatus(): ControlStatus {
        return {
            mode: this._mode,
            activeProvider: this._activeProvider,
            activeSince: this._activeSince,
            requestsRouted: this._requestsRouted,
            avgLatencyMs: this._avgLatency(),
            suggestions: [...this._suggestions],
            providerErrors: { ...this._providerErrors },
        };
    }

    // ── Private ─────────────────────────────────────────────────────────

    private _avgLatency(): number | null {
        if (this._latencies.length === 0) return null;
        return Math.round(this._latencies.reduce((a, b) => a + b, 0) / this._latencies.length);
    }
}

/** Singleton operator control state. Import this in the router and server. */
export const providerControl = new ProviderControl();
