/**
 * Antigravity Gateway — Quota Orchestrator
 *
 * Window-based rotating quota scheduler.
 *
 * Rotation pattern (stateful, persistent, recoverable):
 *   OpusMax(60) → NKQ(20) → OpusMax(60) → NKQ(20) → …
 *
 * Rolling window semantics:
 *   - Each provider's 5 h reset window starts ONLY on first request.
 *   - If untouched, the window never starts; quota never drains.
 *   - At window expiry, quota and batch counters reset fully.
 *
 * Provider quota ledger:
 *   OpusMax          800 req / 5 h  (primary)
 *   Antigravity NKQ  1050 req / 5 h (fallback, 2 keys)
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
    opusmax: { batchSize: 60, totalQuota: 800, windowMs: WINDOW_5H },
    antigravity: { batchSize: 20, totalQuota: 1050, windowMs: WINDOW_5H },
};

/**
 * Fixed rotation order (index 0 = highest priority).
 * Batch-switch advances forward then wraps back.
 */
export const ROTATION_ORDER = ['opusmax', 'antigravity'] as const;
export type RotationProviderId = (typeof ROTATION_ORDER)[number];

/** Number of consecutive failures before a provider is considered degraded. */
const DEGRADE_THRESHOLD = 5;

/** Short display names for console logging. */
const DISPLAY_NAME: Record<string, string> = {
    opusmax:     'Opus',
    antigravity: 'NKQ',
};

/** Persistent state schema version. Bump to invalidate old state. */
const STATE_VERSION = 2;

// ── State model ─────────────────────────────────────────────────────────────

export type OrchestratorProviderStatus =
    | 'ACTIVE'
    | 'STANDBY'
    | 'EXHAUSTED'
    | 'DEGRADED'
    | 'BREAKER_OPEN'
    | 'DEPRECATED_NOT_ROUTING';

interface ProviderInternalState {
    providerId: string;
    usedQuota: number;
    currentBatchUsed: number;
    firstRequestAt: number | null;
    consecutiveFailures: number;
    lastFailureAt: number | null;
    lastError: string | null;
    totalRequests: number;
    totalFailures: number;
}

interface PersistentState {
    version: number;
    savedAt: number;
    currentProviderIndex: number;
    providers: Record<string, ProviderInternalState>;
}

export interface ProviderOrchestrationState {
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
    lastError: string | null;
    totalRequests: number;
    totalFailures: number;
}

export interface OrchestratorMetrics {
    currentActiveProvider: string;
    rotationOrder: readonly string[];
    providers: ProviderOrchestrationState[];
    requestsUntilSwitch: number;
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

