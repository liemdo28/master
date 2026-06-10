/**
 * Antigravity Gateway — Quota Orchestrator
 *
 * Window-based rotating quota scheduler.
 *
 * Rotation pattern (stateful, persistent, recoverable):
 *   NKQ(20) → OpusMax(60) → NKQ(20) → OpusMax(60) → …
 *
 * Rolling window semantics:
 *   - Each provider's 5 h reset window starts ONLY on first request.
 *   - If untouched, the window never starts; quota never drains.
 *   - At window expiry, quota and batch counters reset fully.
 *
 * Provider quota ledger:
 *   Antigravity NKQ  1050 req / 5 h (legacy key + 4.6/4.7 model quotas)
 *   OpusMax          800 req / 5 h
 *
 * Edge cases handled:
 *   - Provider quota exhausted early → skip that slot in rotation
 *   - Provider circuit breaker open → remove temporarily from rotation
 *   - Provider degraded (≥ 5 consecutive failures) → remove until reset
 *   - Both providers unavailable → return empty list (router falls back to anthropic/ollama)
 *
 * Persistence:
 *   State written to data/orchestrator-state.json on every mutation.
 *   Loaded at startup; corrupt / missing file starts fresh (no data loss risk).
 *
 * Architecture rule:
 *   This module lives ONLY in the runtime layer.
 *   The IDE and provider adapters must never import or reference it.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { circuitBreakers } from './circuit-breaker.js';
import { timeline } from './timeline.js';

// ── Static configuration ────────────────────────────────────────────────────

export interface ProviderRotationConfig {
    /** Max requests per batch before switching to the other provider. */
    batchSize: number;
    /** Hard quota ceiling per reset window. */
    totalQuota: number;
    /** Length of the rolling reset window in milliseconds. */
    windowMs: number;
}

/** 5-hour window shared by all managed providers. */
const WINDOW_5H = 5 * 60 * 60 * 1_000;

/**
 * Rotation configuration per provider.
 * Keys must match provider IDs registered in keys.json / config.
 */
export const ROTATION_CONFIG: Record<string, ProviderRotationConfig> = {
    antigravity: { batchSize: 20, totalQuota: 1050, windowMs: WINDOW_5H },
    opusmax: { batchSize: 60, totalQuota: 800, windowMs: WINDOW_5H },
};

/**
 * Fixed rotation order (index 0 = highest priority).
 * Batch-switch advances forward then wraps back.
 */
export const ROTATION_ORDER = ['antigravity', 'opusmax'] as const;
export type RotationProviderId = (typeof ROTATION_ORDER)[number];

/** Number of consecutive failures before a provider is considered degraded. */
const DEGRADE_THRESHOLD = 5;

/** Short display names for console logging. */
const DISPLAY_NAME: Record<string, string> = {
    antigravity: 'NKQ',
    opusmax:     'Opus',
};

/** Persistent state schema version. Bump to invalidate old state. */
const STATE_VERSION = 2;

// ── State model ─────────────────────────────────────────────────────────────

export type OrchestratorProviderStatus =
    | 'ACTIVE'        // current rotation slot, accepting requests
    | 'STANDBY'       // waiting for its batch turn
    | 'EXHAUSTED'     // quota ceiling reached for this window
    | 'DEGRADED'      // too many consecutive failures
    | 'BREAKER_OPEN'; // circuit breaker tripped

/** Internal mutable state per provider (persisted). */
interface ProviderInternalState {
    providerId: string;
    usedQuota: number;
    currentBatchUsed: number;
    /** Unix-ms timestamp of the first request in this window. null = window not started. */
    firstRequestAt: number | null;
    consecutiveFailures: number;
    lastFailureAt: number | null;
    /** Last error message from a routing failure — diagnostic only. */
    lastError: string | null;
    totalRequests: number;
    totalFailures: number;
}

/** Persistent root state (serialized to disk). */
interface PersistentState {
    version: number;
    savedAt: number;
    /** Index into ROTATION_ORDER indicating the currently active batch provider. */
    currentProviderIndex: number;
    providers: Record<string, ProviderInternalState>;
}

