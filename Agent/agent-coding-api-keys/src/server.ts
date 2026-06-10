/**
 * Antigravity Universal AI Gateway
 *
 * Single-process HTTP server that:
 *  - Accepts Anthropic Messages API  (POST /v1/messages)
 *  - Accepts OpenAI Chat Completions (POST /v1/chat/completions)
 *  - Routes to the best available provider with automatic fallback
 *  - Translates protocols bidirectionally in real time
 *  - Streams responses with genuine SSE (no buffering)
 *
 * Layer map:
 *   Client → server.ts → protocols/ → router/ → providers/ → upstream
 *                     ↕ tools/     ↕ streaming/ engine
 *                     ↕ logging/
 *
 * Compatible clients: Antigravity IDE, Cline, Claude Code, RooCode, Continue,
 *                     OpenCode, Cursor — anything that speaks OpenAI or Anthropic.
 */

import http from 'node:http';
import { loadGatewayConfig, publicProvider } from './config/config-loader.js';
import { createProvider } from './providers/provider-factory.js';
import { HealthManager } from './health/health-manager.js';
import { ProviderRouter } from './router/provider-router.js';

// Protocol layer — canonical import point
import { anthropicToUniversal, universalToAnthropic, anthropicStream } from './protocols/anthropic.js';
import { openAIToUniversal, universalToOpenAI, openAIStreamChunk } from './protocols/openai.js';

// Streaming engine
import { dispatchStream, SSE_HEADERS, peekAnthropicStreamStart } from './streaming/engine.js';

// Tool orchestration
import { countToolCalls, validateTools } from './tools/orchestrator.js';

// Structured logging
import { finalizeLog, startLog, getRecentLogs, getLogStats } from './logging/request-logger.js';

// Model registry
import { registry } from './registry/model-registry.js';

// Correlation IDs
import { createCorrelation, setCorrelationHeaders, finalizeCorrelation, activeCorrelationCount } from './correlation/correlation.js';

// Payload inspector
import { inspector } from './inspector/payload-inspector.js';

// Replay debugger
import { replayDebugger, createReplayId } from './replay/replay-debugger.js';

// Capability discovery
import { discovery } from './discovery/capability-discovery.js';

// Compatibility test runner
import { runAllTests, runClientTests } from './tests/compatibility/test-runner.js';

// Chaos test runner
import { runChaosTests } from './tests/chaos/chaos-runner.js';

// Metrics engine
import { metrics } from './metrics/metrics-engine.js';

// UI
import { dashboardHtml } from './ui/dashboard.js';
import { runtimePanelHtml } from './dashboard/provider-runtime-panel/index.js';
import { getClientIp, jsonError, readJsonBody, sendHtml, sendJson, setCors } from './utils/http.js';
import { aiRateLimiter, adminRateLimiter } from './security/rate-limiter.js';
import type { ChatCompletionRequest } from './types.js';

// Runtime modules
import { streamLifecycle } from './runtime/stream-lifecycle.js';
import { circuitBreakers } from './runtime/circuit-breaker.js';
import { quotaOrchestrator } from './runtime/quota-orchestrator.js';
import { providerControl } from './runtime/provider-control.js';
import { providerRotationService } from './runtime/provider-rotation-service.js';
import { apiKeyRotationService } from './runtime/api-key-rotation-service.js';
import { modelQuotaService } from './runtime/model-quota-service.js';
import { keyDb } from './db/key-database.js';
import { providerKeyService } from './services/provider-key-service.js';
import { keysManager } from './keys/keys-manager.js';
import { memoryGuard } from './runtime/memory-guard.js';
import { sessionRuntime } from './runtime/session-runtime.js';
import { executionGraph } from './runtime/execution-graph.js';
import { timeline } from './runtime/timeline.js';
import { supervisor } from './runtime/supervisor.js';
import { getAllowedModels, resolveRuntimeModelDetailed } from './runtime/provider-model-map.js';
import { classifyUpstreamError } from './runtime/upstream-error-classifier.js';

const config = loadGatewayConfig();
const providers = config.providers.map(createProvider);
const health = new HealthManager(providers, config.healthIntervalMs);
const router = new ProviderRouter(config, providers, health);

function getSourceWindowSnapshot(requestedModel = 'claude-opus-4-6') {
  const providerEntries = config.providers
    .filter((p) => p.enabled && (p.id === 'antigravity' || p.id === 'opusmax'))
    .map((p) => {
      const resolution = resolveRuntimeModelDetailed(p.id, requestedModel);
      const dbKeys = providerKeyService.getKeys(p.id, p.keys);
      return { providerId: p.id, keys: dbKeys, requestedModel, defaultResolvedModel: resolution.resolvedModel };
    });
  const supplySources = modelQuotaService.getSupplySources(providerEntries);
  const sourceCandidates = providerEntries.flatMap((entry) =>
    modelQuotaService.getSourceCandidates(entry.providerId, entry.keys, entry.requestedModel, entry.defaultResolvedModel)
      .map((candidate) => ({
        providerId: candidate.providerId,
        keyId: candidate.key.id,
        model: candidate.model,
        sourceId: candidate.sourceId,
        sourceLabel: candidate.sourceLabel,
        keyUsable: apiKeyRotationService.isKeyUsable(candidate.providerId, candidate.key),
        quotaUsable: modelQuotaService.canUse(candidate.providerId, candidate.key, candidate.model),
        sourceUsable: modelQuotaService.canUseSource(candidate),
        quota: modelQuotaService.getKeyModelSnapshot(candidate.providerId, candidate.key, candidate.model),
      })),
  );

  return {
    requestedModel,
    sourceWindow: modelQuotaService.getCurrentSourceWindow(sourceCandidates.map((candidate) => candidate.sourceId)),
    supplySources,
    sources: sourceCandidates.map((candidate) => ({
      ...candidate,
      usable: candidate.keyUsable && candidate.quotaUsable && candidate.sourceUsable,
    })),
  };
}

function classifyStreamPeekFailure(errorType: string, errorMessage: string) {
  return classifyUpstreamError(503, `${errorType}: ${errorMessage}`);
}

// ── Boot runtime subsystems ────────────────────────────────────────────────
health.start();
streamLifecycle.start();
memoryGuard.start();
sessionRuntime.start();
supervisor.start();

// ── Database-backed key management: migrate existing keys.json → DB ────────
providerKeyService.migrateFromConfig(config);
providerKeyService.startExpiryChecker();

// ── Default mode: assisted-auto (time-based rotation) ─────────────────────
// Router uses ProviderRotationService to select primary provider each request.
// Operator can switch to manual via POST /api/runtime/provider/switch.
// providerControl starts in 'assisted-auto' with activeProvider=null, which
// is exactly what the router expects when it defers to the rotation service.

// ── Log orchestrator startup state so operators can immediately see
//    which provider is active and whether any quota/circuit issues exist ──
quotaOrchestrator.logStartupState();

