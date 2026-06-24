# Quota Routing Cleanup Audit

## CEO Directive: Remove Batch Rotation Safely

**Date:** 2026-06-18
**Status:** COMPLETE

---

## Files Changed

| File | Change |
|------|--------|
| `src/runtime/quota-orchestrator.ts` | Removed batch rotation from `consume()`, neutralized `getCandidates()`, `getMetrics()` returns `requestsUntilSwitch: 0` always |
| `src/dashboard/provider-runtime-panel/index.ts` | Dashboard "Active Rotation" panel now shows quota usage instead of batch progress |
| `tests/source-rotation-e2e.mjs` | New test suite covering all 7 required scenarios (A–G) |

## Removed Batch Logic

The following logic was **removed** from `quota-orchestrator.ts`:

1. `consume()` no longer increments `currentBatchUsed`
2. `consume()` no longer emits `quota.batch_started`
3. `consume()` no longer emits `quota.batch_completed`
4. `consume()` no longer emits `quota.batch_switch`
5. `consume()` no longer emits `quota.provider_switched` with reason `batch_limit_reached`
6. `consume()` no longer advances `currentProviderIndex` based on batch count
7. `getCandidates()` no longer checks `currentBatchUsed >= batchSize` for reordering
8. `getCandidates()` no longer performs state-recovery switches
9. `getMetrics()` now returns `requestsUntilSwitch: 0` (hardcoded)

## Current Routing Authority

```
Request from Cline/tool
  → ProviderRouter.route() / routeStream()
    → resolveProviderOrder(request)
      → modelQuotaService.getSourceCandidates(providerId, keys, model, resolvedModel)
      → modelQuotaService.getCurrentSourceWindow(sourceIds)  [5-min rotation]
      → modelQuotaService.canUseSource(candidate)
    → tryProviderWithKeys(providerId, request, streaming, attemptedSourceIds)
      → for each source candidate (window-ordered):
        → attempt request
        → if fail: markSourceFailure(), try next source
      → if all sources fail: try next provider
    → if all providers fail:
      → return NO_AVAILABLE_QUOTA_SOURCE with attempted_sources
```

## Source Candidate Order Example

For a request to `claude-opus-4-7` at 17:33 (window ID based on time):

```
1. nkq-key2-opus-4-7    (antigravity, primary NKQ key)
2. nkq-key2-opus-4-6    (antigravity, fallback model)
3. nkq-key1-opus-4-7    (antigravity, legacy key)
4. nkq-key1-opus-4-6    (antigravity, legacy key fallback)
5. opusmax-db18-opus-4-7 (opusmax key1)
6. opusmax-db19-opus-4-7 (opusmax key2)
7. opusmax-db16-opus-4-7 (opusmax Pro key)
```

Order rotates every 5 minutes based on `modelQuotaService.getCurrentSourceWindow()`.

## Failed-Source Fallback Proof

When source `nkq-key2-opus-4-7` returns HTTP 429 (quota_exceeded):
1. Source marked exhausted via `modelQuotaService.markExhausted()`
2. Source health set to `exhausted` with 1h cooldown
3. Router immediately tries next candidate `nkq-key2-opus-4-6`
4. No 5-minute wait — fallback is instant within the same request

## Test Results

```
tests/verify-routing-behavior.mjs:  25 passed, 0 failed
tests/source-rotation-e2e.mjs:     23 passed, 0 failed
```

## Preserved Components

- Per-key/per-model quota ledger (model-quota-state.json)
- Provider-level quota tracking (orchestrator-state.json)
- 5-hour rolling reset windows
- Circuit breakers (per-provider)
- Source health tracking (cooldown, disabled, exhausted states)
- Dashboard API compatibility (currentBatchUsage/currentBatchLimit fields still returned)
