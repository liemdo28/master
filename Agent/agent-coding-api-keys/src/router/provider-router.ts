/**
 * Antigravity Gateway — Provider Router  (v2 — 2-Level Routing)
 *
 * Level 1 — Provider Rotation (5-min window):
 *   ProviderRotationService selects primary provider every 5 minutes.
 *   Fallback is the other provider in the same window.
 *
 * Level 2 — API Key Rotation (round-robin within provider):
 *   ApiKeyRotationService selects the next healthy key for the provider.
 *   Tries every healthy key before declaring the provider failed.
 *
 * Execution flow:
 *   Request
 *     → resolve primary provider (rotation window)
 *     → tryProviderWithKeys(primary)
 *         → for each healthy key: attempt request
 *         → success: return
 *         → all keys fail: continue
 *     → for each fallback provider:
 *         → tryProviderWithKeys(fallback)
 *     → ALL_PROVIDERS_FAILED: throw structured error
 *
 * Streaming double-billing guard:
 *   Once the first byte of a stream is received, no fallback is attempted.
 *   Mid-stream failure is returned to the client as a stream error, not retried.
 *
 * Feature flags (env):
 *   PROVIDER_ROTATION_ENABLED=false  → always use first enabled provider as primary
 *   KEY_ROTATION_ENABLED=false       → use only the first configured key per provider
 */

import type {
  GatewayConfig, ProviderKey, RouteAttempt,
  RouteResult, StreamRouteResult, UniversalChatRequest,
} from '../types.js';
import type { BaseProvider } from '../providers/base-provider.js';
import type { HealthManager } from '../health/health-manager.js';
import { quotaOrchestrator } from '../runtime/quota-orchestrator.js';
import { apiKeyRotationService } from '../runtime/api-key-rotation-service.js';
import { providerKeyService } from '../services/provider-key-service.js';
import type { RuntimeKey } from '../services/provider-key-service.js';
import { circuitBreakers } from '../runtime/circuit-breaker.js';
import { timeline } from '../runtime/timeline.js';
import { providerControl } from '../runtime/provider-control.js';
import { providerRotationService } from '../runtime/provider-rotation-service.js';
import { resolveRuntimeModel, resolveRuntimeModelDetailed } from '../runtime/provider-model-map.js';
import { modelQuotaService } from '../runtime/model-quota-service.js';
import type { SourceCandidate } from '../runtime/model-quota-service.js';
import { classifyUpstreamError, classifyThrownError, shouldDisableKeyForError, shouldTripProviderForError } from '../runtime/upstream-error-classifier.js';
import type { UpstreamErrorType } from '../runtime/upstream-error-classifier.js';
import { truncateContext, estimateRequestTokens } from '../runtime/context-truncator.js';

// ── Feature flags ────────────────────────────────────────────────────────────

const PROVIDER_ROTATION_ENABLED = process.env['PROVIDER_ROTATION_ENABLED'] !== 'false';
const KEY_ROTATION_ENABLED      = process.env['KEY_ROTATION_ENABLED'] !== 'false';
const RESERVE_FALLBACK_ON_OPUS_EXHAUSTION = process.env['RESERVE_FALLBACK_ON_OPUS_EXHAUSTION'] !== 'false';
const PRIMARY_PROVIDER_IDS = ['antigravity', 'opusmax'] as const;
const OPUS_QUOTA_REQUESTS = new Set([
  'claude-opus-4',
  'claude-opus-4-6',
  'claude-opus-4.6',
  'claude-opus-4-7',
  'claude-opus-4.7',
  'claude-opus-4-8',
  'claude-opus-4.8',
]);

function isModelScopedLimitError(type: UpstreamErrorType): boolean {
  return type === 'quota_exceeded' || type === 'rate_limited';
}

// ── Types ────────────────────────────────────────────────────────────────────

