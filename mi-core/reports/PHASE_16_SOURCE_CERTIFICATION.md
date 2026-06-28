# Phase 16 — Multi-Location OS — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-16-multi-location-os/src/` (`engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class MultiLocationOS` |
| **API route** | `GET /api/agent-os/16` (live summary → `fleetReport()`) |
| **OSS used** | Metabase (KPI dashboards) — **SELECTED, NOT_INTEGRATED** (AGPL flagged; Superset rollback) |
| **Division mapping** | Operations (primary) · Finance · Marketing |
| **Input schema** | `provisionBrand(brand, locations[])`; `observe(locationId, metrics)`; `brandReport(brandId)`; `fleetReport()` |
| **Output schema** | `{ snapshot, risk{ status, alerts } }` · brand report `{ brandName, locationCount, rollup, atRisk[], healthy }` · fleet report (array) |
| **Evidence produced** | brands / locations / kpi-snapshots / permissions stores (persist across restart) |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **24/24 PASS** |
| **Status** | **READY** (engine + runtime) · OSS **PARTIAL** |

## Capabilities proven
- location registry ✅ · brand registry ✅
- store permission engine (location-scoped grant; denied at other location / ungranted capability) ✅
- location KPI layer (rollup sums revenue, averages rating) ✅
- location risk engine (healthy vs at-risk, alerts for revenue/rating below threshold) ✅
- multi-location + fleet reports (per-brand entries) ✅
- persistence across restart (brands, locations, KPIs, permissions) ✅

## Honest notes
- KPI rollups are computed in-engine; Metabase/Superset are the governed-but-unwired visualization substrate. License risk (AGPL) is flagged in the OSS manifest.
