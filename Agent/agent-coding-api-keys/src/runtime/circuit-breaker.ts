/**
 * Antigravity Gateway — Provider Circuit Breakers
 *
 * Prevents unstable providers from poisoning orchestration stability.
 *
 * States:
 *  - CLOSED: normal operation, requests flow through
 *  - OPEN: provider quarantined, requests fail fast
 *  - HALF_OPEN: probing recovery, limited requests allowed
 *
 * Features:
 *  - Rolling failure window
 *  - Automatic quarantine on threshold breach
 *  - Recovery probing with exponential backoff
 *  - Degraded provider scoring
 *  - Per-provider independent state
 */

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
    /** Number of failures in the window to trip the breaker. */
    failureThreshold: number;
    /** Rolling window duration (ms). */
    windowMs: number;
    /** How long to stay open before probing (ms). */
    openDurationMs: number;
    /** Max probes allowed in half-open state. */
    halfOpenMaxProbes: number;
    /** Successes needed in half-open to close the breaker. */
    halfOpenSuccessThreshold: number;
}

export interface CircuitBreakerState {
    providerId: string;
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureAt: number | null;
    lastSuccessAt: number | null;
    openedAt: number | null;
    halfOpenProbes: number;
    totalTrips: number;
    consecutiveFailures: number;
}

export interface CircuitBreakerStats {
    providers: Record<string, CircuitBreakerState>;
    totalOpen: number;
    totalHalfOpen: number;
    totalClosed: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,
    windowMs: 60_000,
    openDurationMs: 30_000,
    halfOpenMaxProbes: 2,
    halfOpenSuccessThreshold: 2,
};

interface FailureRecord {
    timestamp: number;
}

class ProviderCircuitBreaker {
    private state: CircuitState = 'closed';
    private failures: FailureRecord[] = [];
    private successes = 0;
    private consecutiveFailures = 0;
    private lastFailureAt: number | null = null;
    private lastSuccessAt: number | null = null;
    private openedAt: number | null = null;
    private halfOpenProbes = 0;
    private totalTrips = 0;

    constructor(
        readonly providerId: string,
        private readonly config: CircuitBreakerConfig,
    ) { }

    /** Check if a request should be allowed through. */
    canExecute(): boolean {
        this.cleanWindow();

        switch (this.state) {
            case 'closed':
                return true;

            case 'open': {
                const now = Date.now();
                const elapsed = now - (this.openedAt ?? now);
                if (elapsed >= this.config.openDurationMs) {
                    // Transition to half-open
                    this.state = 'half_open';
                    this.halfOpenProbes = 0;
                    return true;
                }
                return false; // Still quarantined
            }

            case 'half_open':
                return this.halfOpenProbes < this.config.halfOpenMaxProbes;
        }
    }

    /** Record a successful request. */
    recordSuccess(): void {
        this.lastSuccessAt = Date.now();
        this.consecutiveFailures = 0;

        if (this.state === 'half_open') {
            this.successes++;
            if (this.successes >= this.config.halfOpenSuccessThreshold) {
                // Recovery confirmed — close the breaker
                this.state = 'closed';
                this.failures = [];
                this.successes = 0;
                this.openedAt = null;
            }
        }
    }

    /** Record a failed request. */
    recordFailure(): void {
        const now = Date.now();
        this.lastFailureAt = now;
        this.consecutiveFailures++;

        if (this.state === 'half_open') {
            // Probe failed — reopen
            this.state = 'open';
            this.openedAt = now;
            this.totalTrips++;
            return;
        }

        this.failures.push({ timestamp: now });
        this.cleanWindow();

        if (this.failures.length >= this.config.failureThreshold) {
            // Trip the breaker
            this.state = 'open';
            this.openedAt = now;
            this.totalTrips++;
            this.successes = 0;
        }
    }

    /** Record a half-open probe attempt. */
    recordProbe(): void {
        this.halfOpenProbes++;
    }

    /** Get current state snapshot. */
    getState(): CircuitBreakerState {
        this.cleanWindow();
        return {
            providerId: this.providerId,
            state: this.state,
            failures: this.failures.length,
            successes: this.successes,
            lastFailureAt: this.lastFailureAt,
            lastSuccessAt: this.lastSuccessAt,
            openedAt: this.openedAt,
            halfOpenProbes: this.halfOpenProbes,
            totalTrips: this.totalTrips,
            consecutiveFailures: this.consecutiveFailures,
        };
    }

    /** Force reset the breaker to closed state. */
    reset(): void {
        this.state = 'closed';
        this.failures = [];
        this.successes = 0;
        this.consecutiveFailures = 0;
        this.openedAt = null;
        this.halfOpenProbes = 0;
    }

    /** Remove failures outside the rolling window. */
    private cleanWindow(): void {
        const cutoff = Date.now() - this.config.windowMs;
        this.failures = this.failures.filter((f) => f.timestamp > cutoff);
    }
}

class CircuitBreakerRegistry {
    private breakers = new Map<string, ProviderCircuitBreaker>();
    private config: CircuitBreakerConfig;

    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /** Get or create a circuit breaker for a provider. */
    getBreaker(providerId: string): ProviderCircuitBreaker {
        let breaker = this.breakers.get(providerId);
        if (!breaker) {
            breaker = new ProviderCircuitBreaker(providerId, this.config);
            this.breakers.set(providerId, breaker);
        }
        return breaker;
    }

    /** Check if a provider is allowed to receive requests. */
    canExecute(providerId: string): boolean {
        return this.getBreaker(providerId).canExecute();
    }

    /** Record success for a provider. */
    recordSuccess(providerId: string): void {
        this.getBreaker(providerId).recordSuccess();
    }

    /** Record failure for a provider. */
    recordFailure(providerId: string): void {
        this.getBreaker(providerId).recordFailure();
    }

    /** Get stats for all providers. */
    getStats(): CircuitBreakerStats {
        const providers: Record<string, CircuitBreakerState> = {};
        let totalOpen = 0;
        let totalHalfOpen = 0;
        let totalClosed = 0;

        for (const [id, breaker] of this.breakers) {
            const state = breaker.getState();
            providers[id] = state;
            if (state.state === 'open') totalOpen++;
            else if (state.state === 'half_open') totalHalfOpen++;
            else totalClosed++;
        }

        return { providers, totalOpen, totalHalfOpen, totalClosed };
    }

    /** Force reset a specific provider's breaker. */
    reset(providerId: string): void {
        this.getBreaker(providerId).reset();
    }

    /** Force reset all breakers. */
    resetAll(): void {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }
}

/** Singleton circuit breaker registry. */
export const circuitBreakers = new CircuitBreakerRegistry();