export type RequestLog = {
  ts: string;
  requestId: string;
  requestModel: string;
  resolvedModel: string;
  intent: string;
  streaming: boolean;
  tools: boolean;
  attempts: RouteAttempt[];
  provider?: string | undefined;
  keyId?: string | undefined;
  error?: string | undefined;
  errorType?: string | undefined;
  durationMs?: number | undefined;
  usedFallback?: boolean | undefined;
  contextTruncated?: boolean | undefined;
  originalTokens?: number | undefined;
  truncatedTokens?: number | undefined;
  rotation?: {
    windowId: number;
    windowLabel: string;
    primaryProvider: string;
    fallbackProvider: string;
    selectedProvider: string;
    finalProvider: string | undefined;
    finalKeyId: string | undefined;
    failedKeys: Array<{ providerId: string; keyId: string; errorType: string }>;
    attemptedSources?: Array<{ sourceId: string; providerId: string; keyId: string; model: string; ok: boolean; error?: string | undefined }> | undefined;
    finalSourceId?: string | undefined;
    fallbackCount?: number | undefined;
  } | undefined;
};

/** Internal result of trying one provider (all its keys). */
interface ProviderAttemptResult {
  ok: boolean;
  providerId: string;
  keyId?: string;
  sourceId?: string;
  sourceLabel?: string;
  response?: import('../types.js').UniversalChatResponse;
  upstream?: Response;
  providerKind?: import('../types.js').ProviderKind;
  model?: string;
  attempts: RouteAttempt[];
  failedKeys: Array<{ providerId: string; keyId: string; errorType: UpstreamErrorType; error: string }>;
  shouldTripProvider: boolean;
  terminalErrorType?: UpstreamErrorType;
  contextTruncated?: boolean;
  originalTokens?: number;
  truncatedTokens?: number;
}

// ── Router ───────────────────────────────────────────────────────────────────

export class ProviderRouter {
  private readonly logs: RequestLog[] = [];
  private reqCounter = 0;

  constructor(
    private readonly config: GatewayConfig,
    private readonly providers: BaseProvider[],
    private readonly healthManager: HealthManager,
  ) {}

  requestLogs(): RequestLog[] {
    return this.logs.slice(-200).reverse();
  }

