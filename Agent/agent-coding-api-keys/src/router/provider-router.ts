/**
 * Antigravity Gateway — Provider Router  (v2 — 2-Level Routing)
 *
 * Level 1 — Provider Rotation (15-min window):
 *   ProviderRotationService selects primary provider every 15 minutes.
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
import { classifyUpstreamError, classifyThrownError, shouldDisableKeyForError, shouldTripProviderForError } from '../runtime/upstream-error-classifier.js';
import type { UpstreamErrorType } from '../runtime/upstream-error-classifier.js';
import { truncateContext, estimateRequestTokens } from '../runtime/context-truncator.js';

// ── Feature flags ────────────────────────────────────────────────────────────

const PROVIDER_ROTATION_ENABLED = process.env['PROVIDER_ROTATION_ENABLED'] !== 'false';
const KEY_ROTATION_ENABLED      = process.env['KEY_ROTATION_ENABLED'] !== 'false';

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
  } | undefined;
};

/** Internal result of trying one provider (all its keys). */
interface ProviderAttemptResult {
  ok: boolean;
  providerId: string;
  keyId?: string;
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
    const [primaryId, ...fallbackIds] = this.resolveProviderOrder();
    const allAttempts: RouteAttempt[] = [];
    const allFailedKeys: Array<{ providerId: string; keyId: string; errorType: UpstreamErrorType; error: string }> = [];

    console.log(`[router] ▶  ${reqId}  stream=false  window="${rotWin.windowLabel}"  primary=${primaryId}  fallbacks=[${fallbackIds.join(',')}]`);

    const providerOrder = [primaryId!, ...fallbackIds].filter(Boolean) as string[];

    for (const providerId of providerOrder) {
      const result = await this.tryProviderWithKeys(providerId, request, false);
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
        };

        providerControl.recordRouted(providerId, latency);
        circuitBreakers.recordSuccess(providerId);
        quotaOrchestrator.consume(providerId);

        console.log(`[router] ✓  ${reqId}  ${providerId}  key=${result.keyId}  (${latency}ms)${usedFallback ? '  [FALLBACK]' : ''}${result.contextTruncated ? `  [TRUNCATED ${result.originalTokens}→${result.truncatedTokens}tok]` : ''}`);

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
    const model = resolveRuntimeModel(primaryId!, request.model);
    const finalErrorType = allFailedKeys[0]?.errorType ?? 'unknown';
    this.log(request, model, allAttempts, undefined, undefined, latency, 'ALL_PROVIDERS_FAILED', finalErrorType, false, {
      windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
      primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
      selectedProvider: primaryId!, finalProvider: undefined, finalKeyId: undefined,
      failedKeys: allFailedKeys,
    });