/** Public snapshot exposed via API and metrics. */
export interface ProviderOrchestrationState {
    /** Matches the user spec field name. */
    provider: string;
    totalQuota: number;
    usedQuota: number;
    remainingQuota: number;
    resetWindowMs: number;
    firstRequestAt: number | null;
    resetAt: number | null;
    currentBatchUsage: number;
    currentBatchLimit: number;
    state: OrchestratorProviderStatus;
    consecutiveFailures: number;
    lastFailureAt: number | null;
    /** Last error from upstream (diagnostic). */
    lastError: string | null;
    totalRequests: number;
    totalFailures: number;
}

export interface OrchestratorMetrics {
    currentActiveProvider: string;
    rotationOrder: readonly string[];
    providers: ProviderOrchestrationState[];
    /** Requests remaining in the current batch before next rotation switch. */
    requestsUntilSwitch: number;
    /** ISO string of when the current window resets (null if window not started). */
    nextWindowReset: string | null;
}

// ── Implementation ──────────────────────────────────────────────────────────

class QuotaOrchestrator {
    private state: PersistentState;
    private readonly statePath: string;

    constructor() {
        this.statePath = join(process.cwd(), 'data', 'orchestrator-state.json');
        this.state = this.loadState();
    }

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Get the ordered list of managed providers for the next request.
     *
     * Position 0 is the recommended primary. Position 1 is the fallback.
     * Returns an empty array if all managed providers are unavailable —
     * the router should then fall through to its own priority chain.
     *
     * MANDATORY RULE: When antigravity (NKQ) is the active rotation slot
     * and has available quota, it MUST be position 0. NO exceptions.
     *
     * This method is read-only and does NOT advance state.
     * State advances in `consume()`.
     */
    getCandidates(): string[] {
        for (const id of ROTATION_ORDER) this.maybeReset(id);

        const currentId = this.currentProviderId();
        const currentConf = ROTATION_CONFIG[currentId];
        const currentIntern = this.providerState(currentId);
        const batchFull = currentConf !== undefined
            && currentIntern.currentBatchUsed >= currentConf.batchSize;

        const altId = this.nextProviderId();
        const result: string[] = [];

        if (batchFull) {
            // State-recovery path: batch counter is at its limit but the rotation index
            // was never advanced (typically a crash between the last consume() increment
            // and the index save). Advance now and emit a recovery switch event.
            const prevIdx = this.state.currentProviderIndex;
            this.state.currentProviderIndex = (this.state.currentProviderIndex + 1) % ROTATION_ORDER.length;
            currentIntern.currentBatchUsed = 0; // reset batch for next turn

            console.log(`[Rotation] State-recovery switch: ${DISPLAY_NAME[currentId] ?? currentId} → ${DISPLAY_NAME[altId] ?? altId} (batch was at limit on getCandidates)`);

            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'quota.provider_switched',
                source: 'quota-orchestrator',
                payload: {
                    from: currentId === 'antigravity' ? 'antigravity-nkq' : currentId,
                    to: altId,
                    reason: 'state_recovery',
                    fromIndex: prevIdx,
                    toIndex: this.state.currentProviderIndex,
                    // backward-compat aliases
                    fromProvider: currentId,
                    toProvider: altId,
                },
            });

