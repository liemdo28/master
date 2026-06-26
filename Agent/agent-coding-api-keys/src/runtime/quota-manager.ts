/**
 * Antigravity Gateway — Quota Manager
 *
 * Tracks per-provider request quotas with:
 *  - Monthly limit enforcement (calendar-month rolling window)
 *  - Automatic quota exhaustion and low-water-mark detection
 *  - Timeline event emission on threshold crossings
 *  - Fallback frequency tracking per provider
 *
 * Quota tiers (priority order):
 *   1. Antigravity NKQ  — 250 req/month included (priority 1)
 *   2. OpusMax          — unlimited, fallback (priority 2)
 *   3. Anthropic        — pay-as-you-go (priority 3)
 *   4. others           — no quota tracking (no limit)
 *
 * The quota manager is intentionally opaque to the IDE — it only
 * informs the gateway's internal routing decisions.
 */

import { timeline } from './timeline.js';

export interface QuotaConfig {
    /** Provider identifier (matches provider.id). */
    providerId: string;
    /** Maximum requests allowed per calendar month. */
    monthlyLimit: number;
    /** % remaining that triggers "low" warning (default 20). */
    lowWaterMarkPct: number;
    /** Routing priority when quota is available (lower = higher priority). */
    priority: number;
}

export interface QuotaState {
    providerId: string;
    monthlyLimit: number;
    used: number;
    remaining: number;
    /** Unix-ms timestamp at which quota resets (start of next month). */
    resetAt: number;
    priority: number;
    isExhausted: boolean;
    isLow: boolean;
    lastConsumedAt: number | null;
    /** Times this provider was passed over due to quota pressure. */
    fallbackSkips: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function startOfNextMonth(): number {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0).getTime();
}

function monthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Per-provider quota tracker ─────────────────────────────────────────────

class ProviderQuota {
    private used = 0;
    private resetAt: number = startOfNextMonth();
    private currentMonthKey: string = monthKey();
    private lastConsumedAt: number | null = null;
    private fallbackSkips = 0;

    constructor(private readonly config: QuotaConfig) {}

    /** Roll over if the calendar month has changed. */
    private maybeReset(): void {
        const key = monthKey();
        if (key !== this.currentMonthKey) {
            this.used = 0;
            this.currentMonthKey = key;
            this.resetAt = startOfNextMonth();
        }
    }

    get remaining(): number {
        this.maybeReset();
        return Math.max(0, this.config.monthlyLimit - this.used);
    }

    get isExhausted(): boolean {
        return this.remaining === 0;
    }

    get isLow(): boolean {
        if (this.isExhausted) return false;
        const pct = (this.remaining / this.config.monthlyLimit) * 100;
        return pct <= this.config.lowWaterMarkPct;
    }

    consume(): void {
        this.maybeReset();
        this.used = Math.min(this.used + 1, this.config.monthlyLimit);
        this.lastConsumedAt = Date.now();
    }

    recordSkip(): void {
        this.fallbackSkips++;
    }

    getState(): QuotaState {
        this.maybeReset();
        return {
            providerId: this.config.providerId,
            monthlyLimit: this.config.monthlyLimit,
            used: this.used,
            remaining: this.remaining,
            resetAt: this.resetAt,
            priority: this.config.priority,
            isExhausted: this.isExhausted,
            isLow: this.isLow,
            lastConsumedAt: this.lastConsumedAt,
            fallbackSkips: this.fallbackSkips,
        };
    }
}

// ── Registry ────────────────────────────────────────────────────────────────

class QuotaManager {
    private readonly quotas = new Map<string, ProviderQuota>();
    /** Track previous threshold states to fire events only on transitions. */
    private readonly prevExhausted = new Set<string>();
    private readonly prevLow = new Set<string>();

    // ── Registration ──────────────────────────────────────────────────

    /** Register a provider with a quota policy. Call during gateway startup. */
    register(config: QuotaConfig): this {
        this.quotas.set(config.providerId, new ProviderQuota(config));
        return this;
    }

    /** True if this provider has a registered quota policy. */
    hasQuota(providerId: string): boolean {
        return this.quotas.has(providerId);
    }

    // ── Consumption ───────────────────────────────────────────────────

    /**
     * Record a consumed request for the given provider.
     * Emits `provider.quota_low` or `provider.quota_exhausted` on threshold crossings.
     */
    consume(providerId: string): void {
        const quota = this.quotas.get(providerId);
        if (!quota) return;

        const wasExhausted = quota.isExhausted;
        const wasLow = quota.isLow;
        quota.consume();

        const state = quota.getState();

        if (!wasExhausted && quota.isExhausted) {
            this.prevExhausted.add(providerId);
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'provider.quota_exhausted',
                source: 'quota-manager',
                payload: {
                    providerId,
                    used: state.used,
                    limit: state.monthlyLimit,
                    resetAt: state.resetAt,
                },
            });
        } else if (!wasLow && quota.isLow) {
            this.prevLow.add(providerId);
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'provider.quota_low',
                source: 'quota-manager',
                payload: {
                    providerId,
                    remaining: state.remaining,
                    limit: state.monthlyLimit,
                    pct: Math.round((state.remaining / state.monthlyLimit) * 100),
                },
            });
        }
    }

    /** Record that a provider was skipped due to quota pressure. */
    recordSkip(providerId: string): void {
        this.quotas.get(providerId)?.recordSkip();
    }

    // ── Queries ───────────────────────────────────────────────────────

    /** True if the provider's monthly quota is completely used. */
    isExhausted(providerId: string): boolean {
        return this.quotas.get(providerId)?.isExhausted ?? false;
    }

    /** True if the provider is approaching quota exhaustion (< lowWaterMarkPct%). */
    isLow(providerId: string): boolean {
        return this.quotas.get(providerId)?.isLow ?? false;
    }

    /** Routing priority for this provider (lower = higher priority). */
    getPriority(providerId: string): number {
        return this.quotas.get(providerId)?.getState().priority ?? 999;
    }

    /** Get full quota state for one provider. */
    getQuota(providerId: string): QuotaState | undefined {
        return this.quotas.get(providerId)?.getState();
    }

    /** Get quota states for all registered providers (sorted by priority). */
    getAll(): QuotaState[] {
        return [...this.quotas.values()]
            .map((q) => q.getState())
            .sort((a, b) => a.priority - b.priority);
    }
}

// ── Singleton ───────────────────────────────────────────────────────────────

/** Singleton quota manager — pre-registered with known quota policies. */
export const quotaManager = new QuotaManager()
    .register({
        providerId: 'antigravity',
        monthlyLimit: 250,
        lowWaterMarkPct: 20,   // warn at ≤ 50 requests remaining
        priority: 1,
    })
    .register({
        providerId: 'opusmax',
        monthlyLimit: 999_999, // effectively unlimited
        lowWaterMarkPct: 5,
        priority: 2,
    });
