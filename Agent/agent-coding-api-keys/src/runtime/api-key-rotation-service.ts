/**
 * Antigravity Gateway — API Key Rotation Service
 *
 * Manages per-key health state and round-robin selection within a provider.
 *
 * Key lifecycle:
 *   healthy       → accepting requests
 *   cooldown      → temporary back-off (rate_limited / timeout / provider_down)
 *   auth_failed   → permanently disabled until operator re-enables
 *   quota_exhausted → long cooldown (5 hours)
 *   disabled      → manually disabled by operator
 *
 * Cooldown durations:
 *   rate_limited     → 60 s
 *   timeout          → 30 s
 *   provider_down    → 30 s
 *   quota_exhausted  → 5 h
 *   auth_failed      → ∞ (manual reset only)
 *   model_locked/model_not_allowed → 0 (fallback only, key stays healthy)
 *   unknown          → 15 s
 *
 * State is in-memory only. Resets on gateway restart.
 * Round-robin cursor per provider advances only on successful consumption.
 */

import type { ProviderKey } from '../types.js';
import type { UpstreamErrorType } from './upstream-error-classifier.js';

// ── Types ────────────────────────────────────────────────────────────────────

export type KeyStatus =
  | 'healthy'
  | 'cooldown'
  | 'rate_limited'
  | 'quota_exhausted'
  | 'auth_failed'
  | 'timeout'
  | 'disabled';

export interface KeyHealthEntry {
  keyId: string;
  providerId: string;
  status: KeyStatus;
  /** Unix-ms after which the key becomes healthy again. null = no cooldown. */
  cooldownUntil: number | null;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastErrorType: UpstreamErrorType | null;
  lastErrorMessage: string | null;
}

// ── Cooldown durations (ms) ──────────────────────────────────────────────────

const COOLDOWNS: Record<UpstreamErrorType, number> = {
  rate_limited:    60_000,        // 60 s
  timeout:         30_000,        // 30 s
  provider_down:   30_000,        // 30 s
  quota_exceeded:  5 * 3600_000,  // 5 h
  auth_failed:     Infinity,      // permanent
  invalid_model:   0,             // no cooldown — model issue, not key issue
  model_locked:     0,             // no cooldown — locked tier/model, not key auth
  model_not_allowed: 0,            // no cooldown — model compatibility, not key health
  prompt_too_large: 0,              // no cooldown — client payload too large
  request_schema_error: 0,         // no cooldown — client payload issue
  sse_tool_unsupported: 0,         // no cooldown — provider capability mismatch
  unknown:         15_000,        // 15 s
};

// ── Implementation ───────────────────────────────────────────────────────────

export class ApiKeyRotationService {
  /** health[`${providerId}:${keyId}`] = KeyHealthEntry */
  private readonly health = new Map<string, KeyHealthEntry>();

  /** Round-robin cursor per provider. Advances after each successful request. */
  private readonly cursors = new Map<string, number>();

  // ── Key selection ──────────────────────────────────────────────────────

  /**
   * Return ordered list of healthy keys for a provider, starting from the
   * current round-robin cursor position. Skips disabled / cooldown keys.
   *
   * Returns empty array if no healthy keys available.
   */
  getOrderedKeys(providerId: string, providerKeys: ProviderKey[]): ProviderKey[] {
    const eligible = providerKeys.filter((k) => this.isKeyUsable(providerId, k));
    if (eligible.length === 0) return [];

    const cursor = (this.cursors.get(providerId) ?? 0) % eligible.length;
    // Rotate: start at cursor, wrap around
    return [...eligible.slice(cursor), ...eligible.slice(0, cursor)];
  }

  /**
   * Return all keys with their health state (for dashboard / API).
   * Includes unhealthy keys for visibility.
   */
  getProviderKeyHealth(providerId: string, providerKeys: ProviderKey[]): KeyHealthEntry[] {
    return providerKeys.map((k) => this.getOrInit(providerId, k.id));
  }

  /** All key health entries across all providers. */
  getAllKeyHealth(): KeyHealthEntry[] {
    return [...this.health.values()];
  }

  // ── Event recording ───────────────────────────────────────────────────

  /** Call after a successful request. Advances the round-robin cursor. */
  markSuccess(providerId: string, keyId: string): void {
    const entry = this.getOrInit(providerId, keyId);
    entry.status = 'healthy';
    entry.cooldownUntil = null;
    entry.consecutiveFailures = 0;
    entry.totalRequests++;
    entry.lastSuccessAt = Date.now();
    entry.lastErrorType = null;
    entry.lastErrorMessage = null;
    this.advanceCursor(providerId);
  }