// ── HTTP server ────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  activeConnections++;
  const done = () => { activeConnections = Math.max(0, activeConnections - 1); };
  res.on('finish', done);
  res.on('close', done);

  try {
    setCors(res);
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? `${config.host}:${config.port}`}`);
    const path = url.pathname;
    const clientIp = getClientIp(req);

    // ── Rate limiting ──────────────────────────────────────────────────
    const isAiEndpoint = (req.method === 'POST' && (path === '/v1/chat/completions' || path === '/chat/completions' || path === '/v1/messages' || path === '/messages' || path === '/v1/embeddings'));
    const isAdminEndpoint = path.startsWith('/api/');

    if (isAiEndpoint && !aiRateLimiter.check(clientIp)) {
      res.setHeader('Retry-After', '60');
      jsonError(res, 429, 'Rate limit exceeded. Max 300 requests/minute per IP.', 'rate_limit_exceeded');
      return;
    }
    if (!isAiEndpoint && isAdminEndpoint && !adminRateLimiter.check(clientIp)) {
      res.setHeader('Retry-After', '60');
      jsonError(res, 429, 'Rate limit exceeded. Max 60 requests/minute per IP.', 'rate_limit_exceeded');
      return;
    }

    // ── Dashboard ──────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/') {
      sendHtml(res, dashboardHtml(config, health.list()));
      return;
    }

    // ── Health / status ────────────────────────────────────────────────
    if (req.method === 'GET' && (path === '/health' || path === '/api/status')) {
      sendJson(res, 200, {
        status: 'ok',
        gateway: 'Antigravity Universal AI Gateway',
        version: '2.0',
        port: config.port,
        mode: config.mode,
        providers: config.providers.map(publicProvider),
        health: health.list(),
        sourceRotation: getSourceWindowSnapshot('claude-opus-4-6'),
        stats: getLogStats(),
      });
      return;
    }

    // ── Runtime Operations Center ──────────────────────────────────────
    if (req.method === 'GET' && path === '/runtime') {
      sendHtml(res, runtimePanelHtml());
      return;
    }

    // ── Runtime SSE stream (realtime push every 2 s) ───────────────────
    if (req.method === 'GET' && path === '/api/runtime/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        ...Object.fromEntries(Object.entries({
          'Access-Control-Allow-Origin': '*',
        })),
      });

      const sendSnapshot = () => {
        try {
          const payload = JSON.stringify({
            orchestration: quotaOrchestrator.getMetrics(),
            breakers: circuitBreakers.getStats(),
            control: providerControl.getStatus(),
            window: providerRotationService.getCurrentWindow(),
            sourceRotation: getSourceWindowSnapshot('claude-opus-4-6'),
            allProviders: config.providers
              .filter((p) => p.enabled)
              .map((p) => ({ id: p.id, label: p.label, kind: p.kind, enabled: p.enabled })),
            timeline: timeline.query({
              type: [
                'quota.batch_switch', 'quota.batch_started', 'quota.batch_completed',
                'quota.provider_switched', 'quota.window_started', 'quota.window_reset',
                'quota.provider_exhausted', 'quota.rotation_skipped', 'quota.provider_degraded',
                'quota.state_reset', 'provider.fallback', 'provider.failure',
                'provider.circuit_open', 'provider.circuit_close',
                'provider.manual_switch', 'provider.activated',
                'provider.deactivated', 'provider.auto_suggest',
              ],
              limit: 30,
            }),
            health: health.list(),
            metrics: metrics.getSummary(),
            logStats: getLogStats(),
            ts: Date.now(),
          });
          res.write('data: ' + payload + '\n\n');
        } catch { /* client disconnected */ }
      };

      sendSnapshot();
      const interval = setInterval(sendSnapshot, 2000);
      req.on('close', () => clearInterval(interval));
      return;
    }

    // ── Runtime JSON APIs ──────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/runtime/providers') {
      sendJson(res, 200, {
        providers: quotaOrchestrator.getAllStates(),
        rotationOrder: ['antigravity', 'opusmax'],
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/rotation') {
      sendJson(res, 200, {
        ...quotaOrchestrator.getMetrics(),
        window: providerRotationService.getCurrentWindow(),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/quotas') {
      sendJson(res, 200, { quotas: quotaOrchestrator.getAllStates() });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/breakers') {
      sendJson(res, 200, circuitBreakers.getStats());
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/health') {
      sendJson(res, 200, { health: health.list(), metrics: metrics.getSummary() });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/timeline') {
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      sendJson(res, 200, {
        events: timeline.query({
          type: [
            'quota.batch_switch', 'quota.batch_started', 'quota.batch_completed',
            'quota.provider_switched', 'quota.window_started', 'quota.window_reset',
            'quota.provider_exhausted', 'quota.rotation_skipped', 'quota.provider_degraded',
            'quota.state_reset', 'provider.fallback', 'provider.circuit_open',
            'provider.circuit_close', 'provider.priority_switch', 'provider.recovered',
          ],
          limit,
        }),
      });
      return;
    }

    // ── Runtime operator reset (full) ──────────────────────────────────
    if (req.method === 'POST' && path === '/api/runtime/reset') {
      quotaOrchestrator.reset();
      sendJson(res, 200, {
        ok: true,
        message: 'All quota orchestrator state has been reset to factory defaults.',
        state: quotaOrchestrator.getMetrics(),
      });
      return;
    }

    // ── Runtime operator reset (per-provider) ─────────────────────────
    const providerResetMatch = path.match(/^\/api\/runtime\/reset\/([^/]+)$/);
    if (req.method === 'POST' && providerResetMatch?.[1]) {
      const providerId = providerResetMatch[1];
      const ok = quotaOrchestrator.resetProvider(providerId);
      if (!ok) {
        jsonError(res, 404, `Provider '${providerId}' is not a managed orchestration provider.`, 'unknown_provider');
        return;
      }
      sendJson(res, 200, {
        ok: true,
        message: `Provider '${providerId}' quota and state reset.`,
        provider: quotaOrchestrator.getProviderState(providerId),
      });
      return;
    }

    // ── Runtime quota reset (per key+model, no restart needed) ───────────
    // POST /api/runtime/quota/reset/:providerId/:keyId/:model
    const quotaEntryResetMatch = path.match(/^\/api\/runtime\/quota\/reset\/([^/]+)\/([^/]+)\/([^/]+)$/);
    if (req.method === 'POST' && quotaEntryResetMatch) {
      const providerId = quotaEntryResetMatch[1]!;
      const keyId = quotaEntryResetMatch[2]!;
      const model = quotaEntryResetMatch[3]!;
      const ok = modelQuotaService.resetModelQuotaEntry(providerId, keyId, model);
      if (!ok) {
        jsonError(res, 404, `Quota entry '${providerId}:${keyId}:${model}' not found.`, 'not_found');
        return;
      }
      sendJson(res, 200, {
        ok: true,
        message: `Quota entry '${providerId}:${keyId}:${model}' reset to 0 — no restart needed.`,
        entry: `${providerId}:${keyId}:${model}`,
      });
      return;
    }

    // ── Runtime quota reset (all entries for a provider) ──────────────────
    // POST /api/runtime/quota/reset/:providerId  (body: {} or omit)
    const quotaProviderResetMatch = path.match(/^\/api\/runtime\/quota\/reset\/([^/]+)$/);
    if (req.method === 'POST' && quotaProviderResetMatch) {
      const providerId = quotaProviderResetMatch[1]!;
      const count = modelQuotaService.resetAllModelQuotaForProvider(providerId);
      sendJson(res, 200, {
        ok: true,
        message: `Reset ${count} quota entries for provider '${providerId}' — no restart needed.`,
        provider: providerId,
        count,
      });
      return;
    }

    // ── Provider Control: hot-swap active provider ─────────────────────
    if (req.method === 'POST' && path === '/api/runtime/provider/switch') {
      const body = await readJsonBody<{ provider?: string }>(req);
      const targetId = body.provider;
      if (!targetId || typeof targetId !== 'string') {
        jsonError(res, 400, "Missing required field: 'provider'", 'missing_field');
        return;
      }
      const targetCfg = config.providers.find((p) => p.id === targetId && p.enabled);
      if (!targetCfg) {
        jsonError(res, 404, `Provider '${targetId}' not found or not enabled. Check keys.json activeProviders.`, 'unknown_provider');
        return;
      }
      const { previous, current } = providerControl.switchTo(targetId, true);
      const previousDisplay = previous === 'antigravity' ? 'antigravity-nkq' : (previous ?? 'none');
      console.log(`[gateway] Provider control switch: ${previousDisplay} → ${current}`);
      sendJson(res, 200, {
        success: true,
        previousProvider: previousDisplay,
        activeProvider: current,
        mode: providerControl.mode,
        control: providerControl.getStatus(),
      });
      return;
    }

    // ── Provider Control: switch mode ──────────────────────────────────
    if (req.method === 'POST' && path === '/api/runtime/provider/mode') {
      const body = await readJsonBody<{ mode?: string }>(req);
      const mode = body.mode;
      if (mode !== 'manual' && mode !== 'assisted-auto') {
        jsonError(res, 400, "mode must be 'manual' or 'assisted-auto'", 'invalid_mode');
        return;
      }
      providerControl.setMode(mode);
      sendJson(res, 200, { ok: true, mode, control: providerControl.getStatus() });
      return;
    }

    // ── Provider Control: status snapshot ─────────────────────────────
    if (req.method === 'GET' && path === '/api/runtime/provider/status') {
      sendJson(res, 200, {
        ts: Date.now(),
        ...providerControl.getStatus(),
        allProviders: config.providers
          .filter((p) => p.enabled)
          .map((p) => ({ id: p.id, label: p.label, kind: p.kind })),
      });
      return;
    }

    // ── Active provider (simple status for IDE health checks) ─────────
    if (req.method === 'GET' && path === '/api/runtime/provider/active') {
      const ctrl = providerControl.getStatus();
      const activeId = ctrl.activeProvider ?? config.providers.find((p) => p.enabled)?.id ?? null;
      const activeCfg = activeId ? config.providers.find((p) => p.id === activeId) : null;
      sendJson(res, 200, {
        ts: Date.now(),
        activeProvider: activeId,
        activeLabel: activeCfg ? activeCfg.label : activeId,
        mode: ctrl.mode,
        activeSince: ctrl.activeSince,
        requestsRouted: ctrl.requestsRouted,
        avgLatencyMs: ctrl.avgLatencyMs,
      });
      return;
    }

    // ── Runtime live endpoints (real-time aliases) ─────────────────────
    if (req.method === 'GET' && path === '/api/runtime/quotas/live') {
      sendJson(res, 200, {
        ts: Date.now(),
        quotas: quotaOrchestrator.getAllStates(),
        activeProvider: quotaOrchestrator.getMetrics().currentActiveProvider,
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/providers/live') {
      sendJson(res, 200, {
        ts: Date.now(),
        providers: quotaOrchestrator.getAllStates(),
        breakers: circuitBreakers.getStats(),
        rotationOrder: ['antigravity', 'opusmax'],
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/rotation/live') {
      sendJson(res, 200, {
        ts: Date.now(),
        ...quotaOrchestrator.getMetrics(),
        window: providerRotationService.getCurrentWindow(),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/window') {
      sendJson(res, 200, {
        ts: Date.now(),
        ...providerRotationService.getCurrentWindow(),
        providers: providerRotationService.getProviderList(),
      });
      return;
    }

    // ── Provider + Key status endpoints ───────────────────────────────────
    if (req.method === 'GET' && path === '/api/providers/status') {
      const enabledProviders = config.providers.filter((p) => p.enabled);
      sendJson(res, 200, {
        ts: Date.now(),
        window: providerRotationService.getCurrentWindow(),
        providers: enabledProviders.map((p) => {
          const runtimeKeys = providerKeyService.getKeys(p.id, p.keys);
          return {
            id: p.id,
            label: p.label,
            enabled: p.enabled,
            keys: apiKeyRotationService.getProviderKeyHealth(p.id, runtimeKeys).map((h) => {
              const runtimeKey = runtimeKeys.find((k) => k.id === h.keyId);
              const raw = runtimeKey?.value ?? h.keyId;
              return {
                ...h,
                masked: raw.length > 8 ? `${raw.slice(0, 6)}...${raw.slice(-4)}` : h.keyId,
                modelQuotas: runtimeKey ? [
                  modelQuotaService.getKeyModelSnapshot(p.id, runtimeKey, 'claude-opus-4-6'),
                  modelQuotaService.getKeyModelSnapshot(p.id, runtimeKey, 'claude-opus-4-7'),
                ].filter(Boolean) : [],
              };
            }),
          };
        }),
        sourceRotation: getSourceWindowSnapshot('claude-opus-4-6'),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/model-quotas') {
      const providerId = url.searchParams.get('provider') ?? undefined;
      sendJson(res, 200, {
        ts: Date.now(),
        quotas: modelQuotaService.getSnapshot(providerId),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/runtime/source-window') {
      const requestedModel = url.searchParams.get('model') ?? 'claude-opus-4-7';
      sendJson(res, 200, {
        ts: Date.now(),
        ...getSourceWindowSnapshot(requestedModel),
      });
      return;
    }
    const sourceActionMatch = path.match(/^\/api\/runtime\/sources\/([^/]+)\/(enable|disable|reset)$/);
    if (req.method === 'POST' && sourceActionMatch) {
      const [, sourceId, action] = sourceActionMatch as [string, string, string];
      if (action === 'enable') modelQuotaService.setSourceEnabled(sourceId, true);
      if (action === 'disable') modelQuotaService.setSourceEnabled(sourceId, false);
      if (action === 'reset') modelQuotaService.resetSource(sourceId);
      sendJson(res, 200, {
        ok: true,
        sourceId,
        action,
        sourceRotation: getSourceWindowSnapshot('claude-opus-4-6'),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/providers/diagnostics') {
      const requestedModel = url.searchParams.get('model') ?? 'claude-opus-4-7';
      const breakers = circuitBreakers.getStats().providers;
      sendJson(res, 200, {
        ts: Date.now(),
        requestedModel,
        providers: config.providers
          .filter((p) => p.enabled)
          .map((p) => {
            const quota = quotaOrchestrator.getProviderState(p.id);
            const resolution = resolveRuntimeModelDetailed(p.id, requestedModel);
            const dbKeys = providerKeyService.getKeys(p.id, p.keys);
            const keyHealth = apiKeyRotationService.getProviderKeyHealth(p.id, dbKeys);
            const keys = (keyHealth.length > 0 ? keyHealth : dbKeys.map((k) => ({
              keyId: k.id,
              providerId: p.id,
              status: 'healthy',
              cooldownUntil: null,
              consecutiveFailures: 0,
              totalRequests: 0,
              totalFailures: 0,
              lastSuccessAt: null,
              lastFailureAt: null,
              lastErrorType: null,
              lastErrorMessage: null,
            }))).map((h) => {
              const configKey = p.keys.find((k) => k.id === h.keyId);
              const runtimeKey = dbKeys.find((k) => k.id === h.keyId);
              const raw = configKey?.value ?? runtimeKey?.value ?? h.keyId;
              return {
                keyAlias: h.keyId,
                maskedId: raw.length > 8 ? `${raw.slice(0, 4)}...${raw.slice(-4)}` : h.keyId,
                healthStatus: h.status,
                lastErrorReason: h.lastErrorType,
                lastErrorMessage: h.lastErrorMessage,
                nextRetryTime: h.cooldownUntil ? new Date(h.cooldownUntil).toISOString() : null,
                modelQuota: runtimeKey
                  ? modelQuotaService.getKeyModelSnapshot(p.id, runtimeKey, resolution.resolvedModel)
                  : null,
              };
            });

            return {
              provider: p.id,
              label: p.label,
              keyAlias: keys[0]?.keyAlias ?? null,
              maskedId: keys[0]?.maskedId ?? null,
              keys,
              allowedModels: getAllowedModels(p.id),
              requestedModel,
              resolvedModel: resolution.resolvedModel,
              resolutionReason: resolution.reason,
              quotaRemaining: quota.remainingQuota,
              quotaUsed: quota.usedQuota,
              quotaTotal: quota.totalQuota,
              lastErrorReason: quota.lastError,
              healthStatus: quota.state,
              circuitBreaker: breakers[p.id]?.state ?? 'closed',
              nextRetryTime: keys.find((k) => k.nextRetryTime)?.nextRetryTime ?? null,
            };
          }),
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/providers/rotation') {
      sendJson(res, 200, {
        ts: Date.now(),
        window: providerRotationService.getCurrentWindow(),
        orchestration: quotaOrchestrator.getMetrics(),
        providerRotationEnabled: process.env['PROVIDER_ROTATION_ENABLED'] !== 'false',
        keyRotationEnabled: process.env['KEY_ROTATION_ENABLED'] !== 'false',
      });
      return;
    }
    if (req.method === 'GET' && path === '/api/providers/logs') {
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      sendJson(res, 200, { logs: router.requestLogs().slice(0, limit) });
      return;
    }

    // ── Keys.json UI management endpoints ──────────────────────────────────
    if (req.method === 'GET' && path === '/api/keys/providers') {
      try {
        const providers = keysManager.getAllProviders();
        sendJson(res, 200, { providers });
      } catch (error) {
        jsonError(res, 500, String(error), 'read_error');
      }
      return;
    }

    if (req.method === 'GET' && path.startsWith('/api/keys/providers/')) {
      const providerId = path.slice('/api/keys/providers/'.length);
      if (!providerId) {
        jsonError(res, 400, 'Provider ID required', 'missing_provider');
        return;
      }
      try {
        const keys = keysManager.getProviderKeys(providerId);
        sendJson(res, 200, {
          providerId,
          keys: keys.map((k) => ({
            id: k.id || `key-${keys.indexOf(k)}`,
            active: k.active,
            label: k.label || 'Unnamed',
            masked: k.value.slice(0, 6) + '...' + k.value.slice(-4),
            createdAt: k.createdAt,
          })),
        });
      } catch (error) {
        jsonError(res, 500, String(error), 'read_error');
      }
      return;
    }

    const addKeyMatch = path.match(/^\/api\/keys\/providers\/([^/]+)\/add$/);
    if (req.method === 'POST' && addKeyMatch) {
      const providerId = addKeyMatch[1]!;
      try {
        const body = await readJsonBody<{ key: string; label?: string }>(req);
        if (!body.key || !body.key.trim()) {
          jsonError(res, 400, 'Key value is required', 'missing_key');
          return;
        }
        const label = body.label && body.label.trim() ? body.label.trim() : undefined;
        const entry = keysManager.addKey(providerId, body.key.trim(), label);
        sendJson(res, 201, {
          ok: true,
          key: {
            id: entry.id,
            active: entry.active,
            label: entry.label,
            masked: entry.value.slice(0, 6) + '...' + entry.value.slice(-4),
          },
        });
      } catch (error) {
        jsonError(res, 500, String(error), 'add_key_error');
      }
      return;
    }

    const toggleKeyMatch = path.match(/^\/api\/keys\/providers\/([^/]+)\/keys\/([^/]+)\/toggle$/);
    if (req.method === 'POST' && toggleKeyMatch) {
      const [, providerId, keyId] = toggleKeyMatch as [string, string, string];
      try {
        const body = await readJsonBody<{ active: boolean }>(req);
        const updated = keysManager.toggleKey(providerId, keyId, body.active);
        if (!updated) {
          jsonError(res, 404, 'Key not found', 'not_found');
          return;
        }
        sendJson(res, 200, { ok: true, active: updated.active });
      } catch (error) {
        jsonError(res, 500, String(error), 'toggle_error');
      }
      return;
    }

    const deleteKeyMatch = path.match(/^\/api\/keys\/providers\/([^/]+)\/keys\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteKeyMatch) {
      const [, providerId, keyId] = deleteKeyMatch as [string, string, string];
      try {
        const ok = keysManager.deleteKey(providerId, keyId);
        if (!ok) {
          jsonError(res, 404, 'Key not found', 'not_found');
          return;
        }
        sendJson(res, 200, { ok: true });
      } catch (error) {
        jsonError(res, 500, String(error), 'delete_error');
      }
      return;
    }

    // ── Key management endpoints ───────────────────────────────────────────
    const keyActionMatch = path.match(/^\/api\/providers\/keys\/([^/]+)\/(disable|enable|reset-cooldown)$/);
    if (req.method === 'POST' && keyActionMatch) {
      const [, keySpec, action] = keyActionMatch as [string, string, string];
      // keySpec format: "providerId:keyId" or just "keyId" (searches all providers)
      const [specProvider, specKey] = keySpec.includes(':')
        ? keySpec.split(':') as [string, string]
        : [null, keySpec];

      let found = false;
      for (const p of config.providers.filter((p) => p.enabled)) {
        if (specProvider && p.id !== specProvider) continue;
        const key = p.keys.find((k) => k.id === (specKey ?? keySpec));
        if (!key) continue;
        found = true;
        if (action === 'disable')       apiKeyRotationService.disableKey(p.id, key.id);
        if (action === 'enable')        apiKeyRotationService.enableKey(p.id, key.id);
        if (action === 'reset-cooldown') apiKeyRotationService.resetCooldown(p.id, key.id);
        sendJson(res, 200, { ok: true, action, providerId: p.id, keyId: key.id,
          status: apiKeyRotationService.getKeyStatus(p.id, key.id) });
        return;
      }
      if (!found) jsonError(res, 404, `Key '${keySpec}' not found`, 'not_found');
      return;
    }

    // ── Admin: Provider list ──────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/admin/providers') {
      const summary = keyDb.getProviderSummary();
      sendJson(res, 200, { providers: summary });
      return;
    }

    // ── Admin: Key CRUD ───────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/admin/keys') {
      sendJson(res, 200, { keys: keyDb.getAll() });
      return;
    }

    if (req.method === 'POST' && path === '/api/admin/keys') {
      const body = await readJsonBody<Record<string, unknown>>(req);
      if (!body.provider_name || !body.key_name || !body.api_key) {
        jsonError(res, 400, 'Missing required fields: provider_name, key_name, api_key', 'missing_fields');
        return;
      }
      const key = keyDb.createKey({
        provider_name: String(body.provider_name),
        key_name: String(body.key_name),
        api_key: String(body.api_key),
        enabled: body.enabled !== false,
        weight: typeof body.weight === 'number' ? body.weight : 1,
        priority: typeof body.priority === 'number' ? body.priority : 10,
        quota_limit: typeof body.quota_limit === 'number' ? body.quota_limit : null,
        expires_at: typeof body.expires_at === 'number' ? body.expires_at : null,
        created_by: 'dashboard',
      }, 'dashboard');
      providerKeyService.invalidateCache();
      sendJson(res, 201, { ok: true, key });
      return;
    }

    const keyIdMatch = path.match(/^\/api\/admin\/keys\/(\d+)$/);
    if (keyIdMatch) {
      const keyId = parseInt(keyIdMatch[1]!, 10);

      if (req.method === 'GET') {
        const key = keyDb.getById(keyId);
        if (!key) { jsonError(res, 404, 'Key not found', 'not_found'); return; }
        sendJson(res, 200, { key });
        return;
      }

      if (req.method === 'PUT') {
        const body = await readJsonBody<Record<string, unknown>>(req);
        const updateInput: import('./db/key-database.js').UpdateKeyInput = {};
        if (typeof body.key_name  === 'string')  updateInput.key_name  = body.key_name;
        if (typeof body.api_key   === 'string')  updateInput.api_key   = body.api_key;
        if (typeof body.enabled   === 'boolean') updateInput.enabled   = body.enabled;
        if (typeof body.weight    === 'number')  updateInput.weight    = body.weight;
        if (typeof body.priority  === 'number')  updateInput.priority  = body.priority;
        if (typeof body.quota_limit === 'number') updateInput.quota_limit = body.quota_limit;
        if ('expires_at' in body) updateInput.expires_at = typeof body.expires_at === 'number' ? body.expires_at : null;
        const updated = keyDb.updateKey(keyId, updateInput, 'dashboard');
        if (!updated) { jsonError(res, 404, 'Key not found', 'not_found'); return; }
        providerKeyService.invalidateCache();
        sendJson(res, 200, { ok: true, key: updated });
        return;
      }

      if (req.method === 'DELETE') {
        keyDb.softDelete(keyId, 'dashboard');
        providerKeyService.invalidateCache();
        sendJson(res, 200, { ok: true });
        return;
      }
    }

    // ── Admin: Key actions ────────────────────────────────────────────────
    const keyActionAdminMatch = path.match(/^\/api\/admin\/keys\/(\d+)\/(enable|disable|test)$/);
    if (req.method === 'POST' && keyActionAdminMatch) {
      const [, idStr, action] = keyActionAdminMatch as [string, string, string];
      const keyId = parseInt(idStr, 10);

      if (action === 'enable') {
        keyDb.enableKey(keyId, 'dashboard');
        providerKeyService.invalidateCache();
        sendJson(res, 200, { ok: true, status: 'healthy' });
        return;
      }
      if (action === 'disable') {
        keyDb.disableKey(keyId, 'dashboard');
        providerKeyService.invalidateCache();
        sendJson(res, 200, { ok: true, status: 'disabled' });
        return;
      }
      if (action === 'test') {
        const keyRow = keyDb.getById(keyId);
        if (!keyRow) { jsonError(res, 404, 'Key not found', 'not_found'); return; }
        // Get the raw key value for testing
        const usableKeys = keyDb.getUsableKeys(keyRow.provider_name);
        const rawKey = usableKeys.find((k) => k.id === keyId)?.value;
        if (!rawKey) { jsonError(res, 400, 'Cannot decrypt key', 'decrypt_error'); return; }
        const providerCfg = config.providers.find((p) => p.id === keyRow.provider_name);
        const baseURL = providerCfg?.baseURL ?? 'https://api.anthropic.com';
        const result = await providerKeyService.testKey(keyRow.provider_name, rawKey, baseURL);
        if (result.ok) {
          keyDb.updateKey(keyId, { enabled: true }, 'test');
          keyDb.recordSuccess(keyId);
          providerKeyService.invalidateCache();
        }
        sendJson(res, 200, result);
        return;
      }
    }

    // ── Admin: Audit log ──────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/admin/audit') {
      const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
      sendJson(res, 200, { logs: keyDb.getAuditLog(limit) });
      return;
    }

    // ── Admin: Dashboard page ─────────────────────────────────────────────
    if (req.method === 'GET' && (path === '/admin' || path === '/admin/keys')) {
      const { adminKeysDashboardHtml } = await import('./ui/admin-keys.js');
      sendHtml(res, adminKeysDashboardHtml());
      return;
    }

    // ── Runtime debug (full diagnostic snapshot) ───────────────────────
    if (req.method === 'GET' && path === '/api/runtime/debug') {
      const orchestratorStates = quotaOrchestrator.getAllStates();
      const breakerStats = circuitBreakers.getStats();
      const metrics_snap = quotaOrchestrator.getMetrics();

      // Simulate what getCandidates() would return right now
      const simulatedCandidates = quotaOrchestrator.getCandidates();

      const enabledProviders = config.providers
        .filter((p) => p.enabled)
        .map((p) => ({ id: p.id, label: p.label, kind: p.kind, enabled: p.enabled }));

      sendJson(res, 200, {
        ts: Date.now(),
        orchestration: {
          currentActiveProvider: metrics_snap.currentActiveProvider,
          requestsUntilSwitch: metrics_snap.requestsUntilSwitch,
          simulatedNextCandidates: simulatedCandidates,
          nkqInCandidates: simulatedCandidates.includes('antigravity'),
          providers: orchestratorStates,
        },
        circuitBreakers: breakerStats,
        enabledProviders,
        routingMode: config.mode,
        logStats: getLogStats(),
        warnings: [
          ...(simulatedCandidates.length === 0 ? ['⚠ NO CANDIDATES — all providers unavailable'] : []),
          ...(!simulatedCandidates.includes('antigravity') ? [
            `⚠ NKQ NOT in candidates. state=${orchestratorStates.find(p => p.provider === 'antigravity')?.state}` +
            ` failures=${orchestratorStates.find(p => p.provider === 'antigravity')?.consecutiveFailures}` +
            ` lastError=${orchestratorStates.find(p => p.provider === 'antigravity')?.lastError ?? 'none'}`,
          ] : []),
          ...(breakerStats.providers['antigravity']?.state !== 'closed' ? [
            `⚠ NKQ circuit breaker is ${breakerStats.providers['antigravity']?.state?.toUpperCase()}`,
          ] : []),
        ],
      });
      return;
    }

    // ── Request logs (dashboard) ───────────────────────────────────────
    if (req.method === 'GET' && path === '/api/logs') {
      sendJson(res, 200, { logs: router.requestLogs() });
      return;
    }

    // ── Structured logs (detailed) ─────────────────────────────────────
    if (req.method === 'GET' && path === '/api/logs/structured') {
      sendJson(res, 200, { logs: getRecentLogs(100), stats: getLogStats() });
      return;
    }

    // ── Model registry ─────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/models/registry') {
      sendJson(res, 200, { models: registry.list() });
      return;
    }

    // ── Provider toggle ────────────────────────────────────────────────
    const toggleMatch = path.match(/^\/api\/providers\/([^/]+)\/toggle$/);
    if (req.method === 'POST' && toggleMatch?.[1]) {
      const body = await readJsonBody<{ enabled?: boolean }>(req);
      const provider = config.providers.find((p) => p.id === toggleMatch[1]);
      if (!provider) { jsonError(res, 404, `Unknown provider: ${toggleMatch[1]}`, 'unknown_provider'); return; }
      provider.enabled = body.enabled === true;
      sendJson(res, 200, { ok: true, provider: publicProvider(provider) });
      return;
    }

    // ── Model list (OpenAI format) ─────────────────────────────────────
    if (req.method === 'GET' && path === '/v1/models') {
      const models = new Set<string>();
      for (const p of providers) {
        for (const m of await p.listModels().catch(() => [])) models.add(m.id);
      }
      sendJson(res, 200, {
        object: 'list',
        data: [...models].map((id) => ({ id, object: 'model', owned_by: 'antigravity-gateway' })),
      });
      return;
    }

    // ── OpenAI Chat Completions ────────────────────────────────────────
    if (req.method === 'POST' && (path === '/v1/chat/completions' || path === '/chat/completions')) {
      const correlation = createCorrelation(req);
      setCorrelationHeaders(res, correlation);
      metrics.requestStart();

      const body = await readJsonBody<ChatCompletionRequest>(req);
      const request = openAIToUniversal(body);
      const { requestId, t0 } = startLog({
        endpoint: 'openai',
        model: request.model,
        streaming: request.stream,
        toolCount: request.tools?.length ?? 0,
        inputMessages: request.messages.length,
      });

      timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'request.start', source: 'server', payload: { endpoint: 'openai', model: request.model, streaming: request.stream } });

      // Tool validation warnings (non-blocking)
      if (request.tools?.length) {
        const { warnings } = validateTools(request.tools);
        for (const w of warnings) console.warn(`[gateway] ${w}`);
      }

      if (request.stream) {
        // ── Stream-start peek: detect mid-stream overload before committing HTTP 200 ──
        // Retry up to 3 times if the upstream sends an error as its first SSE event
        // (e.g. Anthropic 529 overloaded_error). Since headers aren't sent yet we can
        // transparently fall back to another provider.
        const MAX_STREAM_PEEK_RETRIES = 3;
        const PEEK_BACKOFF_MS = [150, 600, 2000];
        let streamResult = await router.routeStream(request);
        let peekRetries = 0;

        if (streamResult.provider.kind === 'anthropic') {
          while (peekRetries < MAX_STREAM_PEEK_RETRIES) {
            const peek = await peekAnthropicStreamStart(streamResult.upstream);
            if (peek.ok) {
              streamResult = { ...streamResult, upstream: peek.upstream };
              break;
            }
            peekRetries++;
            console.warn(
              `[server] stream-peek error on ${streamResult.provider.id}` +
              `  [${peek.errorType}] ${peek.errorMessage}` +
              `  — retry ${peekRetries}/${MAX_STREAM_PEEK_RETRIES}`,
            );
            if (peekRetries >= MAX_STREAM_PEEK_RETRIES) {
              const classified = classifyStreamPeekFailure(peek.errorType, peek.errorMessage);
              // Only quarantine the provider after the stream start failed for
              // a real provider outage. Quota/rate/client errors should be
              // visible in logs without poisoning provider health.
              if (classified.type === 'provider_down') {
                circuitBreakers.recordFailure(streamResult.provider.id);
              }
              finalizeLog(requestId, t0, {
                endpoint: 'openai', model: request.model, streaming: true,
                toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
              }, {
                status: 'error',
                provider: streamResult.provider.id,
                providerKind: streamResult.provider.kind,
                resolvedModel: streamResult.model,
                attempts: streamResult.attempts.length,
                fallbacks: streamResult.attempts.filter((a) => !a.ok).length,
                error: `${classified.type}: ${peek.errorMessage}`,
              });
              metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: false, providerId: streamResult.provider.id, streaming: true, streamCompleted: false, fallback: streamResult.attempts.length > 1, inputTokens: 0, outputTokens: 0 });
              sendJson(res, 503, {
                error: { type: classified.type, upstreamType: peek.errorType, message: peek.errorMessage },
                gateway: { retries: peekRetries },
              });
              metrics.requestEnd();
              finalizeCorrelation(correlation.requestId);
              return;
            }
            // Backoff then re-route (circuit breaker now steers away from failed provider)
            await new Promise((r) => setTimeout(r, PEEK_BACKOFF_MS[peekRetries - 1] ?? 600));
            streamResult = await router.routeStream(request);
          }
        }

        const id = `chatcmpl-${streamResult.provider.id}-${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);

        // Register stream with lifecycle manager
        const streamEntry = streamLifecycle.register({ id, requestId, providerId: streamResult.provider.id, model: streamResult.model, protocol: 'openai', startedAt: Date.now() });

        timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'stream.start', source: 'server', payload: { streamId: id, provider: streamResult.provider.id } });

        // Handle client disconnect
        res.on('close', () => { streamLifecycle.clientDisconnected(id); });

        res.writeHead(200, SSE_HEADERS);
        await dispatchStream({
          upstream: streamResult.upstream,
          res,
          inboundProtocol: 'openai',
          providerKind: streamResult.provider.kind,
          completionId: id,
          created,
          model: streamResult.model,
          providerId: streamResult.provider.id,
        });
        res.end();

        // Finalize stream lifecycle
        streamLifecycle.complete(id);
        timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'stream.complete', source: 'server', payload: { streamId: id } });

        finalizeLog(requestId, t0, {
          endpoint: 'openai', model: request.model, streaming: true,
          toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
        }, {
          status: 'stream',
          provider: streamResult.provider.id,
          providerKind: streamResult.provider.kind,
          resolvedModel: streamResult.model,
          attempts: streamResult.attempts.length,
          fallbacks: streamResult.attempts.filter((a) => !a.ok).length,
        });

        metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: true, providerId: streamResult.provider.id, streaming: true, streamCompleted: true, fallback: streamResult.attempts.length > 1, inputTokens: 0, outputTokens: 0 });
        metrics.requestEnd();
        finalizeCorrelation(correlation.requestId);
        return;
      }

      // Non-streaming
      const routed = await router.route(request);
      timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'provider.success', source: 'server', payload: { provider: routed.response.providerId, model: routed.response.model } });

      const openAIResponse = { ...universalToOpenAI(routed.response), gateway_attempts: routed.attempts };
      sendJson(res, 200, openAIResponse);

      finalizeLog(requestId, t0, {
        endpoint: 'openai', model: request.model, streaming: false,
        toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
      }, {
        status: 'ok',
        provider: routed.response.providerId,
        providerKind: config.providers.find((p) => p.id === routed.response.providerId)?.kind ?? null,
        resolvedModel: routed.response.model,
        attempts: routed.attempts.length,
        fallbacks: routed.attempts.filter((a) => !a.ok).length,
        finishReason: routed.response.finishReason,
        toolCallsReturned: countToolCalls(routed.response.content),
        inputTokens: routed.response.usage.inputTokens,
        outputTokens: routed.response.usage.outputTokens,
      });

      metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: true, providerId: routed.response.providerId, streaming: false, toolCalls: countToolCalls(routed.response.content), fallback: routed.attempts.length > 1, inputTokens: routed.response.usage.inputTokens, outputTokens: routed.response.usage.outputTokens });
      metrics.requestEnd();
      finalizeCorrelation(correlation.requestId);
      return;
    }

    // ── Anthropic Messages API ─────────────────────────────────────────
    if (req.method === 'POST' && (path === '/v1/messages' || path === '/messages')) {
      const correlation = createCorrelation(req);
      setCorrelationHeaders(res, correlation);
      metrics.requestStart();

      const body = await readJsonBody<Record<string, unknown>>(req);
      const request = anthropicToUniversal(body);
      const { requestId, t0 } = startLog({
        endpoint: 'anthropic',
        model: request.model,
        streaming: request.stream,
        toolCount: request.tools?.length ?? 0,
        inputMessages: request.messages.length,
      });

      timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'request.start', source: 'server', payload: { endpoint: 'anthropic', model: request.model, streaming: request.stream } });

      if (request.stream) {
        // ── Stream-start peek (same as OpenAI endpoint) ──
        const MAX_STREAM_PEEK_RETRIES = 3;
        const PEEK_BACKOFF_MS = [150, 600, 2000];
        let streamResult = await router.routeStream(request);
        let peekRetries = 0;

        if (streamResult.provider.kind === 'anthropic') {
          while (peekRetries < MAX_STREAM_PEEK_RETRIES) {
            const peek = await peekAnthropicStreamStart(streamResult.upstream);
            if (peek.ok) {
              streamResult = { ...streamResult, upstream: peek.upstream };
              break;
            }
            peekRetries++;
            console.warn(
              `[server] stream-peek error on ${streamResult.provider.id}` +
              `  [${peek.errorType}] ${peek.errorMessage}` +
              `  — retry ${peekRetries}/${MAX_STREAM_PEEK_RETRIES}`,
            );
            if (peekRetries >= MAX_STREAM_PEEK_RETRIES) {
              const classified = classifyStreamPeekFailure(peek.errorType, peek.errorMessage);
              // Only quarantine the provider after the stream start failed for
              // a real provider outage. Quota/rate/client errors should be
              // visible in logs without poisoning provider health.
              if (classified.type === 'provider_down') {
                circuitBreakers.recordFailure(streamResult.provider.id);
              }
              finalizeLog(requestId, t0, {
                endpoint: 'anthropic', model: request.model, streaming: true,
                toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
              }, {
                status: 'error',
                provider: streamResult.provider.id,
                providerKind: streamResult.provider.kind,
                resolvedModel: streamResult.model,
                attempts: streamResult.attempts.length,
                fallbacks: streamResult.attempts.filter((a) => !a.ok).length,
                error: `${classified.type}: ${peek.errorMessage}`,
              });
              metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: false, providerId: streamResult.provider.id, streaming: true, streamCompleted: false, fallback: streamResult.attempts.length > 1, inputTokens: 0, outputTokens: 0 });
              sendJson(res, 503, {
                error: { type: classified.type, upstreamType: peek.errorType, message: peek.errorMessage },
                gateway: { retries: peekRetries },
              });
              metrics.requestEnd();
              finalizeCorrelation(correlation.requestId);
              return;
            }
            await new Promise((r) => setTimeout(r, PEEK_BACKOFF_MS[peekRetries - 1] ?? 600));
            streamResult = await router.routeStream(request);
          }
        }

        const id = `msg_gw_${Date.now()}`;
        const created = Math.floor(Date.now() / 1000);

        // Register stream with lifecycle manager
        streamLifecycle.register({ id, requestId, providerId: streamResult.provider.id, model: streamResult.model, protocol: 'anthropic', startedAt: Date.now() });
        timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'stream.start', source: 'server', payload: { streamId: id, provider: streamResult.provider.id } });

        res.on('close', () => { streamLifecycle.clientDisconnected(id); });

        res.writeHead(200, SSE_HEADERS);
        await dispatchStream({
          upstream: streamResult.upstream,
          res,
          inboundProtocol: 'anthropic',
          providerKind: streamResult.provider.kind,
          completionId: id,
          created,
          model: streamResult.model,
          providerId: streamResult.provider.id,
        });
        res.end();

        streamLifecycle.complete(id);
        timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'stream.complete', source: 'server', payload: { streamId: id } });

        finalizeLog(requestId, t0, {
          endpoint: 'anthropic', model: request.model, streaming: true,
          toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
        }, {
          status: 'stream',
          provider: streamResult.provider.id,
          providerKind: streamResult.provider.kind,
          resolvedModel: streamResult.model,
          attempts: streamResult.attempts.length,
          fallbacks: streamResult.attempts.filter((a) => !a.ok).length,
        });

        metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: true, providerId: streamResult.provider.id, streaming: true, streamCompleted: true, fallback: streamResult.attempts.length > 1, inputTokens: 0, outputTokens: 0 });
        metrics.requestEnd();
        finalizeCorrelation(correlation.requestId);
        return;
      }

      const routed = await router.route(request);
      timeline.emit({ sessionId: correlation.sessionId, requestId, type: 'provider.success', source: 'server', payload: { provider: routed.response.providerId } });

      sendJson(res, 200, { ...universalToAnthropic(routed.response), gateway_attempts: routed.attempts });

      finalizeLog(requestId, t0, {
        endpoint: 'anthropic', model: request.model, streaming: false,
        toolCount: request.tools?.length ?? 0, inputMessages: request.messages.length,
      }, {
        status: 'ok',
        provider: routed.response.providerId,
        providerKind: config.providers.find((p) => p.id === routed.response.providerId)?.kind ?? null,
        resolvedModel: routed.response.model,
        attempts: routed.attempts.length,
        fallbacks: routed.attempts.filter((a) => !a.ok).length,
        finishReason: routed.response.finishReason,
        toolCallsReturned: countToolCalls(routed.response.content),
        inputTokens: routed.response.usage.inputTokens,
        outputTokens: routed.response.usage.outputTokens,
      });

      metrics.record({ timestamp: Date.now(), durationMs: Date.now() - t0, success: true, providerId: routed.response.providerId, streaming: false, toolCalls: countToolCalls(routed.response.content), fallback: routed.attempts.length > 1, inputTokens: routed.response.usage.inputTokens, outputTokens: routed.response.usage.outputTokens });
      metrics.requestEnd();
      finalizeCorrelation(correlation.requestId);
      return;
    }

    // ── Payload Inspector API ──────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/inspector') {
      sendJson(res, 200, { payloads: inspector.getRecent(50), stats: inspector.getStats() });
      return;
    }
    if (req.method === 'GET' && path === '/api/inspector/trace') {
      const requestId = url.searchParams.get('id');
      if (!requestId) { jsonError(res, 400, 'Missing ?id= parameter', 'missing_param'); return; }
      sendJson(res, 200, inspector.getFullTrace(requestId));
      return;
    }

    // ── Replay Debugger API ────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/replay') {
      sendJson(res, 200, { entries: replayDebugger.getAll(50), stats: replayDebugger.getStats() });
      return;
    }
    if (req.method === 'GET' && path === '/api/replay/failed') {
      sendJson(res, 200, { entries: replayDebugger.getFailed(50) });
      return;
    }
    if (req.method === 'GET' && path === '/api/replay/curl') {
      const id = url.searchParams.get('id');
      if (!id) { jsonError(res, 400, 'Missing ?id= parameter', 'missing_param'); return; }
      const curl = replayDebugger.generateCurl(id, `http://${config.host}:${config.port}`);
      if (!curl) { jsonError(res, 404, 'Replay entry not found', 'not_found'); return; }
      sendJson(res, 200, { curl });
      return;
    }

    // ── Capability Discovery API ───────────────────────────────────────
    if (req.method === 'GET' && path === '/api/discovery') {
      const cached = Object.fromEntries(discovery.getAllCached());
      sendJson(res, 200, { capabilities: cached });
      return;
    }
    if (req.method === 'POST' && path === '/api/discovery/refresh') {
      const results = await discovery.discoverAll(providers);
      sendJson(res, 200, { results });
      return;
    }

    // ── Compatibility Tests API ────────────────────────────────────────
    if (req.method === 'POST' && path === '/api/tests/compatibility') {
      const clientParam = url.searchParams.get('client');
      const testBaseUrl = `http://${config.host}:${config.port}`;
      const suites = clientParam
        ? [await runClientTests(clientParam, testBaseUrl)]
        : await runAllTests(testBaseUrl);
      sendJson(res, 200, { suites });
      return;
    }

    // ── Metrics API ────────────────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/metrics') {
      const orchestratorMetrics = router.getOrchestratorMetrics();
      const circuitStats = circuitBreakers.getStats();
      sendJson(res, 200, {
        ...metrics.getSummary(),
        orchestration: {
          ...orchestratorMetrics,
          description: 'Window-based rotating quota scheduler: NKQ(20)→OpusMax(60) per 5h window',
        },
        circuitBreakers: circuitStats,
        routing: {
          mode: config.mode,
          logStats: getLogStats(),
        },
      });
      return;
    }

    // ── Chaos Tests API ────────────────────────────────────────────────
    if (req.method === 'POST' && path === '/api/tests/chaos') {
      const testBaseUrl = `http://${config.host}:${config.port}`;
      const suite = await runChaosTests(testBaseUrl);
      sendJson(res, 200, { suite });
      return;
    }

    // ── Correlation Status API ─────────────────────────────────────────
    if (req.method === 'GET' && path === '/api/correlations') {
      sendJson(res, 200, { active: activeCorrelationCount() });
      return;
    }

    // ── Embeddings passthrough ─────────────────────────────────────────
    if (req.method === 'POST' && path === '/v1/embeddings') {
      const body = await readJsonBody<Record<string, unknown>>(req);
      const embProvider = providers.find(
        (p) => p.config.enabled && p.config.capabilities.embeddings && p.config.kind !== 'anthropic',
      );
      const key = embProvider?.activeKey;
      if (!embProvider || !key) {
        jsonError(res, 503, 'No active embedding-capable provider configured.', 'no_embedding_provider');
        return;
      }
      const upstream = await fetch(
        `${embProvider.config.baseURL.replace(/\/$/, '')}/embeddings`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.value}`, ...embProvider.config.headers },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(embProvider.config.timeoutMs),
        },
      );
      const text = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
      res.end(text);
      return;
    }

    jsonError(res, 404, [
      'Antigravity Universal AI Gateway — available endpoints:',
      '  GET  /                         Dashboard',
      '  GET  /runtime                  Runtime Operations Center (realtime)',
      '  GET  /health                   Status + provider health',
      '  GET  /v1/models                Model list (OpenAI format)',
      '  GET  /api/models/registry      Full model capability registry',
      '  GET  /api/logs                 Routing logs',
      '  GET  /api/logs/structured      Structured request logs with metrics',
      '  GET  /api/metrics              Orchestration + circuit breaker metrics',
      '  GET  /api/runtime/stream       SSE realtime orchestration stream',
      '  GET  /api/runtime/providers    Provider orchestration states',
      '  GET  /api/runtime/rotation     Current rotation state',
      '  GET  /api/runtime/quotas       Quota states',
      '  GET  /api/runtime/breakers     Circuit breaker states',
      '  GET  /api/runtime/health       Health + performance metrics',
      '  GET  /api/runtime/timeline     Orchestration event log',
      '  GET  /api/runtime/debug         Full diagnostic snapshot (candidates, errors, breakers)',
      '  GET  /api/runtime/quotas/live   Live quota state snapshot',
      '  GET  /api/runtime/providers/live Live provider + breaker state',
      '  GET  /api/runtime/rotation/live Live rotation state',
      '  GET  /api/runtime/window        Current 5-min rotation window',
      '  GET  /api/providers/status      Provider + key health (all providers)',
      '  GET  /api/providers/diagnostics Provider model/quota/key diagnostics',
      '  GET  /api/providers/rotation    Rotation state + feature flags',
      '  GET  /api/providers/logs        Recent routing attempt logs',
      '  POST /api/providers/keys/:id/disable        Disable a key',
      '  POST /api/providers/keys/:id/enable         Enable a key',
      '  POST /api/providers/keys/:id/reset-cooldown Reset cooldown',
      '  GET  /admin/keys                Admin: API Key Management Dashboard',
      '  GET  /api/admin/providers       Admin: Provider summary',
      '  GET  /api/admin/keys            Admin: All keys (masked)',
      '  POST /api/admin/keys            Admin: Add new key',
      '  PUT  /api/admin/keys/:id        Admin: Update key',
      '  DELETE /api/admin/keys/:id      Admin: Soft-delete key',
      '  POST /api/admin/keys/:id/test   Admin: Test key health',
      '  POST /api/admin/keys/:id/enable Admin: Enable key',
      '  POST /api/admin/keys/:id/disable Admin: Disable key',
      '  GET  /api/admin/audit           Admin: Audit log',
      '  POST /api/runtime/reset        Reset ALL quota + circuit breakers (operator)',
      '  POST /api/runtime/reset/:id    Reset single provider quota (operator)',
      '  POST /api/runtime/quota/reset/:provider/:keyId/:model  Reset single key+model quota entry (no restart)',
      '  POST /api/runtime/quota/reset/:provider              Reset all quota entries for provider (no restart)',
      '  GET  /api/runtime/provider/active  Active provider + translation info',
      '  POST /api/runtime/provider/switch  Hot-swap active provider { provider: id }',
      '  POST /api/runtime/provider/mode   Set control mode { mode: manual|assisted-auto }',
      '  GET  /api/runtime/provider/status Current provider control state',
      '  POST /v1/chat/completions      OpenAI-compatible completions',
      '  POST /v1/messages              Anthropic Messages API',
      '  POST /v1/embeddings            Embeddings passthrough',
    ].join('\n'), 'not_found');

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string }).code;
    if (code === 'BODY_TOO_LARGE') {
      try { if (!res.headersSent) jsonError(res, 413, message, 'body_too_large'); } catch { res.end(); }
      return;
    }
    if (code === 'ALL_PROVIDERS_FAILED') {
      const attemptedSources = (error as { attempted_sources?: unknown }).attempted_sources;
      try {
        if (!res.headersSent) {
          sendJson(res, 503, {
            error: {
              type: 'NO_AVAILABLE_QUOTA_SOURCE',
              message,
            },
            gateway: {
              attempted_sources: attemptedSources,
            },
          });
        } else {
          res.end();
        }
      } catch { res.end(); }
      return;
    }
    console.error(`[gateway] error:`, message);
    try {
      if (!res.headersSent) jsonError(res, 500, message);
      else res.end();
    } catch { res.end(); }
  }
});

// ── Track active connections for graceful shutdown ─────────────────────────
let activeConnections = 0;
let shuttingDown = false;

function gracefulShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[gateway] Received ${signal} — starting graceful shutdown`);
  console.log(`[gateway] Active connections: ${activeConnections}`);

  health.stop();
  streamLifecycle.stop?.();
  memoryGuard.stop?.();
  sessionRuntime.stop?.();
  supervisor.stop?.();
  aiRateLimiter.stop();
  adminRateLimiter.stop();

  server.close(() => {
    console.log('[gateway] Server closed — exiting');
    process.exit(0);
  });

  // Force exit after 30 s if connections don't drain
  setTimeout(() => {
    console.warn('[gateway] Force exit after 30s drain timeout');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[gateway] Port ${config.port} is already in use.`);
    console.error(`[gateway] Identify owner: Get-NetTCPConnection -LocalPort ${config.port} -State Listen | Select-Object OwningProcess`);
    console.error('[gateway] Stop the existing owner only after confirming it is not the active gateway.');
    process.exit(1);
  }
  // AbortError and timeout errors are request-level issues — log and continue, don't shut down.
  if (err.name === 'AbortError' || (err as Error).message?.includes('aborted') || (err as Error).message?.includes('timeout')) {
    console.warn('[gateway] uncaughtException (non-fatal, continuing):', err.message);
    return;
  }
  // ECONNRESET / EPIPE happen when clients disconnect mid-stream — not fatal.
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ENOTFOUND') {
    console.warn(`[gateway] network error (non-fatal): ${err.code} ${err.message}`);
    return;
  }
  console.error('[gateway] uncaughtException (fatal):', err);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  // Same non-fatal list as uncaughtException
  if (err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout')) {
    console.warn('[gateway] unhandledRejection (non-fatal):', err.message);
    return;
  }
  if ((err as NodeJS.ErrnoException).code === 'ECONNRESET' || (err as NodeJS.ErrnoException).code === 'EPIPE') {
    console.warn(`[gateway] unhandledRejection network (non-fatal): ${err.message}`);
    return;
  }
  console.error('[gateway] unhandledRejection:', reason);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[gateway] Port ${config.port} is already in use by another process.`);
    console.error(`[gateway] This startup will exit cleanly without opening another gateway process.`);
    console.error(`[gateway] Audit owner: Get-CimInstance Win32_Process -Filter "ProcessId = <PID>" | Select-Object ProcessId,CommandLine`);
    process.exit(1);
  }
  throw err;
});

