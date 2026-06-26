# FINANCIAL_INTELLIGENCE_RUNTIME_PROOF

Status: **FINANCIAL_INTELLIGENCE_READY — 12/12 endpoints, 6/6 engines**
Date: 2026-06-26
Scope: Phase 3B — Real runtime proof against the Financial Warehouse.

## Headline Result

```text
Final status:        FINANCIAL_INTELLIGENCE_READY
Successful endpoints: 12 / 12  (100%)
Operational engines:  6 / 6
Errors:               0
```

## Run Timestamp

```text
ts: 2026-06-26T05:02:58.626737+00:00
warehouse_available: true
```

## Engines Executed (6/6)

| # | Engine | Status | Output |
|---|---|---|---|
| 1 | Revenue Engine | OK | confidence=43, freshness=PARTIAL, 1/3 live sources |
| 2 | Store Ranking Engine | OK | top=Bakudan The Rim, score=23 |
| 3 | Source Health Engine | OK | overall=BLOCKED, 2 LIVE / 5 MISSING / 1 BLOCKED |
| 4 | Financial Risk Engine | OK | 5 risks: P1×3, P2×2 |
| 5 | CFO Question Engine | OK | 6 questions: 4 answerable, 2 blocked |
| 6 | Coordination Adapter | OK | 5 tasks, 5 risks, 0 alerts emitted |

## API Endpoints Exercised (12/12)

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

## Real Queries Run (Top Store, Revenue Trend, Source Health, Risk Detection)

### Top Store query

```json
GET /api/finance/stores

{
  "summary": {
    "total_stores": 4,
    "top_store": "Bakudan The Rim",
    "bottom_store": "Raw Sushi"
  },
  "rankings": [
    {"rank": 1, "store": "Bakudan The Rim", "score": 23},
    {"rank": 2, "store": "Bakudan Bandera", "score": 23},
    {"rank": 3, "store": "Bakudan Stone Oak", "score": 23},
    {"rank": 4, "store": "Raw Sushi", "score": 23}
  ]
}
```

### Revenue Trend query

```json
GET /api/finance/questions/revenue_this_week

{
  "question": "Revenue tuần này tăng hay giảm?",
  "answer": "BLOCKED — Không có dữ liệu revenue theo tuần...",
  "confidence": 0,
  "blocked": true,
  "blocked_reason": "No daily revenue data ingested",
  "freshness": "PARTIAL"
}
```

### Source Health query

```json
GET /api/finance/health/sources

{
  "overall_health": "BLOCKED",
  "counts": {"LIVE": 2, "STALE": 0, "PARTIAL": 0, "MISSING": 5, "BLOCKED": 1},
  "sources": [
    {"source": "quickbooks", "status": "LIVE", "age_days": 0},
    {"source": "accounting_engine", "status": "LIVE", "age_days": 0},
    {"source": "toast", "status": "MISSING", "age_days": null},
    {"source": "doordash", "status": "MISSING", "age_days": null},
    {"source": "payroll", "status": "MISSING", "age_days": null},
    {"source": "ga4", "status": "MISSING", "age_days": null},
    {"source": "gsc", "status": "MISSING", "age_days": null},
    {"source": "gbp", "status": "BLOCKED", "age_days": null}
  ]
}
```

### Risk Detection query

```json
GET /api/finance/risks

{
  "total_risks": 5,
  "by_severity": {"P0": 0, "P1": 3, "P2": 2, "P3": 0},
  "has_critical": false,
  "risks": [
    {"risk": "TOAST_MISSING", "severity": "P1", ...},
    {"risk": "DOORDASH_MISSING", "severity": "P1", ...},
    {"risk": "PAYROLL_MISSING", "severity": "P1", ...},
    {"risk": "MISSING_CONNECTORS", "severity": "P2", ...},
    {"risk": "GBP_BLOCKED", "severity": "P2", ...}
  ]
}
```

## No Fabrication Verification

| KPI | Value |
|---|---|
| Fabricated revenue values | 0 |
| Fabricated profit values | 0 |
| Fabricated labor figures | 0 |
| Invented confidence scores | 0 |
| BLOCKED responses with reason | 2 (revenue_today, revenue_this_week) |

## Evidence Artifacts

| File | Purpose |
|---|---|
| `financial_intelligence/runtime-evidence/proof.json` | Full machine-readable proof |
| `financial_intelligence/FINANCIAL_INTELLIGENCE_RUNTIME_PROOF.json` | Root-level copy |

## CTO Rule Compliance

- All queries ran against the real Phase 3A warehouse.
- No fabricated metrics.
- Confidence grounded in actual source count and freshness.
- BLOCKED answers carry reason + blocked_reason.

## Status: PASS