  /**
   * Call after a failed request. Sets cooldown based on error type.
   * Returns the new key status for logging.
   */
  markFailure(
    providerId: string,
    keyId: string,
    errorType: UpstreamErrorType,
    message: string,
  ): KeyStatus {
    const entry = this.getOrInit(providerId, keyId);
    entry.consecutiveFailures++;
    entry.totalRequests++;
    entry.totalFailures++;
    entry.lastFailureAt = Date.now();
    entry.lastErrorType = errorType;
    entry.lastErrorMessage = message.slice(0, 200);

    const cooldownMs = COOLDOWNS[errorType] ?? 15_000;

    if (errorType === 'auth_failed') {
      entry.status = 'auth_failed';
      entry.cooldownUntil = null; // permanent
    } else if (cooldownMs === Infinity) {
      entry.status = 'disabled';
      entry.cooldownUntil = null;
    } else if (cooldownMs > 0) {
      entry.status = errorType === 'rate_limited'    ? 'rate_limited'
                   : errorType === 'quota_exceeded'  ? 'quota_exhausted'
                   : errorType === 'timeout'         ? 'timeout'
                   : 'cooldown';
      entry.cooldownUntil = Date.now() + cooldownMs;
    }
    // invalid_model / unknown with cooldownMs=0 → stays healthy, key not the problem

    return entry.status;
  }

  // ── Operator controls ─────────────────────────────────────────────────

  disableKey(providerId: string, keyId: string): void {
    const entry = this.getOrInit(providerId, keyId);
    entry.status = 'disabled';
    entry.cooldownUntil = null;
    console.log(`[key-rotation] Operator disabled key ${keyId} on ${providerId}`);
  }

  enableKey(providerId: string, keyId: string): void {
    const entry = this.getOrInit(providerId, keyId);
    entry.status = 'healthy';
    entry.cooldownUntil = null;
    entry.consecutiveFailures = 0;
    console.log(`[key-rotation] Operator enabled key ${keyId} on ${providerId}`);
  }

  resetCooldown(providerId: string, keyId: string): void {
    const entry = this.getOrInit(providerId, keyId);
    entry.status = 'healthy';
    entry.cooldownUntil = null;
    entry.consecutiveFailures = 0;
    console.log(`[key-rotation] Operator cleared cooldown for key ${keyId} on ${providerId}`);
  }

  resetAllKeys(providerId: string): void {
    for (const [hkey, entry] of this.health) {
      if (entry.providerId === providerId) {
        entry.status = 'healthy';
        entry.cooldownUntil = null;
        entry.consecutiveFailures = 0;
      }
    }
    this.cursors.delete(providerId);
    console.log(`[key-rotation] Reset all keys for provider ${providerId}`);
  }

  // ── Status helpers ────────────────────────────────────────────────────

  /** True if the key can accept a new request right now. */
  isKeyUsable(providerId: string, key: ProviderKey): boolean {
    // Config-level disable
    if (key.disabledUntil && key.disabledUntil > Date.now()) return false;

    const entry = this.health.get(`${providerId}:${key.id}`);
    if (!entry) return true; // never seen → healthy

    // Permanent disable
    if (entry.status === 'auth_failed' || entry.status === 'disabled') return false;

    // Cooldown expired → auto-recover
    if (entry.cooldownUntil !== null && Date.now() >= entry.cooldownUntil) {
      entry.status = 'healthy';
      entry.cooldownUntil = null;
      entry.consecutiveFailures = 0;
    }

    return entry.status === 'healthy';
  }

  getKeyStatus(providerId: string, keyId: string): KeyStatus {
    const entry = this.health.get(`${providerId}:${keyId}`);
    if (!entry) return 'healthy';
    // Auto-recover expired cooldowns
    if (entry.cooldownUntil !== null && Date.now() >= entry.cooldownUntil) {
      entry.status = 'healthy';
      entry.cooldownUntil = null;
    }
    return entry.status;
  }

  // ── Private ───────────────────────────────────────────────────────────

  private getOrInit(providerId: string, keyId: string): KeyHealthEntry {
    const hkey = `${providerId}:${keyId}`;
    let entry = this.health.get(hkey);
    if (!entry) {
      entry = {
        keyId,
        providerId,
        status: 'healthy',
        cooldownUntil: null,
        consecutiveFailures: 0,
        totalRequests: 0,
        totalFailures: 0,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastErrorType: null,
        lastErrorMessage: null,
      };
      this.health.set(hkey, entry);
    }
    return entry;
  }

  private advanceCursor(providerId: string): void {
    const cur = this.cursors.get(providerId) ?? 0;
    this.cursors.set(providerId, cur + 1);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const apiKeyRotationService = new ApiKeyRotationService();
