# CFO_DASHBOARD_API_PROOF

Status: **OPERATIONAL — 12/12 endpoints green**
Date: 2026-06-26
Scope: Phase 3B — CFO Dashboard API proof.

## Summary

The CFO Dashboard API exposes the Financial Intelligence Engine through
read-only HTTP endpoints. All endpoints are **warehouse-backed** and
**evidence-aware**. The API never writes to the warehouse or to any
production system.

## Service

```text
Listening on:  http://127.0.0.1:5178
Service name:  financial-intelligence-engine
```

## Required Endpoints (per directive)

| Method | Path | Status |
|---|---|---|
| GET | `/api/finance/health` | 200 |
| GET | `/api/finance/revenue` | 200 |
| GET | `/api/finance/stores` | 200 |
| GET | `/api/finance/risks` | 200 |
| GET | `/api/finance/questions` | 200 |

## Additional Endpoints Implemented

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/finance/questions/<id>` | Single CFO question |
| GET | `/api/finance/health/sources` | Per-source health detail |
| GET | `/api/finance/coordination` | Coordination signals |
| GET | `/api/finance/runtime-proof` | Engine self-assertion |

## Live Endpoint Run (12/12 green)

```text
    [OK] GET /api/finance/health                       -> 200
    [OK] GET /api/finance/revenue                      -> 200
    [OK] GET /api/finance/stores                       -> 200
    [OK] GET /api/finance/risks                        -> 200
    [OK] GET /api/finance/questions                    -> 200
    [OK] GET /api/finance/questions/revenue_today      -> 200
    [OK] GET /api/finance/questions/best_store         -> 200
    [OK] GET /api/finance/questions/stale_sources      -> 200
    [OK] GET /api/finance/questions/financial_risks    -> 200
    [OK] GET /api/finance/health/sources               -> 200
    [OK] GET /api/finance/coordination                 -> 200
    [OK] GET /api/finance/runtime-proof                -> 200
```

100% endpoint success rate.

## Sample Response Payloads

### `/api/finance/health`

```json
{
  "ok": true,
  "service": "financial-intelligence-engine",
  "warehouse_reachable": true,
  "ts": "2026-06-26T05:03:01.000Z",
  "engines": {
    "revenue_engine": "ok",
    "store_ranking_engine": "ok",
    "source_health_engine": "ok",
    "financial_risk_engine": "ok",
    "cfo_question_engine": "ok",
    "coordination_adapter": "ok"
  }
}
```

### `/api/finance/risks`

```json
{
  "total_risks": 5,
  "by_severity": {"P0": 0, "P1": 3, "P2": 2, "P3": 0},
  "has_critical": false,
  "risks": [
    {"risk": "TOAST_MISSING", "severity": "P1", "description": "..."},
    ...
  ]
}
```

### `/api/finance/runtime-proof`

```json
{
  "status": "FINANCIAL_INTELLIGENCE_ENGINE_OPERATIONAL",
  "warehouse_available": true,
  "engines_operational": ["revenue_engine", "store_ranking_engine", ...],
  "questions_answered": 6,
  "questions_answerable": 4,
  "questions_blocked": 2,
  "risks_detected": 5,
  "source_health_overall": "BLOCKED"
}
```

## Architecture Compliance

- **Read only** — no POST/PUT/DELETE endpoints.
- **Warehouse backed** — every endpoint reads from the warehouse or its in-memory caches.
- **Evidence aware** — responses include `confidence`, `sources`, `freshness`.
- **No fabrication** — blocked answers return BLOCKED with reason.

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/dashboard_api.py` | Flask app with all endpoints |

## CTO Rule Compliance

- No write endpoints exposed.
- Every response includes freshness and source provenance.
- `/runtime-proof` exposes current operational state.

## Status: PASS
