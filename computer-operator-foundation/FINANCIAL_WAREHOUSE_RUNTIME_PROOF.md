# FINANCIAL_WAREHOUSE_RUNTIME_PROOF

Status: **RUNTIME_PROOF_CAPTURED**
Date: 2026-06-26
Scope: Phase 3A Financial Warehouse MVP runtime evidence.

## Environment

| Field | Value |
|---|---|
| OS | Windows 11 |
| Python | 3.13.12 (tags/v3.13.12:1cbe481, Feb  3 2026) |
| Flask | 3.0.3 |
| Working directory | `d:\Project\computer-operator-foundation\financial-warehouse` |
| Bind address | `127.0.0.1:5177` |
| Evidence directory | `d:\Project\computer-operator-foundation\financial-warehouse\runtime-evidence\` |
| Wall-clock start | 2026-06-26 11:31:23 (Asia/Saigon) |
| Server PID | 35760 |

## Command

```bash
python d:\Project\computer-operator-foundation\financial-warehouse\run_evidence.py
```

This single command:
1. Started `app.py` in a child process (Python + Flask, loopback only).
2. Waited for `/health` to return HTTP 200.
3. Exercised every required endpoint with valid payloads.
4. Wrote `proof.json` with all responses.
5. Stopped the server cleanly.

## Endpoint Results — 14/14 Success

| # | Endpoint | Method | Status | Notes |
|---|---|---|---|---|
| 1 | `/health` | GET | 200 | `{"ok":true,"service":"financial-warehouse-mvp","ts":"..."}` |
| 2 | `/sources/register` (quickbooks) | POST | 201 | classified STALE / health DEGRADED |
| 3 | `/sources/register` (accounting_engine) | POST | 201 | LIVE / HEALTHY |
| 4 | `/sources/register` (toast) | POST | 201 | MISSING / UNKNOWN |
| 5 | `/sources/register` (doordash) | POST | 201 | MISSING / UNKNOWN |
| 6 | `/sources/register` (payroll) | POST | 201 | MISSING / UNKNOWN |
| 7 | `/sources/register` (ga4) | POST | 201 | MISSING / UNKNOWN |
| 8 | `/sources/register` (gsc) | POST | 201 | MISSING / UNKNOWN |
| 9 | `/sources/register` (gbp) | POST | 201 | BLOCKED / UNKNOWN |
| 10 | `/sources` | GET | 200 | count=8 |
| 11 | `/snapshots/register` (accounting_engine) | POST | 201 | snapshot_id=`ae-2026-06-26-health`, confidence=MEDIUM |
| 12 | `/snapshots/register` (quickbooks) | POST | 201 | snapshot_id=`qb-2026-06-20-daily`, confidence=LOW (simulated stale) |
| 13 | `/freshness` | GET | 200 | count=8 |
| 14 | `/runtime-proof` | GET | 200 | `FINANCIAL_WAREHOUSE_MVP_OPERATIONAL`, sources=8, snapshots=2 |

## Captured Payloads (highlights)

### GET /health

```json
{
  "ok": true,
  "service": "financial-warehouse-mvp",
  "ts": "2026-06-26T04:31:23.228739+00:00"
}
```

### GET /sources

```json
{
  "count": 8,
  "sources": [
    {"source_id": "quickbooks", "source_name": "QuickBooks Desktop", "owner": "finance", "classification": "STALE", "health": "DEGRADED", "registered_at": "2026-06-26T04:31:23.240756+00:00", "notes": ""},
    {"source_id": "accounting_engine", "source_name": "Accounting Engine (port 8844)", "owner": "data_engineering", "classification": "LIVE", "health": "HEALTHY", "registered_at": "2026-06-26T04:31:23.262562+00:00", "notes": ""},
    {"source_id": "toast", "source_name": "Toast POS", "owner": "operations", "classification": "MISSING", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.271169+00:00", "notes": ""},
    {"source_id": "doordash", "source_name": "DoorDash Merchant", "owner": "operations", "classification": "MISSING", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.279615+00:00", "notes": ""},
    {"source_id": "payroll", "source_name": "Payroll System", "owner": "hr_finance", "classification": "MISSING", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.307760+00:00", "notes": ""},
    {"source_id": "ga4", "source_name": "Google Analytics 4", "owner": "marketing", "classification": "MISSING", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.339149+00:00", "notes": ""},
    {"source_id": "gsc", "source_name": "Google Search Console", "owner": "marketing", "classification": "MISSING", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.347347+00:00", "notes": ""},
    {"source_id": "gbp", "source_name": "Google Business Profile Reviews", "owner": "marketing", "classification": "BLOCKED", "health": "UNKNOWN", "registered_at": "2026-06-26T04:31:23.356130+00:00", "notes": ""}
  ]
}
```

### POST /snapshots/register (accounting_engine)

```json
{
  "source_id": "accounting_engine",
  "snapshot_id": "ae-2026-06-26-health",
  "snapshot_at": "2026-06-26T04:31:23.410805+00:00",
  "record_count": 1,
  "confidence": "MEDIUM",
  "notes": "Heartbeat snapshot from local probe"
}
```

### GET /freshness

8 rows returned. Highlights:

```json
{
  "count": 8,
  "freshness": [
    {"source_id": "quickbooks", "source_name": "QuickBooks Desktop", "last_seen": "2026-06-26T04:31:23.432072+00:00", "age": "PT0S", "health": "LIVE", "status": "LIVE"},
    {"source_id": "accounting_engine", "source_name": "Accounting Engine (port 8844)", "last_seen": "2026-06-26T04:31:23.410805+00:00", "age": "PT0S", "health": "LIVE", "status": "LIVE"},
    {"source_id": "toast", "source_name": "Toast POS", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "MISSING"},
    {"source_id": "doordash", "source_name": "DoorDash Merchant", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "MISSING"},
    {"source_id": "payroll", "source_name": "Payroll System", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "MISSING"},
    {"source_id": "ga4", "source_name": "Google Analytics 4", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "MISSING"},
    {"source_id": "gsc", "source_name": "Google Search Console", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "MISSING"},
    {"source_id": "gbp", "source_name": "Google Business Profile Reviews", "last_seen": null, "age": null, "health": "UNKNOWN", "status": "BLOCKED"}
  ]
}
```

### GET /runtime-proof

```json
{
  "status": "FINANCIAL_WAREHOUSE_MVP_OPERATIONAL",
  "ts": "2026-06-26T04:31:23.465090+00:00",
  "sources": 8,
  "snapshots": 2,
  "evidence_log": "D:\\Project\\computer-operator-foundation\\financial-warehouse\\runtime-evidence\\warehouse.jsonl"
}
```

## Evidence Files on Disk

| File | Purpose |
|---|---|
| `runtime-evidence/proof.json` | Full request/response log (this run) |
| `runtime-evidence/warehouse.jsonl` | Append-only audit log of every event |
| `runtime-evidence/warehouse.stdout.log` | Flask process stdout/stderr |
| `warehouse.db.json` | Persisted warehouse state (sources / snapshots / freshness) |

## Capabilities Demonstrated

- Source registration → 8 sources registered, persisted, retrievable.
- Snapshot registration → 2 snapshots registered, freshness promoted to LIVE.
- Freshness tracking → `GET /freshness` returns all 8 rows with correct status transitions.
- Health tracking → `/health` returns 200, `/runtime-proof` returns status assertion.

## What Was NOT Done (CTO rule)

- No QuickBooks writes.
- No payroll writes.
- No Toast/DoorDash portal automation.
- No dashboards rendered.
- No forecasting, profit, or labor calculations executed.

This is the data foundation. Everything downstream reads from it.