  /** Non-streaming route with 2-level key+provider rotation. */
  async route(request: UniversalChatRequest): Promise<RouteResult> {
    const start = Date.now();
    const reqId = this.nextReqId();
    const rotWin = providerRotationService.getCurrentWindow();
    const [primaryId, ...fallbackIds] = this.resolveProviderOrder(request);
    const allAttempts: RouteAttempt[] = [];
    const allFailedKeys: Array<{ providerId: string; keyId: string; errorType: UpstreamErrorType; error: string }> = [];
    const attemptedSourceIds = new Set<string>();

    console.log(`[router] ▶  ${reqId}  stream=false  window="${rotWin.windowLabel}"  primary=${primaryId}  fallbacks=[${fallbackIds.join(',')}]`);

    const providerOrder = [primaryId!, ...fallbackIds].filter(Boolean) as string[];

    for (const providerId of providerOrder) {
      const result = await this.tryProviderWithKeys(providerId, request, false, attemptedSourceIds);
      allAttempts.push(...result.attempts);
      allFailedKeys.push(...result.failedKeys);

      if (result.ok && result.response) {
        const latency = Date.now() - start;
        const usedFallback = providerId !== primaryId;
        const rotInfo = {
          windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
          primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
          selectedProvider: primaryId!, finalProvider: providerId,
          finalKeyId: result.keyId, failedKeys: allFailedKeys,
          attemptedSources: this.sourceChain(allAttempts),
          finalSourceId: result.sourceId,
          fallbackCount: allAttempts.filter((a) => !a.ok).length,
        };

        providerControl.recordRouted(providerId, latency);
        circuitBreakers.recordSuccess(providerId);
        quotaOrchestrator.consume(providerId);

        console.log(`[router] ✓  ${reqId}  ${providerId}  source=${result.sourceId}  key=${result.keyId}  (${latency}ms)${usedFallback ? '  [FALLBACK]' : ''}${result.contextTruncated ? `  [TRUNCATED ${result.originalTokens}→${result.truncatedTokens}tok]` : ''}`);

        this.log(request, result.response.model, allAttempts, providerId, result.keyId, latency, undefined, undefined, usedFallback, rotInfo, result.contextTruncated, result.originalTokens, result.truncatedTokens);
        return { response: result.response, attempts: allAttempts };
      }

      // All keys on this provider failed
      if (result.shouldTripProvider) {
        circuitBreakers.recordFailure(providerId);
        quotaOrchestrator.recordFailure(providerId, result.failedKeys.map(k => `${k.keyId}:${k.errorType}`).join(', '));
      }
      timeline.emit({
        sessionId: null, requestId: reqId,
        type: 'provider.failure',
        source: 'router',
        payload: { providerId, failedKeys: result.failedKeys.map(k => k.keyId), reasons: result.failedKeys.map(k => k.errorType), healthPenalty: result.shouldTripProvider },
      });
      if (result.terminalErrorType === 'prompt_too_large') {
        console.warn(`[router] ✗  ${reqId}  ${providerId}  PROMPT_TOO_LARGE — stopping fallback`);
        break;
      }
      console.warn(`[router] ✗  ${reqId}  ${providerId}  ALL KEYS FAILED — trying next provider`);
    }

    // All providers exhausted
    const latency = Date.now() - start;
    const model = resolveRuntimeModel(primaryId!, request.model, { thinking: Boolean(request.thinking) });
    const finalErrorType = allFailedKeys[0]?.errorType ?? 'unknown';
    this.log(request, model, allAttempts, undefined, undefined, latency, 'ALL_PROVIDERS_FAILED', finalErrorType, false, {
      windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
      primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
      selectedProvider: primaryId!, finalProvider: undefined, finalKeyId: undefined,
      failedKeys: allFailedKeys,
      attemptedSources: this.sourceChain(allAttempts),
      fallbackCount: allAttempts.filter((a) => !a.ok).length,
    });

    throw Object.assign(
      new Error(`NO_AVAILABLE_QUOTA_SOURCE: tried [${this.sourceChain(allAttempts).map((a) => a.sourceId).join(', ')}]`),
      {
        code: 'ALL_PROVIDERS_FAILED',
        type: 'NO_AVAILABLE_QUOTA_SOURCE',
        providers_attempted: providerOrder,
        attempted_sources: this.sourceChain(allAttempts),
      },
    );
  }