    throw Object.assign(
      new Error(`ALL_PROVIDERS_FAILED: tried [${providerOrder.join(', ')}]`),
      { code: 'ALL_PROVIDERS_FAILED', providers_attempted: providerOrder },
    );
  }

  /** Streaming route with 2-level key+provider rotation. */
  async routeStream(request: UniversalChatRequest): Promise<StreamRouteResult> {
    const start = Date.now();
    const reqId = this.nextReqId();
    const rotWin = providerRotationService.getCurrentWindow();
    const [primaryId, ...fallbackIds] = this.resolveProviderOrder();
    const allAttempts: RouteAttempt[] = [];
    const allFailedKeys: Array<{ providerId: string; keyId: string; errorType: UpstreamErrorType; error: string }> = [];

    console.log(`[router] ▶  ${reqId}  stream=true  window="${rotWin.windowLabel}"  primary=${primaryId}  fallbacks=[${fallbackIds.join(',')}]`);

    const providerOrder = [primaryId!, ...fallbackIds].filter(Boolean) as string[];

    for (const providerId of providerOrder) {
      const result = await this.tryProviderWithKeys(providerId, request, true);
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
        };

        providerControl.recordRouted(providerId, latency);
        circuitBreakers.recordSuccess(providerId);
        quotaOrchestrator.consume(providerId);

        console.log(`[router] ✓  ${reqId}  ${providerId}  key=${result.keyId}  stream OK  (${latency}ms)${usedFallback ? '  [FALLBACK]' : ''}${result.contextTruncated ? `  [TRUNCATED ${result.originalTokens}→${result.truncatedTokens}tok]` : ''}`);

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
    const model = resolveRuntimeModel(primaryId!, request.model);
    const finalErrorType = allFailedKeys[0]?.errorType ?? 'unknown';
    this.log(request, model, allAttempts, undefined, undefined, latency, 'ALL_PROVIDERS_FAILED', finalErrorType, false, {
      windowId: rotWin.windowId, windowLabel: rotWin.windowLabel,
      primaryProvider: rotWin.primaryProvider, fallbackProvider: rotWin.fallbackProvider,
      selectedProvider: primaryId!, finalProvider: undefined, finalKeyId: undefined,
      failedKeys: allFailedKeys,
    });

    throw Object.assign(
      new Error(`ALL_PROVIDERS_FAILED: tried [${providerOrder.join(', ')}]`),
      { code: 'ALL_PROVIDERS_FAILED', providers_attempted: providerOrder },
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
  ): Promise<ProviderAttemptResult> {
    const provider = this.getEnabledProvider(providerId);
    if (!provider) {
      return { ok: false, providerId, attempts: [], failedKeys: [], shouldTripProvider: false };
    }

    const resolution = resolveRuntimeModelDetailed(providerId, request.model);
    const model = resolution.resolvedModel;
    const keys = this.resolveKeys(providerId, provider.config.keys) as RuntimeKey[];

    if (keys.length === 0) {
      console.warn(`[router] ${providerId}: no healthy keys available`);
      return { ok: false, providerId, attempts: [], failedKeys: [], shouldTripProvider: false };
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

    for (const key of keys) {
      const keyStart = Date.now();
      console.log(`[router]   → ${providerId}  key=${key.id}  requested=${request.model}  resolved=${model}  reason=${resolution.reason}  stream=${streaming}`);

      try {
        if (streaming) {
          const upstream = await provider.fetchStream({ ...request, model }, key);

          if (!upstream.ok) {
            const rawBody = await upstream.text();
            const classified = classifyUpstreamError(upstream.status, rawBody);
            const latency = Date.now() - keyStart;

            console.error(`[router]   ✗ ${providerId}  key=${key.id}  HTTP ${upstream.status}  [${classified.type}] ${providerId}:${classified.type} -> requested:${request.model} resolved:${model}  body=${rawBody.slice(0, 300)}`);
            if (shouldDisableKeyForError(classified.type)) {
              apiKeyRotationService.markFailure(providerId, key.id, classified.type, rawBody.slice(0, 200));
              providerKeyService.recordFailure(key as RuntimeKey, classified.type, rawBody.slice(0, 200));
            }
            providerControl.recordError(providerId, classified.type, classified.label);
            shouldTripProvider = shouldTripProvider || shouldTripProviderForError(classified.type);
            attempts.push({ providerId, model, latencyMs: latency, ok: false, keyId: key.id, error: `${classified.type}: HTTP ${upstream.status}` });
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
          attempts.push({ providerId, model, latencyMs: latency, ok: true, keyId: key.id });
          return {
            ok: true, providerId, keyId: key.id,
            upstream, providerKind: provider.config.kind, model,
            attempts, failedKeys, shouldTripProvider: false,
            ...truncMeta,
          };

        } else {
          const response = await provider.chat({ ...request, model }, key);
          const latency = Date.now() - keyStart;

          apiKeyRotationService.markSuccess(providerId, key.id);
          providerKeyService.recordSuccess(key as RuntimeKey);
          attempts.push({ providerId, model, latencyMs: latency, ok: true, keyId: key.id });
          return { ok: true, providerId, keyId: key.id, response, attempts, failedKeys, shouldTripProvider: false, ...truncMeta };
        }

      } catch (error) {
        const classified = classifyThrownError(error);
        const errMsg = error instanceof Error ? error.message : String(error);
        const latency = Date.now() - keyStart;

        console.error(`[router]   ✗ ${providerId}  key=${key.id}  [${classified.type}]: ${errMsg.slice(0, 150)} requested:${request.model} resolved:${model}`);
        if (shouldDisableKeyForError(classified.type)) {
          apiKeyRotationService.markFailure(providerId, key.id, classified.type, errMsg);
          providerKeyService.recordFailure(key as RuntimeKey, classified.type, errMsg);
        }
        providerControl.recordError(providerId, classified.type, classified.label);
        shouldTripProvider = shouldTripProvider || shouldTripProviderForError(classified.type);
        attempts.push({ providerId, model, latencyMs: latency, ok: false, keyId: key.id, error: `${classified.type}: ${errMsg.slice(0, 100)}` });
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
  private resolveProviderOrder(): string[] {
    const enabled = this.providers.filter((p) => p.config.enabled).map((p) => p.id);
    if (enabled.length === 0) throw new Error('No enabled providers configured.');

    // Manual operator override
    if (providerControl.mode === 'manual' && providerControl.activeProvider) {
      const manualId = providerControl.activeProvider;
      if (enabled.includes(manualId)) {
        const rest = enabled.filter((id) => id !== manualId);
        return [manualId, ...rest];
      }
    }

    if (!PROVIDER_ROTATION_ENABLED) {
      return enabled;
    }

    // Time-based rotation window
    const rotWin = providerRotationService.getCurrentWindow();
    const primaryId = enabled.includes(rotWin.primaryProvider) ? rotWin.primaryProvider : enabled[0]!;
    const fallbackId = rotWin.fallbackProvider;

    const rest = enabled.filter((id) => id !== primaryId);
    // Prefer rotation fallback first, then others
    const ordered = [
      ...(rest.includes(fallbackId) ? [fallbackId] : []),
      ...rest.filter((id) => id !== fallbackId),
    ];

    return [primaryId, ...ordered];
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