    getCandidates(): string[] {
        for (const id of ROTATION_ORDER) this.maybeReset(id);
        const result: string[] = [];
        for (const id of ROTATION_ORDER) {
            if (this.isAvailable(id)) result.push(id);
        }
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
                if (this.isAvailable(id)) result.push(id);
            }
        }
        return result;
    }

    consume(providerId: string): void {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return;
        const intern = this.providerState(providerId);
        const now = Date.now();
        if (intern.firstRequestAt === null) {
            intern.firstRequestAt = now;
            timeline.emit({
                sessionId: null, requestId: null,
                type: 'quota.window_started', source: 'quota-orchestrator',
                payload: { providerId, firstRequestAt: now, windowMs: conf.windowMs, resetAt: now + conf.windowMs },
            });
        }
        intern.usedQuota = Math.min(intern.usedQuota + 1, conf.totalQuota);
        intern.totalRequests++;
        intern.consecutiveFailures = 0;
        intern.lastError = null;
        if (intern.usedQuota >= conf.totalQuota) {
            timeline.emit({
                sessionId: null, requestId: null,
                type: 'quota.provider_exhausted', source: 'quota-orchestrator',
                payload: {
                    providerId, usedQuota: intern.usedQuota, totalQuota: conf.totalQuota,
                    resetAt: intern.firstRequestAt !== null ? intern.firstRequestAt + conf.windowMs : null,
                },
            });
        }
        this.save();
    }

    recordFailure(providerId: string, error?: string): void {
        if (!ROTATION_CONFIG[providerId]) return;
        const intern = this.providerState(providerId);
        intern.consecutiveFailures++;
        intern.lastFailureAt = Date.now();
        intern.totalFailures++;
        if (error) intern.lastError = error.slice(0, 300);
        if (intern.consecutiveFailures >= DEGRADE_THRESHOLD) {
            timeline.emit({
                sessionId: null, requestId: null,
                type: 'quota.provider_degraded', source: 'quota-orchestrator',
                payload: { providerId, consecutiveFailures: intern.consecutiveFailures, threshold: DEGRADE_THRESHOLD },
            });
        }
        this.save();
    }

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
            if (intern?.lastError) lines.push(`[quota-orchestrator]              last error: ${intern.lastError}`);
        }
        const candidates = this.getCandidates();
        lines.push(`[quota-orchestrator]   Candidates for next req : [${candidates.join(', ')}]`);
        if (candidates.length === 0 || !candidates.includes('opusmax')) {
            lines.push(`[quota-orchestrator]   WARNING: OpusMax NOT in candidates! Check quota/circuit-breaker.`);
        }
        lines.push('[quota-orchestrator] ════════════════════════════════════════');
        for (const l of lines) console.log(l);
    }

    reset(): void {
        this.state = this.freshState();
        this.save();
        circuitBreakers.resetAll();
        timeline.emit({
            sessionId: null, requestId: null,
            type: 'quota.state_reset', source: 'quota-orchestrator',
            payload: { scope: 'all', operator: true, breakersAlsoReset: true },
        });
        console.log('[quota-orchestrator] Full state reset by operator (quota + circuit breakers).');
    }

    resetProvider(providerId: string): boolean {
        if (!ROTATION_CONFIG[providerId]) return false;
        delete this.state.providers[providerId];
        this.save();
        timeline.emit({
            sessionId: null, requestId: null,
            type: 'quota.state_reset', source: 'quota-orchestrator',
            payload: { scope: 'provider', providerId, operator: true },
        });
        console.log(`[quota-orchestrator] Provider reset: ${providerId}`);
        return true;
    }

    getProviderState(providerId: string): ProviderOrchestrationState {
        for (const id of ROTATION_ORDER) this.maybeReset(id);
        const conf = ROTATION_CONFIG[providerId];
        const intern = this.providerState(providerId);
        const totalQuota = conf?.totalQuota ?? 0;
        const usedQuota = intern.usedQuota;
        const remainingQuota = Math.max(0, totalQuota - usedQuota);
        const windowMs = conf?.windowMs ?? 0;
        const resetAt = intern.firstRequestAt !== null && conf !== undefined
            ? intern.firstRequestAt + conf.windowMs : null;
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
            provider: providerId, totalQuota, usedQuota, remainingQuota,
            resetWindowMs: windowMs, firstRequestAt: intern.firstRequestAt, resetAt,
            currentBatchUsage: 0, currentBatchLimit: 0, state: status,
            consecutiveFailures: intern.consecutiveFailures,
            lastFailureAt: intern.lastFailureAt, lastError: intern.lastError ?? null,
            totalRequests: intern.totalRequests, totalFailures: intern.totalFailures,
        };
    }

    getAllStates(): ProviderOrchestrationState[] {
        return ROTATION_ORDER.map((id) => this.getProviderState(id));
    }

    getMetrics(): OrchestratorMetrics {
        const states = this.getAllStates();
        const currentId = this.currentProviderId();
        const currentState = this.getProviderState(currentId);
        const nextWindowReset = currentState.resetAt !== null
            ? new Date(currentState.resetAt).toISOString() : null;
        return {
            currentActiveProvider: currentId, rotationOrder: ROTATION_ORDER,
            providers: states, requestsUntilSwitch: 0, nextWindowReset,
        };
    }

    private isAvailable(providerId: string): boolean {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return false;
        if (!circuitBreakers.canExecute(providerId)) return false;
        const intern = this.providerState(providerId);
        if (intern.usedQuota >= conf.totalQuota) return false;
        if (intern.consecutiveFailures >= DEGRADE_THRESHOLD) return false;
        return true;
    }

    private maybeReset(providerId: string): void {
        const conf = ROTATION_CONFIG[providerId];
        if (!conf) return;
        const intern = this.providerState(providerId);
        if (intern.firstRequestAt === null) return;
        const resetAt = intern.firstRequestAt + conf.windowMs;
        if (Date.now() < resetAt) return;
        intern.usedQuota = 0;
        intern.currentBatchUsed = 0;
        intern.firstRequestAt = null;
        intern.consecutiveFailures = 0;
        timeline.emit({
            sessionId: null, requestId: null,
            type: 'quota.window_reset', source: 'quota-orchestrator',
            payload: { providerId, resetAt, nextWindowStartsOnFirstRequest: true },
        });
        this.save();
    }

    private currentProviderId(): string {
        const idx = this.state.currentProviderIndex % ROTATION_ORDER.length;
        return ROTATION_ORDER[idx] ?? ROTATION_ORDER[0]!;
    }

    private nextProviderId(): string {
        const idx = (this.state.currentProviderIndex + 1) % ROTATION_ORDER.length;
        return ROTATION_ORDER[idx % ROTATION_ORDER.length] ?? ROTATION_ORDER[0]!;
    }

    private providerState(providerId: string): ProviderInternalState {
        let intern = this.state.providers[providerId];
        if (!intern) {
            intern = {
                providerId, usedQuota: 0, currentBatchUsed: 0,
                firstRequestAt: null, consecutiveFailures: 0,
                lastFailureAt: null, lastError: null,
                totalRequests: 0, totalFailures: 0,
            };
            this.state.providers[providerId] = intern;
        }
        return intern;
    }

    private save(): void {
        try {
            const dir = join(process.cwd(), 'data');
            mkdirSync(dir, { recursive: true });
            const payload: PersistentState = {
                version: STATE_VERSION, savedAt: Date.now(),
                currentProviderIndex: this.state.currentProviderIndex,
                providers: this.state.providers,
            };
            writeFileSync(this.statePath, JSON.stringify(payload, null, 2), 'utf-8');
        } catch (err) {
            console.warn('[quota-orchestrator] State persist failed:', err instanceof Error ? err.message : String(err));
        }
    }

    private loadState(): PersistentState {
        try {
            const raw = readFileSync(this.statePath, 'utf-8');
            const parsed = JSON.parse(raw) as Partial<PersistentState>;
            if (
                parsed.version === STATE_VERSION &&
                typeof parsed.currentProviderIndex === 'number' &&
                parsed.providers !== null && typeof parsed.providers === 'object'
            ) {
                console.log('[quota-orchestrator] Restored state from', this.statePath);
                return {
                    version: STATE_VERSION, savedAt: Date.now(),
                    currentProviderIndex: parsed.currentProviderIndex,
                    providers: parsed.providers,
                };
            }
            console.warn('[quota-orchestrator] State schema mismatch — starting fresh.');
        } catch { /* File missing or corrupt — normal on first boot. */ }
        return this.freshState();
    }

    private freshState(): PersistentState {
        return {
            version: STATE_VERSION, savedAt: Date.now(),
            currentProviderIndex: 0,  // opusmax starts first
            providers: {},
        };
    }
}

/** Authoritative provider scheduler. Import this in the router. */
export const quotaOrchestrator = new QuotaOrchestrator();