  /** Streaming route with 2-level key+provider rotation. */
  async routeStream(request: UniversalChatRequest): Promise<StreamRouteResult> {
    const start = Date.now();
    const reqId = this.nextReqId();
    const rotWin = providerRotationService.getCurrentWindow();
    const [primaryId, ...fallbackIds] = this.resolveProviderOrder(request);
    const allAttempts: RouteAttempt[] = [];
    const allFailedKeys: Array<{ providerId: string; keyId: string; errorType: UpstreamErrorType; error: string }> = [];
    const attemptedSourceIds = new Set<string>();

    console.log(`[router] ▶  ${reqId}  stream=true  window="${rotWin.windowLabel}"  primary=${primaryId}  fallbacks=[${fallbackIds.join(',')}]`);

    const providerOrder = [primaryId!, ...fallbackIds].filter(Boolean) as string[];

    for (const providerId of providerOrder) {
      const result = await this.tryProviderWithKeys(providerId, request, true, attemptedSourceIds);
      allAttempts.push(...result.attempts);
      allFailedKeys.push(...result.failedKeys);

      if (result.ok && result.upstream && result.providerKind && result.model) {
        const latency = Date.now() - start;
        const usedFallback = providerId !== primaryId;
        const rotInfo = {
          windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
          primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
          selectedProvider: primaryId!, finalProvider: providerId,
          finalKeyId: result.keyId, failedKeys: allFailedKeys,
          attemptedSources: this.sourceChain(allAttempts),
          finalSourceId: result.sourceId,
          fallbackCount: allAttempts.filter((a) => !a.ok).length,
        };

        providerControl.recordRouted(providerId, latency);
        circuitBreakers.recordSuccess(providerId);
        quotaOrchestrator.consume(providerId);

        console.log(`[router] ✓  ${reqId}  ${providerId}  source=${result.sourceId}  key=${result.keyId}  stream OK  (${latency}ms)${usedFallback ? '  [FALLBACK]' : ''}${result.contextTruncated ? `  [TRUNCATED ${result.originalTokens}→${result.truncatedTokens}tok]` : ''}`);

        this.log(request, result.model, allAttempts, providerId, result.keyId, latency, undefined, undefined, usedFallback, rotInfo, result.contextTruncated, result.originalTokens, result.truncatedTokens);
        return {
          upstream: result.upstream,
          provider: { id: providerId, kind: result.providerKind },
          model: result.model,
          attempts: allAttempts,
        };
      }

      if (result.shouldTripProvider) {
        circuitBreakers.recordFailure(providerId);
        quotaOrchestrator.recordFailure(providerId, result.failedKeys.map(k => `${k.keyId}:${k.errorType}`).join(', '));
      }
      if (result.terminalErrorType === 'prompt_too_large') {
        console.warn(`[router] ✗  ${reqId}  ${providerId}  PROMPT_TOO_LARGE (stream) — stopping fallback`);
        break;
      }
      console.warn(`[router] ✗  ${reqId}  ${providerId}  ALL KEYS FAILED (stream) — trying next provider`);
    }

    const latency = Date.now() - start;
    const model = resolveRuntimeModel(primaryId!, request.model, { thinking: Boolean(request.thinking) });
    const finalErrorType = allFailedKeys[0]?.errorType ?? 'unknown';
    this.log(request, model, allAttempts, undefined, undefined, latency, 'ALL_PROVIDERS_FAILED', finalErrorType, false, {
      windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
      primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
      selectedProvider: primaryId!, finalProvider: undefined, finalKeyId: undefined,
      failedKeys: allFailedKeys,
      attemptedSources: this.sourceChain(allAttempts),
      fallbackCount: allAttempts.filter((a) => !a.ok).length,
    });

    throw Object.assign(
      new Error(`NO_AVAILABLE_QUOTA_SOURCE: tried [${this.sourceChain(allAttempts).map((a) => a.sourceId).join(', ')}]`),
      {
        code: 'ALL_PROVIDERS_FAILED',
        type: 'NO_AVAILABLE_QUOTA_SOURCE',
        providers_attempted: providerOrder,
        attempted_sources: this.sourceChain(allAttempts),
      },
    );
  }

  getOrchestratorMetrics() {
    return quotaOrchestrator.getMetrics();
  }

  // ── Core: try one provider with all its keys ──────────────────────────────

