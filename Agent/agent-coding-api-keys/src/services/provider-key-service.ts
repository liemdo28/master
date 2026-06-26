/**
 * Antigravity Gateway — Provider Key Service
 *
 * Bridge between the database and the router.
 *
 * Responsibilities:
 *   1. Serve usable keys for a provider (DB-first, keys.json fallback)
 *   2. Hot-reload: DB changes are picked up without restart (poll every 10s)
 *   3. Phase 1 migration: if DB has no keys for a provider, fall back to keys.json
 *   4. Expiry checking: auto-expire keys where expires_at < now
 *   5. Runtime status updates: record success/failure per key
 *
 * Migration phases:
 *   Phase 1 (now):  DB first, fallback to keys.json
 *   Phase 2 (ops):  migrate keys.json → DB via dashboard
 *   Phase 3 (later): remove keys.json entirely
 */

import { keyDb } from '../db/key-database.js';
import type { GatewayConfig, ProviderKey } from '../types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RuntimeKey extends ProviderKey {
  /** DB row id. -1 for keys.json fallback keys. */
  dbId: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ProviderKeyService {
  /** In-memory cache: providerName → RuntimeKey[] */
  private cache = new Map<string, RuntimeKey[]>();
  private cacheBuiltAt = 0;
  private readonly CACHE_TTL = 10_000; // 10 seconds hot-reload window

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get usable keys for a provider.
   * Hot: reads from cache (refreshed every 10s from DB).
   * Falls back to config keys if DB has none.
   */
  getKeys(providerId: string, configKeys: ProviderKey[]): RuntimeKey[] {
    this.maybeRefresh();
    const dbKeys = this.cache.get(providerId) ?? [];

    if (dbKeys.length > 0) return dbKeys;

    // Phase 1 fallback: use keys.json config keys
    return configKeys.map((k) => ({ ...k, dbId: -1 }));
  }

  /** Record a successful request for a key. Updates DB if DB-managed key. */
  recordSuccess(key: RuntimeKey): void {
    if (key.dbId > 0) {
      keyDb.recordSuccess(key.dbId);
    }
    // Also invalidate cache so dashboard reflects updated stats quickly
    this.cacheBuiltAt = 0;
  }

  /** Record a failure for a key. Updates DB if DB-managed key. */
  recordFailure(key: RuntimeKey, errorType: string, message: string): void {
    if (key.dbId > 0) {
      keyDb.recordFailure(key.dbId, errorType, message);
    }
    this.cacheBuiltAt = 0;
  }

  /** Force a cache refresh (called after dashboard saves/edits a key). */
  invalidateCache(): void {
    this.cacheBuiltAt = 0;
  }

  /** Test a key value against its provider by making a lightweight request. */
  async testKey(providerId: string, apiKeyValue: string, baseURL: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      // Use /models endpoint as a lightweight health check
      const response = await fetch(`${baseURL.replace(/\/$/, '')}/models`, {
        headers: {
          'x-api-key': apiKeyValue,
          Authorization: `Bearer ${apiKeyValue}`,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(8000),
      });
      const latencyMs = Date.now() - start;
      if (response.ok) {
        return { ok: true, latencyMs };
      }
      const body = await response.text();
      return { ok: false, latencyMs, error: `HTTP ${response.status}: ${body.slice(0, 200)}` };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Startup ───────────────────────────────────────────────────────────────

  /**
   * Migrate existing keys.json keys into DB if they don't exist yet.
   * Safe to call multiple times — skips already-imported keys.
   */
  migrateFromConfig(config: GatewayConfig): void {
    let migrated = 0;
    for (const provider of config.providers) {
      if (!provider.enabled || provider.keys.length === 0) continue;

      const existingInDb = keyDb.getUsableKeys(provider.id);
      if (existingInDb.length > 0) continue; // already in DB

      for (const key of provider.keys) {
        if (!key.value || key.value.length < 4) continue;
        try {
          keyDb.createKey({
            provider_name: provider.id,
            key_name: key.label ?? key.id ?? 'Imported Key',
            api_key: key.value,
            enabled: true,
            weight: 1,
            priority: 10,
            created_by: 'migration',
          }, 'migration');
          migrated++;
          console.log(`[key-service] Migrated key "${key.id}" for ${provider.id}`);
        } catch (err) {
          console.warn(`[key-service] Migration skipped for ${provider.id}/${key.id}:`, err instanceof Error ? err.message : err);
        }
      }
    }
    if (migrated > 0) {
      console.log(`[key-service] Migrated ${migrated} key(s) from keys.json → database`);
      this.invalidateCache();
    }
  }

  /** Start background expiry checker (runs every 60s). */
  startExpiryChecker(): void {
    setInterval(() => {
      const expired = keyDb.expireStaleKeys();
      if (expired > 0) {
        console.log(`[key-service] Auto-expired ${expired} key(s)`);
        this.invalidateCache();
      }
    }, 60_000);
    // Also run once at startup
    keyDb.expireStaleKeys();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private maybeRefresh(): void {
    if (Date.now() - this.cacheBuiltAt < this.CACHE_TTL) return;
    this.rebuild();
  }

  private rebuild(): void {
    const providers = keyDb.getProviderSummary().map((r) => r.provider_name);
    // Also collect providers that have keys in DB regardless of summary
    const allProviderRows = keyDb.getAll();
    const uniqueProviders = [...new Set([...providers, ...allProviderRows.map((r) => r.provider_name)])];

    for (const providerId of uniqueProviders) {
      const dbKeys = keyDb.getUsableKeys(providerId);
      const runtimeKeys: RuntimeKey[] = dbKeys.map((k) => ({
        id: k.keyId,
        value: k.value,
        active: false,
        dbId: k.id,
      }));
      this.cache.set(providerId, runtimeKeys);
    }

    this.cacheBuiltAt = Date.now();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const providerKeyService = new ProviderKeyService();
