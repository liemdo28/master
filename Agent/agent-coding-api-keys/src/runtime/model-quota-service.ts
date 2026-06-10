/**
 * Per-key, per-model quota ledger.
 *
 * Provider-level quota is too coarse for NKQ keys because the same key can have
 * separate limits for Opus 4.6 and 4.7. This ledger lets the router skip only
 * the exhausted key+model pair while keeping the key usable for other models.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProviderKey } from '../types.js';
import type { UpstreamErrorType } from './upstream-error-classifier.js';

interface ModelQuotaEntry {
  providerId: string;
  keyId: string;
  model: string;
  used: number;
  limit: number | null;
  exhausted: boolean;
  firstUsedAt: number | null;
  updatedAt: number;
  lastError: string | null;
}

interface PersistentState {
  version: number;
  savedAt: number;
  entries: Record<string, ModelQuotaEntry>;
}

export interface ModelQuotaSnapshot extends ModelQuotaEntry {
  remaining: number | null;
  resetAt: number | null;
}

export interface SourceCandidate {
  providerId: string;
  key: ProviderKey;
  model: string;
  sourceId: string;
  sourceLabel: string;
  priority: number;
}

export type SupplySourceStatus = 'healthy' | 'cooldown' | 'disabled' | 'exhausted';

export interface SupplySourceSnapshot {
  id: string;
  provider: string;
  keyId: string;
  keyLabel: string;
  maskedKey: string;
  model: string;
  priority: number;
  status: SupplySourceStatus;
  cooldownUntil?: number | undefined;
  cooldownRemainingMs: number;
  lastError?: string | undefined;
  lastErrorType?: UpstreamErrorType | undefined;
  lastSuccessAt?: number | undefined;
  lastFailureAt?: number | undefined;
  attempts: number;
  failures: number;
  quota?: ModelQuotaSnapshot | undefined;
}

interface SourceHealthEntry {
  id: string;
  status: SupplySourceStatus;
  cooldownUntil: number | null;
  disabled: boolean;
  lastError: string | null;
  lastErrorType: UpstreamErrorType | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  attempts: number;
  failures: number;
}

const STATE_VERSION = 1;
const WINDOW_5H = 5 * 60 * 60 * 1_000;
const SOURCE_WINDOW_MS = 5 * 60 * 1_000;
// After quota exhaustion, retry-probe the source every EXHAUSTED_PROBE_INTERVAL_MS.
// Start probing EARLY_RESET_PROBE_MS before expected window reset (= 4h means probe starts 1h into window).
const EARLY_RESET_PROBE_MS = 4 * 60 * 60 * 1_000;    // start probing 1h after firstUsedAt
const EXHAUSTED_PROBE_INTERVAL_MS = 5 * 60 * 1_000;   // probe every 5 min
// Source health cooldown for quota_exceeded: 1h retry window (not full 5h).
// The probe will re-exhaust if NKQ is still capped, or recover if NKQ has reset.
const QUOTA_RETRY_COOLDOWN_MS = 60 * 60 * 1_000;

const NKQ_NEW_KEY_PREFIX = 'AGOP-7B43-';
const NKQ_LEGACY_KEY_PREFIX = 'AGOP-6094-';

const SOURCE_ORDER = [
  'nkq-key2-opus-4-7',      // db-15 (AGOP-7B43) — primary active NKQ key
  'nkq-key2-opus-4-6',      // db-15 (AGOP-7B43) — primary active NKQ key
  'nkq-key1-opus-4-7',      // db-1  (AGOP-6094) — disabled / future
  'nkq-key1-opus-4-6',      // db-1  (AGOP-6094) — disabled / future
  'opusmax-db18-opus-4-6',  // db-18 opusmax key 1
  'opusmax-db18-opus-4-7',  // db-18 opusmax key 1
  'opusmax-db18-opus-4-8',  // db-18 opusmax key 1
  'opusmax-db19-opus-4-6',  // db-19 opusmax key 2 — fallback when db-18 exhausted
  'opusmax-db19-opus-4-7',  // db-19 opusmax key 2
  'opusmax-db19-opus-4-8',  // db-19 opusmax key 2
];

const SOURCE_COOLDOWNS: Partial<Record<UpstreamErrorType, number>> = {
  rate_limited: 60_000,
  provider_down: 30_000,
  timeout: 30_000,
  quota_exceeded: WINDOW_5H,
  auth_failed: Number.POSITIVE_INFINITY,
};

const OPUSMAX_PROVIDER_DOWN_COOLDOWN_MS = 0;

const MODEL_ALIASES: Record<string, string> = {
  'claude-opus-4.6': 'claude-opus-4-6',
  'claude-opus-4.6-thinking': 'claude-opus-4-6',
  'claude-opus-4-6-thinking': 'claude-opus-4-6',
  'claude-opus-4.7': 'claude-opus-4-7',
  'claude-opus-4.7-thinking': 'claude-opus-4-7',
  'claude-opus-4-7-thinking': 'claude-opus-4-7',
  'claude-opus-4.8': 'claude-opus-4-8',
  'claude-opus-4.8-thinking': 'claude-opus-4-8',
  'claude-opus-4-8-thinking': 'claude-opus-4-8',
};

class ModelQuotaService {
  private readonly statePath = join(process.cwd(), 'data', 'model-quota-state.json');
  private state: PersistentState = this.load();
  private readonly sourceHealth = new Map<string, SourceHealthEntry>();

  canUse(providerId: string, key: ProviderKey, model: string): boolean {
    const limit = this.resolveLimit(providerId, key, model);
    if (limit === null) return true;

    const entry = this.entry(providerId, key.id, this.normalizeModel(model), limit);
    this.maybeReset(entry);
    if (!entry.exhausted && entry.used < limit) return true;
    return this.shouldProbeExhaustedSource(entry);
  }

  canUseSource(candidate: SourceCandidate): boolean {
    if (!this.isSourceHealthUsable(candidate.sourceId)) return false;
    return this.canUse(candidate.providerId, candidate.key, candidate.model);
  }

  hasTrackedLimit(providerId: string, key: ProviderKey, model: string): boolean {
    return this.resolveLimit(providerId, key, model) !== null;
  }

  getSourceCandidates(
    providerId: string,
    keys: ProviderKey[],
    requestedModel: string,
    defaultResolvedModel: string,
  ): SourceCandidate[] {
    const candidates: SourceCandidate[] = [];

    for (const key of keys) {
      for (const model of this.getCandidateModels(providerId, key, requestedModel, defaultResolvedModel)) {
        candidates.push({
          providerId,
          key,
          model,
          sourceId: this.getSourceId(providerId, key, model),
          sourceLabel: this.getSourceLabel(providerId, key, model),
          priority: this.getSourcePriority(providerId, key, model),
        });
      }
    }

    return this.sortBySourceWindow(candidates);
  }

  getCurrentSourceWindow(sourceIds: string[] = SOURCE_ORDER): {
    windowId: number;
    windowLabel: string;
    activeSource: string;
    sourceOrder: string[];
    windowStartMs: number;
    windowEndMs: number;
    remainingMs: number;
  } {
    const orderedSources = this.orderedSourceIds(sourceIds);
    const now = Date.now();
    const windowId = Math.floor(now / SOURCE_WINDOW_MS);
    const windowStartMs = Math.floor(now / SOURCE_WINDOW_MS) * SOURCE_WINDOW_MS;
    const windowEndMs = windowStartMs + SOURCE_WINDOW_MS;
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (ms: number) => {
      const d = new Date(ms);
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return {
      windowId,
      windowLabel: `${fmt(windowStartMs)} - ${fmt(windowEndMs - 60_000)}`,
      activeSource: orderedSources[0]!,
      sourceOrder: orderedSources,
      windowStartMs,
      windowEndMs,
      remainingMs: Math.max(0, windowEndMs - now),
    };
  }

  recordSuccess(providerId: string, key: ProviderKey, model: string): void {
    const sourceId = this.getSourceId(providerId, key, model);
    const source = this.getOrInitSource(sourceId);
    source.status = 'healthy';
    source.cooldownUntil = null;
    source.lastSuccessAt = Date.now();
    source.lastError = null;
    source.lastErrorType = null;
    source.attempts++;

    const limit = this.resolveLimit(providerId, key, model);
    if (limit === null) return;

    const entry = this.entry(providerId, key.id, this.normalizeModel(model), limit);
    this.maybeReset(entry);
    if (entry.exhausted || entry.used >= limit) {
      this.resetEntry(entry);
    }
    if (entry.firstUsedAt === null) entry.firstUsedAt = Date.now();
    entry.used = Math.min(entry.used + 1, limit);
    entry.exhausted = entry.used >= limit;
    entry.updatedAt = Date.now();
    entry.lastError = null;
    this.save();
  }

  markExhausted(providerId: string, key: ProviderKey, model: string, reason: string): void {
    const limit = this.resolveLimit(providerId, key, model);
    if (limit === null) return;

    const entry = this.entry(providerId, key.id, this.normalizeModel(model), limit);
    if (entry.firstUsedAt === null) entry.firstUsedAt = Date.now();
    entry.used = limit;
    entry.exhausted = true;
    entry.updatedAt = Date.now();
    entry.lastError = reason.slice(0, 200);
    this.save();
  }

  markSourceFailure(candidate: SourceCandidate, errorType: UpstreamErrorType, reason: string): void {
    const source = this.getOrInitSource(candidate.sourceId);
    source.attempts++;
    source.failures++;
    source.lastFailureAt = Date.now();
    source.lastErrorType = errorType;
    source.lastError = reason.slice(0, 200);

    if (errorType === 'auth_failed') {
      source.status = 'disabled';
      source.disabled = true;
      source.cooldownUntil = null;
      return;
    }

    if (errorType === 'quota_exceeded') {
      source.status = 'exhausted';
      // Use a 1h retry window instead of the full 5h quota window.
      // After 1h, isSourceHealthUsable clears the block and the next request
      // probes NKQ. If NKQ has reset → recovery. If still capped → re-exhaust + another 1h.
      source.cooldownUntil = Date.now() + QUOTA_RETRY_COOLDOWN_MS;
      return;
    }

    const cooldownMs = this.getSourceCooldownMs(candidate, errorType);
    if (cooldownMs > 0) {
      source.status = 'cooldown';
      source.cooldownUntil = Date.now() + cooldownMs;
    } else {
      source.status = 'healthy';
      source.cooldownUntil = null;
    }
  }

  setSourceEnabled(sourceId: string, enabled: boolean): boolean {
    const source = this.getOrInitSource(sourceId);
    source.disabled = !enabled;
    source.status = enabled ? 'healthy' : 'disabled';
    source.cooldownUntil = null;
    if (enabled) {
      source.failures = 0;
      source.lastError = null;
      source.lastErrorType = null;
    }
    return true;
  }

  resetSource(sourceId: string): void {
    const source = this.getOrInitSource(sourceId);
    source.status = 'healthy';
    source.cooldownUntil = null;
    source.disabled = false;
    source.lastError = null;
    source.lastErrorType = null;
    source.failures = 0;
  }

  /**
   * Reset a specific key+model quota entry (e.g. after NKQ resets their 5h window).
   * Returns true if entry was found and reset, false if not found.
   */
  resetModelQuotaEntry(providerId: string, keyId: string, model: string): boolean {
    const normalized = this.normalizeModel(model);
    const entryKey = `${providerId}:${keyId}:${normalized}`;
    const entry = this.state.entries[entryKey];
    if (!entry) return false;
    entry.used = 0;
    entry.exhausted = false;
    entry.firstUsedAt = null;
    entry.lastError = null;
    entry.updatedAt = Date.now();
    this.save();
    return true;
  }

  /**
   * Reset ALL quota entries for a given provider (e.g. full NKQ reset).
   */
  resetAllModelQuotaForProvider(providerId: string): number {
    let count = 0;
    for (const entry of Object.values(this.state.entries)) {
      if (entry.providerId === providerId) {
        entry.used = 0;
        entry.exhausted = false;
        entry.firstUsedAt = null;
        entry.lastError = null;
        entry.updatedAt = Date.now();
        count++;
      }
    }
    if (count > 0) this.save();
    return count;
  }

  private getSourceCooldownMs(candidate: SourceCandidate, errorType: UpstreamErrorType): number {
    if (candidate.providerId === 'opusmax' && (errorType === 'provider_down' || errorType === 'timeout')) {
      return OPUSMAX_PROVIDER_DOWN_COOLDOWN_MS;
    }
    return SOURCE_COOLDOWNS[errorType] ?? 0;
  }

  getSupplySources(
    providerEntries: Array<{ providerId: string; keys: ProviderKey[]; requestedModel: string; defaultResolvedModel: string }>,
  ): SupplySourceSnapshot[] {
    const candidates = providerEntries.flatMap((entry) =>
      this.getSourceCandidates(entry.providerId, entry.keys, entry.requestedModel, entry.defaultResolvedModel),
    );
    const unique = new Map<string, SourceCandidate>();
    for (const candidate of candidates) {
      if (!unique.has(candidate.sourceId)) unique.set(candidate.sourceId, candidate);
    }
    return [...unique.values()]
      .sort((a, b) => a.priority - b.priority)
      .map((candidate) => this.toSupplySnapshot(candidate));
  }

  getSnapshot(providerId?: string): ModelQuotaSnapshot[] {
    return Object.values(this.state.entries)
      .filter((entry) => !providerId || entry.providerId === providerId)
      .map((entry) => {
        this.maybeReset(entry);
        return {
          ...entry,
          remaining: entry.limit === null ? null : Math.max(0, entry.limit - entry.used),
          resetAt: entry.firstUsedAt === null ? null : entry.firstUsedAt + WINDOW_5H,
        };
      });
  }

  getKeyModelSnapshot(providerId: string, key: ProviderKey, model: string): ModelQuotaSnapshot | null {
    const limit = this.resolveLimit(providerId, key, model);
    if (limit === null) return null;
    const entry = this.entry(providerId, key.id, this.normalizeModel(model), limit);
    this.maybeReset(entry);
    return {
      ...entry,
      remaining: Math.max(0, limit - entry.used),
      resetAt: entry.firstUsedAt === null ? null : entry.firstUsedAt + WINDOW_5H,
    };
  }

  private resolveLimit(providerId: string, key: ProviderKey, model: string): number | null {
    if (providerId !== 'antigravity') return null;

    if (this.isNkqKey1(key)) {
      switch (this.normalizeModel(model)) {
        case 'claude-opus-4-7':
          return 500;
        case 'claude-opus-4-6':
          return 250;
        default:
          return null;
      }
    }

    if (!this.isNkqKey2(key)) return null;

    switch (this.normalizeModel(model)) {
      case 'claude-opus-4-6':
        return 300;
      case 'claude-opus-4-7':
      case 'claude-opus-4-8':
        return 500;
      default:
        return null;
    }
  }

  private isNewNkqKey(key: ProviderKey): boolean {
    return key.id === 'db-15' || key.id === 'key-2' || key.value.startsWith(NKQ_NEW_KEY_PREFIX);
  }

  private isLegacyNkqKey(key: ProviderKey): boolean {
    return key.id === 'db-1' || key.id === 'key-1' || key.value.startsWith(NKQ_LEGACY_KEY_PREFIX);
  }

  private isNkqKey1(key: ProviderKey): boolean {
    return this.isLegacyNkqKey(key);
  }

  private isNkqKey2(key: ProviderKey): boolean {
    return this.isNewNkqKey(key);
  }

  private getCandidateModels(providerId: string, key: ProviderKey, requestedModel: string, defaultResolvedModel: string): string[] {
    const requested = this.normalizeModel(requestedModel);
    const isOpusRequest = requested === 'claude-opus-4-6' || requested === 'claude-opus-4-7' || requested === 'claude-opus-4-8';

    if (providerId === 'opusmax' && isOpusRequest) {
      if (/-thinking$/i.test(defaultResolvedModel)) {
        return this.uniqueModels([
          defaultResolvedModel,
          this.getOpusMaxRawFallback(defaultResolvedModel),
          this.getOpusMaxStandardFallback(defaultResolvedModel),
          'claude-opus-4-7',
          'claude-opus-4-7-standard',
          'claude-opus-4-8',
          'auto',
        ]);
      }
      return this.uniqueModels([
        defaultResolvedModel,
        this.getOpusMaxStandardFallback(defaultResolvedModel),
        this.getOpusMaxRawFallback(defaultResolvedModel),
        'claude-opus-4-7',
        'claude-opus-4-7-standard',
        'claude-opus-4-8',
        'auto',
      ]);
    }

    if (providerId !== 'antigravity') return [defaultResolvedModel];

    if (!isOpusRequest) return [defaultResolvedModel];
    if (this.isNkqKey1(key)) {
      if (requested === 'claude-opus-4-6') return ['claude-opus-4-6', 'claude-opus-4-7'];
      return ['claude-opus-4-7', 'claude-opus-4-6'];
    }
    if (!this.isNkqKey2(key)) return [defaultResolvedModel];

    if (requested === 'claude-opus-4-6') return ['claude-opus-4-6', 'claude-opus-4-7'];
    return ['claude-opus-4-7', 'claude-opus-4-6'];
  }

  private getSourceId(providerId: string, key: ProviderKey, model: string): string {
    const normalized = this.normalizeModel(model);
    if (providerId === 'antigravity' && this.isNkqKey1(key)) {
      if (normalized === 'claude-opus-4-7' || normalized === 'claude-opus-4-8') return 'nkq-key1-opus-4-7';
      if (normalized === 'claude-opus-4-6') return 'nkq-key1-opus-4-6';
    }
    if (providerId === 'antigravity' && this.isNkqKey2(key)) {
      if (normalized === 'claude-opus-4-6') return 'nkq-key2-opus-4-6';
      if (normalized === 'claude-opus-4-7' || normalized === 'claude-opus-4-8') return 'nkq-key2-opus-4-7';
    }
    if (providerId === 'opusmax') {
      // Per-key source IDs so each opusmax key has independent health tracking.
      // When db-18 is exhausted, db-19 sources remain usable.
      const keySlug = key.id.replace('db-', 'db');  // "db-18" → "db18"
      if (normalized.includes('4-7')) return `opusmax-${keySlug}-opus-4-7`;
      if (normalized.includes('4-8')) return `opusmax-${keySlug}-opus-4-8`;
      return `opusmax-${keySlug}-opus-4-6`;
    }
    return `${providerId}:${key.id}:standard`;
  }

  private getOpusMaxStandardFallback(model: string): string {
    const normalized = model.replace(/\./g, '-').replace(/-thinking$/i, '');
    if (normalized === 'claude-opus-4-6') return 'claude-opus-4-6-standard';
    if (normalized === 'claude-opus-4-8') return 'claude-opus-4-8-standard';
    return 'claude-opus-4-7-standard';
  }

  private getOpusMaxRawFallback(model: string): string {
    const normalized = model.replace(/\./g, '-').replace(/-thinking$/i, '').replace(/-standard$/i, '');
    if (normalized === 'claude-opus-4-6') return 'claude-opus-4-6';
    if (normalized === 'claude-opus-4-8') return 'claude-opus-4-8';
    return 'claude-opus-4-7';
  }

  private uniqueModels(models: string[]): string[] {
    return [...new Set(models)];
  }

  private getSourceLabel(providerId: string, key: ProviderKey, model: string): string {
    const sourceId = this.getSourceId(providerId, key, model);
    switch (sourceId) {
      case 'nkq-key1-opus-4-7':
        return 'NKQ key1 Opus 4.7';
      case 'nkq-key1-opus-4-6':
        return 'NKQ key1 Opus 4.6';
      case 'nkq-key2-opus-4-7':
        return 'NKQ key2 Opus 4.7';
      case 'nkq-key2-opus-4-6':
        return 'NKQ key2 Opus 4.6';
      case 'opusmax-db18-opus-4-6':
      case 'opusmax-db18-opus-4-7':
      case 'opusmax-db18-opus-4-8':
        return 'OpusMax key1 (db-18)';
      case 'opusmax-db19-opus-4-6':
      case 'opusmax-db19-opus-4-7':
      case 'opusmax-db19-opus-4-8':
        return 'OpusMax key2 (db-19)';
      default:
        return `${providerId} ${key.id} ${model}`;
    }
  }

  private getSourcePriority(providerId: string, key: ProviderKey, model: string): number {
    const id = this.getSourceId(providerId, key, model);
    const idx = SOURCE_ORDER.indexOf(id);
    return idx >= 0 ? idx + 1 : 100;
  }

  private sortBySourceWindow(candidates: SourceCandidate[]): SourceCandidate[] {
    const sourceIds = [...new Set(candidates.map((candidate) => candidate.sourceId))];
    const sourceWindow = this.getCurrentSourceWindow(sourceIds);
    const ordered = sourceWindow.sourceOrder;
    return [...candidates].sort((a, b) => ordered.indexOf(a.sourceId) - ordered.indexOf(b.sourceId));
  }

  private orderedSourceIds(sourceIds: string[]): string[] {
    const present = sourceIds.length > 0 ? [...new Set(sourceIds)] : SOURCE_ORDER;
    const fullOrder = [...SOURCE_ORDER, ...present.filter((sourceId) => !SOURCE_ORDER.includes(sourceId)).sort()];

    const now = Date.now();
    const windowId = Math.floor(now / SOURCE_WINDOW_MS);
    const activeIndex = windowId % fullOrder.length;
    const rotatedFullOrder = [...fullOrder.slice(activeIndex), ...fullOrder.slice(0, activeIndex)];
    const ordered = rotatedFullOrder.filter((sourceId) => present.includes(sourceId));
    return ordered.length > 0 ? ordered : ['unknown'];
  }

  private isSourceHealthUsable(sourceId: string): boolean {
    const entry = this.sourceHealth.get(sourceId);
    if (!entry) return true;
    if (entry.disabled || entry.status === 'disabled') return false;
    if (entry.cooldownUntil !== null && Date.now() >= entry.cooldownUntil) {
      entry.status = 'healthy';
      entry.cooldownUntil = null;
      entry.lastError = null;
      entry.lastErrorType = null;
    }
    return entry.status === 'healthy';
  }

  private getOrInitSource(sourceId: string): SourceHealthEntry {
    let entry = this.sourceHealth.get(sourceId);
    if (!entry) {
      entry = {
        id: sourceId,
        status: 'healthy',
        cooldownUntil: null,
        disabled: false,
        lastError: null,
        lastErrorType: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        attempts: 0,
        failures: 0,
      };
      this.sourceHealth.set(sourceId, entry);
    }
    return entry;
  }

  private toSupplySnapshot(candidate: SourceCandidate): SupplySourceSnapshot {
    const health = this.getOrInitSource(candidate.sourceId);
    this.isSourceHealthUsable(candidate.sourceId);
    const quota = this.getKeyModelSnapshot(candidate.providerId, candidate.key, candidate.model) ?? undefined;
    const exhausted = quota?.exhausted === true && !this.canUse(candidate.providerId, candidate.key, candidate.model);
    const status = exhausted ? 'exhausted' : health.status;
    return {
      id: candidate.sourceId,
      provider: candidate.providerId,
      keyId: candidate.key.id,
      keyLabel: candidate.key.label ?? candidate.key.id,
      maskedKey: this.maskKey(candidate.key.value),
      model: candidate.model,
      priority: candidate.priority,
      status,
      cooldownUntil: health.cooldownUntil ?? undefined,
      cooldownRemainingMs: health.cooldownUntil ? Math.max(0, health.cooldownUntil - Date.now()) : 0,
      lastError: health.lastError ?? quota?.lastError ?? undefined,
      lastErrorType: health.lastErrorType ?? undefined,
      lastSuccessAt: health.lastSuccessAt ?? undefined,
      lastFailureAt: health.lastFailureAt ?? undefined,
      attempts: health.attempts,
      failures: health.failures,
      quota,
    };
  }

  private getResetAt(providerId: string, key: ProviderKey, model: string): number | null {
    return this.getKeyModelSnapshot(providerId, key, model)?.resetAt ?? null;
  }

  private maskKey(value: string): string {
    if (!value) return '';
    if (value.length <= 10) return value.slice(0, 2) + '…';
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  }

  private normalizeModel(model: string): string {
    return MODEL_ALIASES[model] ?? model;
  }

  private stateKey(providerId: string, keyId: string, model: string): string {
    return `${providerId}:${keyId}:${model}`;
  }

  private entry(providerId: string, keyId: string, model: string, limit: number): ModelQuotaEntry {
    const id = this.stateKey(providerId, keyId, model);
    let entry = this.state.entries[id];
    if (!entry) {
      entry = {
        providerId,
        keyId,
        model,
        used: 0,
        limit,
        exhausted: false,
        firstUsedAt: null,
        updatedAt: Date.now(),
        lastError: null,
      };
      this.state.entries[id] = entry;
      this.save();
    } else {
      entry.limit = limit;
    }
    return entry;
  }

  private maybeReset(entry: ModelQuotaEntry): void {
    if (entry.firstUsedAt === null) return;
    if (Date.now() < entry.firstUsedAt + WINDOW_5H) return;

    this.resetEntry(entry);
    this.save();
  }

  private shouldProbeExhaustedSource(entry: ModelQuotaEntry): boolean {
    if (!entry.exhausted || entry.firstUsedAt === null) return false;
    const now = Date.now();
    const resetAt = entry.firstUsedAt + WINDOW_5H;
    const isNearReset = now >= resetAt - EARLY_RESET_PROBE_MS;
    const probeCooldownElapsed = now - entry.updatedAt >= EXHAUSTED_PROBE_INTERVAL_MS;
    return isNearReset && probeCooldownElapsed;
  }

  private resetEntry(entry: ModelQuotaEntry): void {
    entry.used = 0;
    entry.exhausted = false;
    entry.firstUsedAt = null;
    entry.updatedAt = Date.now();
    entry.lastError = null;
  }

  private load(): PersistentState {
    try {
      if (!existsSync(this.statePath)) return this.fresh();
      const parsed = JSON.parse(readFileSync(this.statePath, 'utf-8')) as Partial<PersistentState>;
      if (parsed.version === STATE_VERSION && parsed.entries && typeof parsed.entries === 'object') {
        return { version: STATE_VERSION, savedAt: Date.now(), entries: parsed.entries };
      }
    } catch (err) {
      console.warn('[model-quota] Failed to load state:', err instanceof Error ? err.message : String(err));
    }
    return this.fresh();
  }

  private fresh(): PersistentState {
    return { version: STATE_VERSION, savedAt: Date.now(), entries: {} };
  }

  private save(): void {
    try {
      mkdirSync(join(process.cwd(), 'data'), { recursive: true });
      this.state.savedAt = Date.now();
      writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[model-quota] Failed to save state:', err instanceof Error ? err.message : String(err));
    }
  }
}

export const modelQuotaService = new ModelQuotaService();