// Always boot with antigravity (NKQ) as the active provider.
// setDefault() is a no-op if the operator has already switched via API.
providerControl.setDefault('antigravity');

server.listen(config.port, config.host, () => {
  const active = config.providers.filter((p) => p.enabled).map((p) => p.label).join(' → ') || 'none';
  const ctrl = providerControl.getStatus();
  const activeLabel = ctrl.activeProvider ?? active;
  console.log('\n┌─ Antigravity Universal AI Gateway ─────────────────────────────');
  console.log(`│  Dashboard         : http://${config.host}:${config.port}`);
  console.log(`│  Runtime OPS       : http://${config.host}:${config.port}/runtime`);
  console.log('│');
  console.log('│  ── ACTIVE PROVIDER ────────────────────────────────────────────');
  console.log(`│  ${activeLabel.toUpperCase().padEnd(20)} (switch at /runtime or POST /api/runtime/provider/switch)`);
  console.log('│');
  console.log('│  ── SINGLE GATEWAY PATH — NEVER CHANGE THIS IN IDEs ───────────');
  console.log(`│  All requests  →  http://${config.host}:${config.port}/v1`);
  console.log('│');
  console.log('│  IDE config (Cline / RooCode / Continue / Cursor / Claude Code):');
  console.log('│    Provider  : OpenAI Compatible');
  console.log(`│    Base URL  : http://${config.host}:${config.port}/v1`);
  console.log('│    API Key   : proxy');
  console.log('│    Model     : claude-opus-4-7');
  console.log('│');
  console.log('│  Claude Code env:');
  console.log(`│    ANTHROPIC_BASE_URL=http://${config.host}:${config.port}`);
  console.log('│');
  console.log('│  ⚠  Providers (NKQ, OpusMax) are gateway-internal backends.');
  console.log('│     Do NOT configure them directly in any IDE.');
  console.log('└────────────────────────────────────────────────────────────────\n');
});