  private async tryProviderWithKeys(
    providerId: string,
    request: UniversalChatRequest,
    streaming: boolean,
    attemptedSourceIds: Set<string>,
  ): Promise<ProviderAttemptResult> {
    const provider = this.getEnabledProvider(providerId);
    if (!provider) {
      return { ok: false, providerId, attempts: [], failedKeys: [], shouldTripProvider: false };
    }
    if (!circuitBreakers.canExecute(providerId)) {
      console.warn(`[router] ${providerId}: circuit breaker open, skipping provider`);
      return {
        ok: false,
        providerId,
        attempts: [],
        failedKeys: [{ providerId, keyId: 'all', errorType: 'provider_down', error: 'circuit breaker open' }],
        shouldTripProvider: false,
      };
    }

    const resolution = resolveRuntimeModelDetailed(providerId, request.model, { thinking: Boolean(request.thinking) });
    const orderedKeys = this.resolveKeys(providerId, provider.config.keys) as RuntimeKey[];
    const rawCandidates = modelQuotaService
      .getSourceCandidates(providerId, orderedKeys, request.model, resolution.resolvedModel);
    const candidates = rawCandidates
      .filter((candidate) => !attemptedSourceIds.has(candidate.sourceId))
      .filter((candidate) => modelQuotaService.canUseSource(candidate));

    if (orderedKeys.length === 0) {
      console.warn(`[router] ${providerId}: no healthy keys available`);
      return {
        ok: false,
        providerId,
        attempts: [],
        failedKeys: [{ providerId, keyId: 'all', errorType: 'provider_down', error: 'no healthy keys available' }],
        shouldTripProvider: false,
      };
    }

    if (candidates.length === 0) {
      console.warn(`[router] ${providerId}: all healthy key/model sources exhausted for requested model ${request.model}`);
      const skippedAttempts = rawCandidates
        .filter((candidate) => !attemptedSourceIds.has(candidate.sourceId))
        .map((candidate) => ({
          providerId,
          model: candidate.model,
          latencyMs: 0,
          ok: false,
          keyId: candidate.key.id,
          sourceId: candidate.sourceId,
          sourceLabel: candidate.sourceLabel,
          error: 'source_unavailable',
        }));
      return {
        ok: false,
        providerId,
        attempts: skippedAttempts,
        failedKeys: [{ providerId, keyId: 'all', errorType: 'quota_exceeded', error: `no key/model source quota available for ${request.model}` }],
        shouldTripProvider: false,
        terminalErrorType: 'quota_exceeded',
      };
    }

    // ── Context truncation (pre-flight) ─────────────────────────────────────
    const truncResult = truncateContext(request, providerId);
    if (truncResult.truncated) {
      console.warn(
        `[router:truncate] ${providerId}  dropped ${truncResult.droppedCount} messages` +
        `  tokens: ${truncResult.originalTokens} → ${truncResult.truncatedTokens}`,
      );
      request = truncResult.request;
    } else {
      const est = estimateRequestTokens(request);
      if (est > 50_000) {
        console.log(`[router:truncate] ${providerId}  tokens≈${est} — within limit, no truncation`);
      }
    }
    const truncMeta = {
      contextTruncated: truncResult.truncated,
      originalTokens: truncResult.originalTokens,
      truncatedTokens: truncResult.truncatedTokens,
    };

    const failedKeys: ProviderAttemptResult['failedKeys'] = [];
    const attempts: RouteAttempt[] = [];
    let shouldTripProvider = false;

    for (const candidate of candidates) {
      const { key, model, sourceId, sourceLabel } = candidate;
      attemptedSourceIds.add(sourceId);
      const keyStart = Date.now();
      console.log(`[router]   → ${providerId}  source=${sourceId} (${sourceLabel})  key=${key.id}  requested=${request.model}  resolved=${model}  reason=${resolution.reason}  stream=${streaming}`);

      try {
        if (streaming) {
          const upstream = await provider.fetchStream({ ...request, model }, key);

          if (!upstream.ok) {
            const rawBody = await upstream.text();
            const classified = classifyUpstreamError(upstream.status, rawBody);
            const latency = Date.now() - keyStart;

            console.error(`[router]   ✗ ${providerId}  key=${key.id}  HTTP ${upstream.status}  [${classified.type}] ${providerId}:${classified.type} -> requested:${request.model} resolved:${model}  body=${rawBody.slice(0, 300)}`);
            const isModelScopedQuota = isModelScopedLimitError(classified.type) && modelQuotaService.hasTrackedLimit(providerId, key, model);
            if (isModelScopedQuota) {
              modelQuotaService.markExhausted(providerId, key, model, rawBody);
            }
            modelQuotaService.markSourceFailure(candidate, classified.type, rawBody);
            if (shouldDisableKeyForError(classified.type) && !isModelScopedQuota) {
              apiKeyRotationService.markFailure(providerId, key.id, classified.type, rawBody.slice(0, 200));
              providerKeyService.recordFailure(key as RuntimeKey, classified.type, rawBody.slice(0, 200));
            }
            providerControl.recordError(providerId, classified.type, classified.label);
            shouldTripProvider = shouldTripProvider || (!isModelScopedQuota && this.shouldTripProviderForSource(candidate, classified.type));
            attempts.push({ providerId, model, latencyMs: latency, ok: false, keyId: key.id, sourceId, sourceLabel, error: `${classified.type}: HTTP ${upstream.status}` });
            failedKeys.push({ providerId, keyId: key.id, errorType: classified.type, error: rawBody.slice(0, 120) });

            if (classified.type === 'prompt_too_large') {
              return { ok: false, providerId, attempts, failedKeys, shouldTripProvider: false, terminalErrorType: classified.type };
            }

            // Auth failure: no point trying other keys on this provider
            if (classified.type === 'auth_failed') break;
            continue;
          }

          // Stream response is open — return immediately (no double-billing fallback)
          const latency = Date.now() - keyStart;
          apiKeyRotationService.markSuccess(providerId, key.id);
          providerKeyService.recordSuccess(key as RuntimeKey);
          modelQuotaService.recordSuccess(providerId, key, model);
          attempts.push({ providerId, model, latencyMs: latency, ok: true, keyId: key.id, sourceId, sourceLabel });
          return {
            ok: true, providerId, keyId: key.id, sourceId, sourceLabel,
            upstream, providerKind: provider.config.kind, model,
            attempts, failedKeys, shouldTripProvider: false,
            ...truncMeta,
          };

        } else {
          const response = await provider.chat({ ...request, model }, key);
          const latency = Date.now() - keyStart;

          apiKeyRotationService.markSuccess(providerId, key.id);
          providerKeyService.recordSuccess(key as RuntimeKey);
          modelQuotaService.recordSuccess(providerId, key, model);
          attempts.push({ providerId, model, latencyMs: latency, ok: true, keyId: key.id, sourceId, sourceLabel });
          return { ok: true, providerId, keyId: key.id, sourceId, sourceLabel, response, attempts, failedKeys, shouldTripProvider: false, ...truncMeta };
        }

      } catch (error) {
        const classified = classifyThrownError(error);
        const errMsg = error instanceof Error ? error.message : String(error);
        const latency = Date.now() - keyStart;

        console.error(`[router]   ✗ ${providerId}  key=${key.id}  [${classified.type}]: ${errMsg.slice(0, 150)} requested:${request.model} resolved:${model}`);
        const isModelScopedQuota = isModelScopedLimitError(classified.type) && modelQuotaService.hasTrackedLimit(providerId, key, model);
        if (isModelScopedQuota) {
          modelQuotaService.markExhausted(providerId, key, model, errMsg);
        }
        modelQuotaService.markSourceFailure(candidate, classified.type, errMsg);
        if (shouldDisableKeyForError(classified.type) && !isModelScopedQuota) {
          apiKeyRotationService.markFailure(providerId, key.id, classified.type, errMsg);
          providerKeyService.recordFailure(key as RuntimeKey, classified.type, errMsg);
        }
        providerControl.recordError(providerId, classified.type, classified.label);
        shouldTripProvider = shouldTripProvider || (!isModelScopedQuota && this.shouldTripProviderForSource(candidate, classified.type));
        attempts.push({ providerId, model, latencyMs: latency, ok: false, keyId: key.id, sourceId, sourceLabel, error: `${classified.type}: ${errMsg.slice(0, 100)}` });
        failedKeys.push({ providerId, keyId: key.id, errorType: classified.type, error: errMsg.slice(0, 120) });

        if (classified.type === 'prompt_too_large') {
          return { ok: false, providerId, attempts, failedKeys, shouldTripProvider: false, terminalErrorType: classified.type };
        }

        if (classified.type === 'auth_failed') break;
        continue;
      }
    }

    return { ok: false, providerId, attempts, failedKeys, shouldTripProvider };
  }

