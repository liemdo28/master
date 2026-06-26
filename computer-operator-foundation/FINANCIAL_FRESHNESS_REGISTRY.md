# FINANCIAL_FRESHNESS_REGISTRY

Status: **REGISTRY_DESIGNED**
Date: 2026-06-26
Scope: Phase 3A freshness layer — every financial source must report last update, age, freshness, and health so Mi knows when data is trustworthy.

## Registry Schema

Each row in the freshness registry must include:

| Column | Type | Description |
|---|---|---|
| `source_id` | string | Stable id (e.g. `quickbooks`, `toast`, `doordash`, `payroll`, `ga4`, `gsc`, `gbp`) |
| `source_name` | string | Human readable label |
| `last_seen` | ISO 8601 UTC | Timestamp of last successful data ingestion or heartbeat |
| `age` | ISO 8601 duration | Time since `last_seen` |
| `freshness` | enum | `LIVE`, `STALE`, `PARTIAL`, `MISSING`, `BLOCKED` |
| `health` | enum | `HEALTHY`, `DEGRADED`, `DOWN`, `UNKNOWN` |
| `status` | string | Human-readable summary suitable for dashboards |
| `expected_cadence` | string | Expected update frequency (`daily`, `hourly`, `weekly`, etc.) |
| `last_refresh_at` | ISO 8601 UTC | When the freshness row itself was last computed |
| `owner` | string | Source owner role |

## Status Classification Rules

| Freshness | Rule |
|---|---|
| LIVE | `age <= expected_cadence` AND health ∈ {HEALTHY, DEGRADED} |
| STALE | `age > 2 × expected_cadence` OR health = DEGRADED for >1 cycle |
| PARTIAL | Some downstream entities present, others missing |
| MISSING | Source registered but no snapshot ever received |
| BLOCKED | Source identified but cannot be ingested (credential, approval, contract) |

## Initial Snapshot (Phase 3A)

These rows represent what Mi can assert today after Phase 3A warehouse bootstrap.

```text
GA4               2 hours            LIVE
GSC               1 day              LIVE
QB                6 days             STALE
Payroll           ---                MISSING
Toast             ---                MISSING
DoorDash          ---                MISSING
AccountingEngine  just now           LIVE  (heartbeat only)
GBPReviews        ---                BLOCKED (no API access)
```

The MVP warehouse MVP implements this registry as a JSON-backed table at
`financial-warehouse/warehouse.db.json` (key: `freshness`).

## API Surface

```text
GET  /freshness                       — list all rows
POST /sources/register                — adds a source row, seeds freshness
POST /snapshots/register              — refreshes freshness row to LIVE
```

## Alert Policy

When `freshness` transitions to STALE or MISSING for any source classified as
revenue-critical (`quickbooks`, `toast`, `doordash`, `payroll`):

1. Phase 0 Coordination creates a FIN task ("source X is stale").
2. Owner = Data Engineering Lead.
3. Priority = Medium-High.
4. Evidence = snapshot log line + heartbeat payload.
5. Dashboard widget "Stale Data Alerts" displays the row.

## Refresh Strategy

| Source | Cadence | Refresh Mechanism |
|---|---|---|
| QuickBooks | daily | QB Web Connector → staging CSV → warehouse POST |
| Toast | hourly during business hours | Toast API or portal automation → warehouse POST |
| DoorDash | daily | portal automation → warehouse POST |
| Payroll | biweekly | provider CSV → warehouse POST |
| GA4 | daily | GA4 Data API → warehouse POST |
| GSC | daily | GSC API → warehouse POST |
| GBP Reviews | daily | GBP API → warehouse POST |
| Accounting Engine (8844) | heartbeat | local HTTP /health probe |

## Storage Note

Phase 3A stores freshness rows in JSON for fast local bootstrap. Phase 3B
migration to DuckDB keeps the same column names to avoid downstream rework.
