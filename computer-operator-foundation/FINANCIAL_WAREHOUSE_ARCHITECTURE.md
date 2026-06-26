# FINANCIAL_WAREHOUSE_ARCHITECTURE

Status: **ARCHITECTURE_SELECTED**
Date: 2026-06-26
Scope: Phase 3A warehouse engine selection and high-level architecture.

## Candidate Engines

### 1. DuckDB
- Embedded OLAP engine, columnar, single binary.
- Excellent for analytics on CSV / Parquet / JSON.
- Reads remote (S3, HTTPS) via extensions.
- Phase 3A target: **SELECTED**.

### 2. SQLite
- Embedded OLTP-style engine, row store.
- Battle-tested, ubiquitous, single-file.
- Adequate for small data; weaker for analytics at scale.

### 3. PostgreSQL
- Full server RDBMS, transactional + analytical.
- Production-grade, scales horizontally with extensions.
- Requires infrastructure: host, backups, monitoring, network.

## Decision Matrix

| Criterion (weight) | DuckDB | SQLite | PostgreSQL |
|---|---|---|---|
| Analytics suitability (high) | 9 | 5 | 8 |
| Local deployment simplicity (high) | 10 | 10 | 3 |
| Maintenance burden (medium) | 9 | 10 | 4 |
| Performance on CSV/Parquet (high) | 10 | 5 | 6 |
| Future scalability (medium) | 7 | 4 | 10 |
| Ecosystem (dbt, Metabase) (high) | 8 | 7 | 9 |
| Cost (medium) | 10 | 10 | 5 |

Weighted scores (out of 10): DuckDB **9.0**, SQLite **7.0**, PostgreSQL **6.3**.

## Decision

**DuckDB is selected** as the primary warehouse engine for Phase 3A and Phase 3B.

Justification:
- Analytics workload dominates the financial intelligence layer (sum, group-by, window functions, time series).
- Local deployment is required for Phase 3A runtime proof — DuckDB is a single embedded binary.
- Maintenance cost is lowest of the three (no server, no auth).
- Performance on CSV / Parquet / JSON ingestion is unmatched in the embedded tier.
- Migration path to Postgres later is straightforward because both speak ANSI SQL; the warehouse SQL is portable.

## High-Level Architecture

```text
        ┌────────────────────────────────────────────────────────────┐
        │                  FINANCIAL SOURCES                         │
        │                                                            │
        │  QuickBooks  Payroll  Toast  DoorDash  GA4  GSC  GBP       │
        └──────┬──────────┬─────────┬────────┬────┬─────┬────┬───────┘
               │          │         │        │    │     │    │
               ▼          ▼         ▼        ▼    ▼     ▼    ▼
        ┌────────────────────────────────────────────────────────────┐
        │              READ-ONLY CONNECTOR LAYER                     │
        │                                                            │
        │  QBWC  CSV-import  Playwright  API client  GBP API         │
        └──────────────────────────────────┬─────────────────────────┘
                                           ▼
        ┌────────────────────────────────────────────────────────────┐
        │                  DUCKDB WAREHOUSE (Phase 3A: JSON)         │
        │                                                            │
        │  sources | snapshots | freshness | source_health |         │
        │  stores | revenue | orders | labor | payroll | food_cost | │
        │  profit | financial_snapshots | data_freshness              │
        └──────────────────────────────────┬─────────────────────────┘
                                           ▼
        ┌────────────────────────────────────────────────────────────┐
        │              TRANSFORMATION LAYER (Phase 3B: dbt)          │
        └──────────────────────────────────┬─────────────────────────┘
                                           ▼
        ┌────────────────────────────────────────────────────────────┐
        │              API LAYER (Flask, read-only)                  │
        │                                                            │
        │  /health /sources /sources/register                        │
        │  /snapshots/register /freshness /runtime-proof             │
        └──────────────────────────────────┬─────────────────────────┘
                                           ▼
        ┌────────────────────────────────────────────────────────────┐
        │              CFO DASHBOARD + COORDINATION                  │
        └────────────────────────────────────────────────────────────┘
```

## Phase 3A Concrete Choice

To keep runtime proof immediate and dependency-light, Phase 3A uses:

- **Python 3.13** runtime
- **Flask** HTTP API
- **JSON on disk** as the initial physical store (mapped to DuckDB schema names)

Phase 3B swaps the storage layer to DuckDB without changing API contracts or data model column names. This avoids committing to a database driver before the connector contracts are stable.

## Reliability Posture

- The service binds to `127.0.0.1` only.
- All writes are append-only to an evidence log; warehouse state file is rewritten atomically per write.
- No background threads; request lifecycle owns all I/O.
- Errors return structured JSON with HTTP 4xx — never 500-with-stack-trace in evidence log.

## What This Architecture Does NOT Include (CTO Rule)

- No forecasting engine.
- No profit engine.
- No payroll mutation.
- No financial dashboard rendering.
- No CFO-specific UI.

It provides the **source of truth** every future capability will read from.