  // ── Provider order resolution ─────────────────────────────────────────────

  /**
   * Returns [primary, ...fallbacks] provider IDs.
   *
   * Priority:
   *   1. Manual override (providerControl.activeProvider when mode='manual')
   *   2. Time-based rotation window primary (when PROVIDER_ROTATION_ENABLED)
   *   3. First enabled provider
   *
   * Fallbacks: remaining enabled providers, rotation window fallback first.
   */
  private resolveProviderOrder(request?: UniversalChatRequest): string[] {
    const enabled = this.providers.filter((p) => p.config.enabled).map((p) => p.id);
    if (enabled.length === 0) throw new Error('No enabled providers configured.');
    const primaryEnabled = PRIMARY_PROVIDER_IDS.filter((id) => enabled.includes(id));
    const isOpusQuotaRequest = request ? OPUS_QUOTA_REQUESTS.has(request.model) : false;
    const reserveEnabled = (!isOpusQuotaRequest || RESERVE_FALLBACK_ON_OPUS_EXHAUSTION)
      ? enabled.filter((id) => !PRIMARY_PROVIDER_IDS.includes(id as (typeof PRIMARY_PROVIDER_IDS)[number]))
      : [];

    if (request && providerControl.mode !== 'manual' && PROVIDER_ROTATION_ENABLED) {
      const providerSources: Array<{ providerId: string; candidates: SourceCandidate[] }> = [];
      for (const providerId of primaryEnabled) {
          const provider = this.getEnabledProvider(providerId);
          if (!provider) continue;
          const resolution = resolveRuntimeModelDetailed(providerId, request.model, { thinking: Boolean(request.thinking) });
          const keys = this.resolveKeys(providerId, provider.config.keys) as RuntimeKey[];
          const candidates = modelQuotaService
            .getSourceCandidates(providerId, keys, request.model, resolution.resolvedModel)
            .filter((candidate) => modelQuotaService.canUseSource(candidate));
          providerSources.push({ providerId, candidates });
      }

      const sourceWindow = modelQuotaService.getCurrentSourceWindow(
        providerSources.flatMap((entry) => entry.candidates.map((candidate) => candidate.sourceId)),
      );
      const sourceOrderedProviders = providerSources
        .filter((entry) => entry.candidates.length > 0)
        .sort((a, b) => {
          const aSource = a.candidates[0]?.sourceId ?? a.providerId;
          const bSource = b.candidates[0]?.sourceId ?? b.providerId;
          return sourceWindow.sourceOrder.indexOf(aSource) - sourceWindow.sourceOrder.indexOf(bSource);
        })
        .map((entry) => entry.providerId);

      const missingPrimary = primaryEnabled.filter((id) => !sourceOrderedProviders.includes(id));
      if (sourceOrderedProviders.length > 0) {
        return [...sourceOrderedProviders, ...missingPrimary, ...reserveEnabled];
      }
    }

    const primaryFirst = (preferred?: string): string[] => {
      const orderedPrimary = preferred && primaryEnabled.includes(preferred as (typeof PRIMARY_PROVIDER_IDS)[number])
        ? [preferred, ...primaryEnabled.filter((id) => id !== preferred)]
        : primaryEnabled;
      return [...orderedPrimary, ...reserveEnabled];
    };

    // Manual operator override
    if (providerControl.mode === 'manual' && providerControl.activeProvider) {
      const manualId = providerControl.activeProvider;
      if (enabled.includes(manualId)) {
        if (primaryEnabled.includes(manualId as (typeof PRIMARY_PROVIDER_IDS)[number])) {
          return primaryFirst(manualId);
        }
        // Reserve providers are only used after Antigravity NKQ and OpusMax.
        return [
          ...primaryEnabled,
          manualId,
          ...reserveEnabled.filter((id) => id !== manualId),
        ];
      }
    }

    if (!PROVIDER_ROTATION_ENABLED) {
      return primaryFirst();
    }

    // Time-based rotation window
    const rotWin = providerRotationService.getCurrentWindow();
    const rotationPrimary = PRIMARY_PROVIDER_IDS.includes(rotWin.primaryProvider as (typeof PRIMARY_PROVIDER_IDS)[number])
      ? rotWin.primaryProvider
      : undefined;
    const primaryId = rotationPrimary && primaryEnabled.includes(rotationPrimary as (typeof PRIMARY_PROVIDER_IDS)[number])
      ? rotationPrimary
      : primaryEnabled[0] ?? reserveEnabled[0]!;
    const fallbackId = rotWin.fallbackProvider;

    const primaryRest = primaryEnabled.filter((id) => id !== primaryId);
    // Prefer rotation fallback within the main tier first, then reserve providers.
    const orderedPrimary = [
      ...(primaryRest.includes(fallbackId as (typeof PRIMARY_PROVIDER_IDS)[number]) ? [fallbackId] : []),
      ...primaryRest.filter((id) => id !== fallbackId),
    ];

    return [primaryId, ...orderedPrimary, ...reserveEnabled];
  }

