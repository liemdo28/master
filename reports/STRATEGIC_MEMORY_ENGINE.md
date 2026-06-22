# STRATEGIC_MEMORY_ENGINE — Phase 18
**Target:** STRATEGIC_MEMORY_READY ✅

## What It Does
Provides months-to-years business intelligence from Operational Memory (Phase 15).
Mi can answer: "Tháng nào blockers nhiều nhất?", "Dev1 hiệu quả không?", "Xu hướng 3 tháng?"

## Engines

### `strategic-memory-engine.ts`
| Function | Returns |
|----------|---------|
| `getStrategicSummary(days)` | Overall health: executions, success rate, top performer, trend |
| `getMonthlySnapshots(months)` | Per-month breakdown: executions, success, incidents, top project |
| `getOwnerHistory(role, days)` | Owner activity: pass rate, top actions, busiest period |
| `getTopBlockerProjects(days, n)` | Projects with most incidents, ranked by impact |

### `temporal-trend-engine.ts`
| Function | Returns |
|----------|---------|
| `analyzeTemporalTrends(months)` | Velocity change, reliability trends, blocker patterns, owner overload detection |

### Patterns Detected
- `velocity_increase` / `velocity_decrease` — execution rate change >20%
- `reliability_decline` — success rate drop >10%
- `blocker_pattern` — same project blocking repeatedly
- `owner_overload` — single role >80% of all actions

## API Routes
```
GET /api/strategic/summary?days=90
GET /api/strategic/monthly?months=3
GET /api/strategic/owner/:role?days=30
GET /api/strategic/blockers?days=30&top=5
GET /api/strategic/trends?months=3
```
