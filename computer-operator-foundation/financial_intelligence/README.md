# Financial Intelligence Engine — Phase 3B

Sits on top of the **Financial Warehouse** (Phase 3A) and answers CFO questions
with evidence-based confidence.

**CTO Rule**: Never fabricate data. If a source is missing, return BLOCKED.
If freshness is low, lower confidence. No forecasting. No AI predictions.

## Architecture

```text
QuickBooks → ┐
Payroll    → │
Toast      → ├── Financial Warehouse (Phase 3A, port 5177)
DoorDash   → │      ↓
GA4        → ├──────┴── Financial Intelligence Engine (Phase 3B, port 5178)
GSC        → │            ↓
GBP        → ┘      CFO Dashboard APIs
                         ↓
                   Executive Coordination
```

## Engines

| Engine | Purpose |
|---|---|
| `revenue_engine` | Revenue aggregation, trend, freshness awareness |
| `store_ranking_engine` | Score and rank stores |
| `source_health_engine` | Evaluate LIVE/STALE/PARTIAL/MISSING/BLOCKED |
| `financial_risk_engine` | Detect P0–P3 financial risks |
| `cfo_question_engine` | Route CFO questions to answer engines |
| `coordination_adapter` | Emit tasks/risks/alerts to Executive Coordination |

## Endpoints (port 5178)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/finance/health` | Engine health check |
| GET | `/api/finance/revenue` | Revenue intelligence |
| GET | `/api/finance/stores` | Store rankings |
| GET | `/api/finance/risks` | Financial risks |
| GET | `/api/finance/questions` | All CFO questions |
| GET | `/api/finance/questions/<id>` | One specific question |
| GET | `/api/finance/health/sources` | Source health |
| GET | `/api/finance/coordination` | Coordination signals |
| GET | `/api/finance/runtime-proof` | Runtime proof payload |

## CFO Questions Supported

| ID | Vietnamese |
|---|---|
| `revenue_today` | Revenue hôm nay bao nhiêu? |
| `revenue_this_week` | Revenue tuần này tăng hay giảm? |
| `best_store` | Store nào lời nhất? |
| `stale_sources` | Nguồn tài chính nào đang stale? |
| `financial_risks` | Rủi ro tài chính hiện tại? |
| `weekly_summary` | Tuần này cần chú ý tài chính gì? |

## Run

```bash
# 1. Start warehouse (Phase 3A)
cd ../financial-warehouse
python app.py &
# listens on http://127.0.0.1:5177

# 2. Start financial intelligence (Phase 3B)
cd ../financial-intelligence
python -m pip install -r requirements.txt
python run_runtime_proof.py
# or run dashboard_api.py for the API server on port 5178
```

## Safety

- Read-only against warehouse. No writes.
- No raw financial data sent to coordination — only derived signals.
- Confidence lowered on STALE data, BLOCKED on MISSING data.