  /** Get an enabled provider by ID. Returns null if not found. */
  private getEnabledProvider(providerId: string): BaseProvider | null {
    return this.providers.find((p) => p.id === providerId && p.config.enabled) ?? null;
  }

  /**
   * Resolve which keys to try for a provider.
   * Source priority: DB (via providerKeyService) → keys.json config → provider.activeKey
   * If KEY_ROTATION_ENABLED: returns all healthy keys in round-robin order.
   * If disabled: returns just the first usable key.
   */
  private resolveKeys(providerId: string, configKeys: ProviderKey[]): RuntimeKey[] {
    // Get keys from DB (with keys.json fallback inside providerKeyService)
    const allKeys = providerKeyService.getKeys(providerId, configKeys);

    if (allKeys.length === 0) {
      // Last resort: provider's activeKey (e.g. env-only providers)
      const provider = this.getEnabledProvider(providerId);
      if (provider?.activeKey) {
        return [{ ...provider.activeKey, dbId: -1 }];
      }
      return [];
    }

    if (!KEY_ROTATION_ENABLED) {
      const first = allKeys.find((k) => apiKeyRotationService.isKeyUsable(providerId, k));
      return first ? [first] : [];
    }

    return apiKeyRotationService.getOrderedKeys(providerId, allKeys) as RuntimeKey[];
  }

