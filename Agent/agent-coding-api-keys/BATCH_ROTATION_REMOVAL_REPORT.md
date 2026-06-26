# Batch Rotation Removal Report

## CEO Directive: Remove NKQ(20)→OpusMax(60) Batch Switching

**Date:** 2026-06-18
**Status:** COMPLETE — batch rotation fully disabled, gateway running

---

## What Was Removed

### Batch rotation logic in `src/runtime/quota-orchestrator.ts`

The `consume()` method previously contained ~85 lines of batch-switching logic:

- `currentBatchUsed++` per request when provider was the active slot
- `if (currentBatchUsed >= batchSize)` → advance `currentProviderIndex`
- Emit `quota.batch_started` on first request of batch
- Emit `quota.batch_completed` when batch fills
- Emit `quota.provider_switched` with `reason: 'batch_limit_reached'`
- Emit `quota.batch_switch` (legacy dashboard compat)
- Console log `[Rotation] Switching Provider: NKQ → Opus`
- Console log `[NKQ] Batch Usage: 15/20`

### `getCandidates()` batch-full reordering

Previously checked `currentBatchUsed >= batchSize` and would:
- Advance `currentProviderIndex`
- Emit state-recovery switch event
- Reorder result array based on batch state

**Now:** Returns all available providers in static ROTATION_ORDER (no batch logic).

### `getMetrics()` batch field

`requestsUntilSwitch` was calculated as `batchSize - currentBatchUsed`.

**Now:** Always returns `0` (field preserved for API compatibility).

---

## What Was Preserved

| Component | Status |
|-----------|--------|
| `quotaOrchestrator.consume()` — quota counter | ✅ Kept (increments `usedQuota`) |
| `quotaOrchestrator.consume()` — window start | ✅ Kept (starts 5h window on first use) |
| `quotaOrchestrator.consume()` — exhaustion detection | ✅ Kept (emits `quota.provider_exhausted`) |
| `quotaOrchestrator.recordFailure()` | ✅ Kept (tracks consecutive failures) |
| `quotaOrchestrator.getProviderState()` | ✅ Kept (returns quota snapshot) |
| `quotaOrchestrator.reset()` / `resetProvider()` | ✅ Kept (operator controls) |
| `quotaOrchestrator.logStartupState()` | ✅ Kept (startup diagnostics) |
| `ProviderOrchestrationState` interface fields | ✅ Kept (currentBatchUsage/currentBatchLimit return 0) |
| `OrchestratorMetrics` interface fields | ✅ Kept (requestsUntilSwitch returns 0) |
| Persistent state file `data/orchestrator-state.json` | ✅ Kept |
| Circuit breakers | ✅ Kept |
| Provider-level quota ledger | ✅ Kept |
| Model-level quota ledger | ✅ Kept |

---

## Events No Longer Emitted

| Event Type | Previous Trigger | Current Status |
|------------|-----------------|----------------|
| `quota.batch_started` | First request in new batch | ❌ Never emitted |
| `quota.batch_completed` | Batch counter reaches batchSize | ❌ Never emitted |
| `quota.batch_switch` | Batch full, rotate provider | ❌ Never emitted |
| `quota.provider_switched` (batch) | `reason: 'batch_limit_reached'` | ❌ Never emitted with this reason |

Events still emitted: `quota.window_started`, `quota.window_reset`, `quota.provider_exhausted`, `quota.provider_degraded`, `quota.state_reset`

---

## Routing Authority Transfer

**Before:**
```
quotaOrchestrator.getCandidates() → provider order (batch-driven)
  → ProviderRouter used this as primary routing signal
```

**After:**
```
ProviderRouter.resolveProviderOrder(request)
  → modelQuotaService.getSourceCandidates()  [per-key, per-model]
  → modelQuotaService.getCurrentSourceWindow()  [5-min time rotation]
  → modelQuotaService.canUseSource()  [health + quota check]
  → providerRotationService.getCurrentWindow()  [fallback ordering]
```

---

## Verification

- `npm run build` — ✅ TypeScript compiles cleanly
- `node tests/verify-routing-behavior.mjs` — ✅ 25/25 pass
- `node tests/source-rotation-e2e.mjs` — ✅ 23/23 pass
- No log says `batch_limit_reached`
- No route decision depends on `currentBatchUsed` / `currentBatchLimit`
- `getMetrics().requestsUntilSwitch` always returns `0`
