# Phase 19 — Executive Simulation — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-19-executive-simulation/src/` (`engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class ExecutiveSimulation` |
| **API route** | `GET /api/agent-os/19` (loadable; summary = API surface) |
| **OSS used** | StatsForecast (forecasting), DuckDB (analytics) — **SELECTED, NOT_INTEGRATED** (Prophet rejected as default) |
| **Division mapping** | Finance (primary) · Marketing · Executive |
| **Input schema** | `runDecision({ downsidePenalty? })`; `validateAssumption(id)`; scenarios defined via `scenarios.define(...)` |
| **Output schema** | `{ risks[], comparison{ ranking[], winner } }` |
| **Evidence produced** | assumptions / scenarios / forecasts stores |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **18/18 PASS** |
| **Status** | **READY** (engine + runtime) · confidence-engine **PARTIAL** · OSS **PARTIAL** |

## Capabilities proven
- assumption registry (with validated flag) ✅
- forecast engine (series grows 10%, total sums series) ✅
- scenario engine (optimistic > baseline > pessimistic) ✅
- simulation risk engine (optimistic at-risk on unvalidated churn assumption; pessimistic severe-downside alert; healthy after validation) ✅
- decision comparison (ranking of 3; winner = highest EV; pessimistic penalized for downside) ✅
- persistence across restart ✅

## Honest notes
- "Confidence engine" is **PARTIAL**: risk evaluation + EV ranking are present, but there is no standalone confidence-scoring engine.
- Forecasting is an in-engine linear/growth model; StatsForecast/DuckDB are the governed-but-unwired substrate.