  private nextReqId(): string {
    return `req_${(++this.reqCounter).toString(36).padStart(6, '0')}`;
  }

  private sourceChain(attempts: RouteAttempt[]): Array<{ sourceId: string; providerId: string; keyId: string; model: string; ok: boolean; error?: string | undefined }> {
    return attempts.map((attempt) => ({
      sourceId: attempt.sourceId ?? `${attempt.providerId}:${attempt.keyId ?? 'unknown'}:${attempt.model}`,
      providerId: attempt.providerId,
      keyId: attempt.keyId ?? 'unknown',
      model: attempt.model,
      ok: attempt.ok,
      error: attempt.error,
    }));
  }

  private shouldTripProviderForSource(candidate: SourceCandidate, errorType: UpstreamErrorType): boolean {
    if (candidate.providerId === 'opusmax' && (errorType === 'provider_down' || errorType === 'timeout' || errorType === 'rate_limited')) {
      return false;
    }
    return shouldTripProviderForError(errorType);
  }

  private log(
    request: UniversalChatRequest,
    resolvedModel: string,
    attempts: RouteAttempt[],
    provider?: string,
    keyId?: string,
    durationMs?: number,
    error?: string,
    errorType?: string,
    usedFallback?: boolean,
    rotation?: RequestLog['rotation'],
    contextTruncated?: boolean,
    originalTokens?: number,
    truncatedTokens?: number,
  ): void {
    const entry: RequestLog = {
      ts: new Date().toISOString(),
      requestId: rotation ? `req_${this.reqCounter}` : `req_${this.reqCounter}`,
      requestModel: request.model,
      resolvedModel,
      intent: usedFallback ? 'fallback' : 'direct',
      streaming: request.stream,
      tools: Boolean(request.tools?.length),
      attempts,
      provider,
      keyId,
      durationMs,
      error,
      errorType,
      usedFallback,
      contextTruncated,
      originalTokens,
      truncatedTokens,
      rotation,
    };
    this.logs.push(entry);
    if (this.logs.length > 500) this.logs.splice(0, this.logs.length - 500);
  }
}