            if (this.isAvailable(altId)) result.push(altId);
            if (this.isAvailable(currentId)) result.push(currentId);
            this.save();
        } else {
            if (this.isAvailable(currentId)) result.push(currentId);
            if (this.isAvailable(altId)) result.push(altId);
        }

        // ── ENFORCEMENT: Auto-recover DEGRADED providers that still have quota ──
        // Applies to ALL managed rotation providers (NKQ + OpusMax).
        // NKQ is additionally force-promoted to position 0.
        for (const id of ROTATION_ORDER) {
            const conf = ROTATION_CONFIG[id];
            const intern = this.providerState(id);
            if (
                conf &&
                intern.usedQuota < conf.totalQuota &&
                intern.consecutiveFailures >= DEGRADE_THRESHOLD &&
                !result.includes(id)
            ) {
                intern.consecutiveFailures = 0;
                intern.lastError = null;
                const label = DISPLAY_NAME[id] ?? id;
                console.log(`[quota-orchestrator] Auto-recovering ${label} from DEGRADED state (quota still available: ${conf.totalQuota - intern.usedQuota} remaining)`);
                if (this.isAvailable(id)) {
                    if (id === 'antigravity') {
                        result.unshift(id); // NKQ MUST be first
                    } else {
                        result.push(id);
                    }
                }
            }
        }

        return result;
    }

    /**
     * Record a successful request to a provider.
     *
     * Starts the rolling window on first use, decrements quota, updates
     * the batch counter, and advances rotation when the batch fills.
     *
     * Must be called AFTER a confirmed successful provider response.
     */
    consume(providerId: string): void {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return; // not a managed provider

        const intern = this.providerState(providerId);
        const now = Date.now();

        // ── Start rolling window on first use ──────────────────────────
        if (intern.firstRequestAt === null) {
            intern.firstRequestAt = now;
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'quota.window_started',
                source: 'quota-orchestrator',
                payload: {
                    providerId,
                    firstRequestAt: now,
                    windowMs: conf.windowMs,
                    resetAt: now + conf.windowMs,
                },
            });
        }

        // ── Update quota and request counters ──────────────────────────
        intern.usedQuota = Math.min(intern.usedQuota + 1, conf.totalQuota);
        intern.totalRequests++;
        intern.consecutiveFailures = 0; // success clears failure streak
        intern.lastError = null;        // success clears last error

        // ── Check quota exhaustion ─────────────────────────────────────
        if (intern.usedQuota >= conf.totalQuota) {
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'quota.provider_exhausted',
                source: 'quota-orchestrator',
                payload: {
                    providerId,
                    usedQuota: intern.usedQuota,
                    totalQuota: conf.totalQuota,
                    resetAt: intern.firstRequestAt !== null ? intern.firstRequestAt + conf.windowMs : null,
                },
            });
        }

        // ── Batch counter (only when this provider owns the active slot) ──
        const label = DISPLAY_NAME[providerId] ?? providerId;
        const isActiveSlot = this.currentProviderId() === providerId;
        if (isActiveSlot) {
            const prevBatchUsed = intern.currentBatchUsed;
            intern.currentBatchUsed++;

            // ── Per-request batch counter log ──────────────────────────────
            console.log(`[${label}] Batch Usage: ${intern.currentBatchUsed}/${conf.batchSize}`);

            // Emit batch_started on very first request of the batch
            if (prevBatchUsed === 0) {
                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: 'quota.batch_started',
                    source: 'quota-orchestrator',
                    payload: {
                        providerId,
                        batchSize: conf.batchSize,
                        usedQuotaAtStart: intern.usedQuota,
                    },
                });
            }

            if (intern.currentBatchUsed >= conf.batchSize) {
                // Batch full — rotate to next slot
                const fromId = providerId;
                const nextIdx = (this.state.currentProviderIndex + 1) % ROTATION_ORDER.length;
                const toId = ROTATION_ORDER[nextIdx % ROTATION_ORDER.length] ?? ROTATION_ORDER[0]!;
                const toLabel = DISPLAY_NAME[toId] ?? toId;

                const prevIdx = this.state.currentProviderIndex;
                this.state.currentProviderIndex = nextIdx % ROTATION_ORDER.length;
                intern.currentBatchUsed = 0; // reset for next turn

                // ── Rotation switch log ─────────────────────────────────────
                console.log(`[Rotation] Switching Provider: ${label} → ${toLabel}`);

                // Emit batch_completed
                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: 'quota.batch_completed',
                    source: 'quota-orchestrator',
                    payload: {
                        providerId,
                        batchSize: conf.batchSize,
                        usedQuotaAfter: intern.usedQuota,
                    },
                });

                // Emit provider_switched — payload matches user spec exactly
                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: 'quota.provider_switched',
                    source: 'quota-orchestrator',
                    payload: {
                        from: fromId === 'antigravity' ? 'antigravity-nkq' : fromId,
                        to: toId,
                        reason: 'batch_limit_reached',
                        // backward-compat aliases kept for existing dashboard consumers
                        fromProvider: fromId,
                        toProvider: toId,
                        fromIndex: prevIdx,
                        toIndex: this.state.currentProviderIndex,
                    },
                });

                // Legacy event kept for dashboard compatibility
                timeline.emit({
                    sessionId: null,
                    requestId: null,
                    type: 'quota.batch_switch',
                    source: 'quota-orchestrator',
                    payload: {
                        fromProvider: fromId,
                        toProvider: toId,
                        batchSize: conf.batchSize,
                        fromUsedQuota: intern.usedQuota,
                    },
                });
            }
        }

        this.save();
    }

    /**
     * Record a failed request to a managed provider.
     * Increments consecutive failure count; emits degradation event at threshold.
     * @param error - Optional error message from the upstream provider for diagnostics.
     */
    recordFailure(providerId: string, error?: string): void {
        if (!ROTATION_CONFIG[providerId]) return;

        const intern = this.providerState(providerId);
        intern.consecutiveFailures++;
        intern.lastFailureAt = Date.now();
        intern.totalFailures++;
        if (error) intern.lastError = error.slice(0, 300); // cap to 300 chars

        if (intern.consecutiveFailures >= DEGRADE_THRESHOLD) {
            timeline.emit({
                sessionId: null,
                requestId: null,
                type: 'quota.provider_degraded',
                source: 'quota-orchestrator',
                payload: {
                    providerId,
                    consecutiveFailures: intern.consecutiveFailures,
                    threshold: DEGRADE_THRESHOLD,
                },
            });
        }

        this.save();
    }

    // ── Startup diagnostics ─────────────────────────────────────────────

    /**
     * Log the current orchestrator state to console at gateway startup.
     * Call this once after the singleton is created so operators can see
     * exactly which provider is ACTIVE and whether quotas are clean.
     */
    logStartupState(): void {
        const currentId = this.currentProviderId();
        const lines: string[] = [
            '[quota-orchestrator] ══ Startup state ══════════════════════════',
            `[quota-orchestrator]   Active rotation slot : ${currentId}`,
        ];
        for (const id of ROTATION_ORDER) {
            const conf = ROTATION_CONFIG[id]!;
            const intern = this.state.providers[id];
            const used = intern?.usedQuota ?? 0;
            const batch = intern?.currentBatchUsed ?? 0;
            const failures = intern?.consecutiveFailures ?? 0;
            const windowOk = intern?.firstRequestAt != null;
            const slot = id === currentId ? 'ACTIVE  ' : 'STANDBY ';
            lines.push(
                `[quota-orchestrator]   ${slot} ${id.padEnd(14)} quota=${used}/${conf.totalQuota}` +
                ` batch=${batch}/${conf.batchSize} failures=${failures}` +
                ` window=${windowOk ? 'RUNNING' : 'NOT STARTED'}`,
            );
            if (intern?.lastError) {
                lines.push(`[quota-orchestrator]              ↳ last error: ${intern.lastError}`);
            }
        }
        const candidates = this.getCandidates();
        lines.push(`[quota-orchestrator]   Candidates for next req : [${candidates.join(', ')}]`);
        if (candidates.length === 0 || !candidates.includes('antigravity')) {
            lines.push(`[quota-orchestrator]   ⚠  NKQ NOT in candidates! Check quota/circuit-breaker.`);
        }
        lines.push('[quota-orchestrator] ════════════════════════════════════════');
        for (const l of lines) console.log(l);
    }

    // ── Operator reset controls ─────────────────────────────────────────

    /**
     * Hard-reset ALL orchestrator state back to factory defaults.
     * Clears both in-memory state AND the persisted state file.
     * Also resets all circuit breakers so they do not block NKQ.
     * Intended for operator use via POST /api/runtime/reset.
     */
    reset(): void {
        this.state = this.freshState();
        this.save();
        // Also clear circuit breakers — a stale open breaker blocks NKQ even after quota reset
        circuitBreakers.resetAll();

        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'quota.state_reset',
            source: 'quota-orchestrator',
            payload: { scope: 'all', operator: true, breakersAlsoReset: true },
        });

        console.log('[quota-orchestrator] Full state reset by operator (quota + circuit breakers).');
    }

    /**
     * Reset a single provider's quota, batch counter, and failure state.
     * Does NOT change the rotation index.
     * Intended for operator use via POST /api/runtime/reset/:providerId.
     */
    resetProvider(providerId: string): boolean {
        if (!ROTATION_CONFIG[providerId]) return false;

        // Remove the provider's state — providerState() will reinitialise fresh
        delete this.state.providers[providerId];
        this.save();

        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'quota.state_reset',
            source: 'quota-orchestrator',
            payload: { scope: 'provider', providerId, operator: true },
        });

        console.log(`[quota-orchestrator] Provider reset: ${providerId}`);
        return true;
    }

    // ── State snapshots ─────────────────────────────────────────────────

    /** Get the public orchestration snapshot for a single provider. */
    getProviderState(providerId: string): ProviderOrchestrationState {
        for (const id of ROTATION_ORDER) this.maybeReset(id);

        const conf = ROTATION_CONFIG[providerId];
        const intern = this.providerState(providerId);

        const totalQuota = conf?.totalQuota ?? 0;
        const usedQuota = intern.usedQuota;
        const remainingQuota = Math.max(0, totalQuota - usedQuota);
        const windowMs = conf?.windowMs ?? 0;
        const resetAt = intern.firstRequestAt !== null && conf !== undefined
            ? intern.firstRequestAt + conf.windowMs
            : null;

        const isExhausted = totalQuota > 0 && usedQuota >= totalQuota;
        const isDegraded = intern.consecutiveFailures >= DEGRADE_THRESHOLD;
        const isBreakerOpen = !circuitBreakers.canExecute(providerId);
        const isActive = this.currentProviderId() === providerId;

        let status: OrchestratorProviderStatus;
        if (isBreakerOpen) status = 'BREAKER_OPEN';
        else if (isExhausted) status = 'EXHAUSTED';
        else if (isDegraded) status = 'DEGRADED';
        else if (isActive) status = 'ACTIVE';
        else status = 'STANDBY';

        return {
            provider: providerId,
            totalQuota,
            usedQuota,
            remainingQuota,
            resetWindowMs: windowMs,
            firstRequestAt: intern.firstRequestAt,
            resetAt,
            currentBatchUsage: intern.currentBatchUsed,
            currentBatchLimit: conf?.batchSize ?? 0,
            state: status,
            consecutiveFailures: intern.consecutiveFailures,
            lastFailureAt: intern.lastFailureAt,
            lastError: intern.lastError ?? null,
            totalRequests: intern.totalRequests,
            totalFailures: intern.totalFailures,
        };
    }

    /** Get public snapshots for all managed providers, in rotation order. */
    getAllStates(): ProviderOrchestrationState[] {
        return ROTATION_ORDER.map((id) => this.getProviderState(id));
    }

    /** Get orchestrator metrics for the `/api/metrics` endpoint. */
    getMetrics(): OrchestratorMetrics {
        const states = this.getAllStates();
        const currentId = this.currentProviderId();
        const currentConf = ROTATION_CONFIG[currentId];
        const currentIntern = this.providerState(currentId);

        const requestsUntilSwitch = currentConf !== undefined
            ? Math.max(0, currentConf.batchSize - currentIntern.currentBatchUsed)
            : 0;

        const currentState = this.getProviderState(currentId);
        const nextWindowReset = currentState.resetAt !== null
            ? new Date(currentState.resetAt).toISOString()
            : null;

        return {
            currentActiveProvider: currentId,
            rotationOrder: ROTATION_ORDER,
            providers: states,
            requestsUntilSwitch,
            nextWindowReset,
        };
    }

    // ── Private helpers ──────────────────────────────────────────────────

    /** True if the provider can accept requests right now. */
    private isAvailable(providerId: string): boolean {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return false;

        // Circuit breaker check (dynamic — not persisted)
        if (!circuitBreakers.canExecute(providerId)) return false;

        const intern = this.providerState(providerId);

        // Quota ceiling
        if (intern.usedQuota >= conf.totalQuota) return false;

        // Degraded (too many consecutive failures)
        if (intern.consecutiveFailures >= DEGRADE_THRESHOLD) return false;

        return true;
    }

    /**
     * Check whether the rolling window has expired for a provider.
     * If it has, reset quota and batch counters and emit `quota.window_reset`.
     */
    private maybeReset(providerId: string): void {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return;

        const intern = this.providerState(providerId);
        if (intern.firstRequestAt === null) return; // window never started

        const resetAt = intern.firstRequestAt + conf.windowMs;
        if (Date.now() < resetAt) return; // window still active

        // ── Window expired — full reset ────────────────────────────────
        intern.usedQuota = 0;
        intern.currentBatchUsed = 0;
        intern.firstRequestAt = null;
        intern.consecutiveFailures = 0;

        timeline.emit({
            sessionId: null,
            requestId: null,
            type: 'quota.window_reset',
            source: 'quota-orchestrator',
            payload: {
                providerId,
                resetAt,
                nextWindowStartsOnFirstRequest: true,
            },
        });

        this.save();
    }

    /** Safe current provider ID (always returns a valid string). */
    private currentProviderId(): string {
        const idx = this.state.currentProviderIndex % ROTATION_ORDER.length;
        return ROTATION_ORDER[idx] ?? ROTATION_ORDER[0]!;
    }

    /** Safe next provider ID (always returns a valid string). */
    private nextProviderId(): string {
        const idx = (this.state.currentProviderIndex + 1) % ROTATION_ORDER.length;
        return ROTATION_ORDER[idx % ROTATION_ORDER.length] ?? ROTATION_ORDER[0]!;
    }

    /** Get or initialise the internal state for a provider. */
    private providerState(providerId: string): ProviderInternalState {
        let intern = this.state.providers[providerId];
        if (!intern) {
            intern = {
                providerId,
                usedQuota: 0,
                currentBatchUsed: 0,
                firstRequestAt: null,
                consecutiveFailures: 0,
                lastFailureAt: null,
                lastError: null,
                totalRequests: 0,
                totalFailures: 0,
            };
            this.state.providers[providerId] = intern;
        }
        return intern;
    }

    // ── Persistence ──────────────────────────────────────────────────────

    private save(): void {
        try {
            const dir = join(process.cwd(), 'data');
            mkdirSync(dir, { recursive: true });
            const payload: PersistentState = {
                version: STATE_VERSION,
                savedAt: Date.now(),
                currentProviderIndex: this.state.currentProviderIndex,
                providers: this.state.providers,
            };
            writeFileSync(this.statePath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (err) {
            console.warn(
                '[quota-orchestrator] State persist failed:',
                err instanceof Error ? err.message : String(err),
            );
        }
    }

    private loadState(): PersistentState {
        try {
            const raw = readFileSync(this.statePath, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<PersistentState>;
            if (
                parsed.version === STATE_VERSION &&
                typeof parsed.currentProviderIndex === 'number' &&
                parsed.providers !== null &&
                typeof parsed.providers === 'object'
            ) {
                console.log('[quota-orchestrator] Restored state from', this.statePath);
                return {
                    version: STATE_VERSION,
                    savedAt: Date.now(),
                    currentProviderIndex: parsed.currentProviderIndex,
                    providers: parsed.providers,
                };
            }
            console.warn('[quota-orchestrator] State schema mismatch — starting fresh.');
        } catch {
            // File missing or corrupt — normal on first boot.
        }
        return this.freshState();
    }

    private freshState(): PersistentState {
        return {
            version: STATE_VERSION,
            savedAt: Date.now(),
            currentProviderIndex: 0,  // antigravity starts first
            providers: {},
        };
    }
}

// ── Singleton ────────────────────────────────────────────────────────────────

/** Authoritative provider scheduler. Import this in the router. */
export const quotaOrchestrator = new QuotaOrchestrator();
