# FINANCIAL_DATA_MODEL

Status: **SCHEMA_DESIGNED**
Date: 2026-06-26
Scope: Phase 3A warehouse schema — all required financial entities with columns, types, owners, and source linkage.

## Design Principles

1. Every row carries `owner`, `source_system`, `created_at`, `confidence` metadata.
2. Column names are ANSI SQL–safe so they map cleanly to DuckDB in Phase 3B.
3. Foreign keys are expressed by convention (source_id, store_id); physical FKs are optional.
4. Timestamps are ISO 8601 UTC.
5. No production financial writes — this schema represents what the warehouse RECEIVES.

---

## Entity 1: stores

The dimension table of restaurant locations.

| Column | Type | Description |
|---|---|---|
| store_id | string (PK) | Stable id, e.g. `bakudan-the-rim`, `bakudan-bandera`, `bakudan-stone-oak`, `raw-sushi` |
| store_name | string | Human label |
| address | string | Physical address |
| brand | string | Brand / concept name |
| qb_class | string | QuickBooks class mapping |
| toast_location_id | string | Toast location id (nullable) |
| doordash_merchant_id | string | DoorDash merchant id (nullable) |
| timezone | string | Store timezone, e.g. `America/Chicago` |
| open_date | date | When store opened |
| owner | string | Responsible role |
| source_system | string | `manual_registry` / `qb` / `toast` |
| created_at | datetime | Row creation timestamp |

---

## Entity 2: revenue

Daily revenue rows, one per store per source per day.

| Column | Type | Description |
|---|---|---|
| revenue_id | string (PK) | Composite: `{store_id}-{source}-{date}` |
| store_id | string (FK → stores) | |
| date | date | Calendar date |
| source | string | `toast`, `doordash`, `qb`, `other` |
| channel | string | `dine_in`, `takeout`, `delivery`, `catering`, `unknown` |
| gross_revenue | decimal(12,2) | Pre-tax, pre-tip revenue |
| net_revenue | decimal(12,2) | After returns/voids |
| tip_total | decimal(12,2) | Customer tips |
| tax_total | decimal(12,2) | Collected tax |
| order_count | integer | Number of orders contributing to this row |
| owner | string | Responsible role |
| source_system | string | Originating system |
| created_at | datetime | Row creation timestamp |
| confidence | enum | `HIGH`, `MEDIUM`, `LOW` |
| snapshot_id | string (FK → snapshots) | Links to ingestion batch |

---

## Entity 3: orders

Individual order-level records (optional grain, populated when source provides it).

| Column | Type | Description |
|---|---|---|
| order_id | string (PK) | Unique order id |
| store_id | string (FK → stores) | |
| date | datetime | Order timestamp |
| source | string | `toast`, `doordash` |
| channel | string | `dine_in`, `takeout`, `delivery` |
| subtotal | decimal(10,2) | |
| tax | decimal(10,2) | |
| tip | decimal(10,2) | |
| total | decimal(10,2) | |
| item_count | integer | |
| owner | string | |
| source_system | string | |
| created_at | datetime | |
| confidence | enum | `HIGH`, `MEDIUM`, `LOW` |
| snapshot_id | string | |

---

## Entity 4: labor

Daily labor cost rows.

| Column | Type | Description |
|---|---|---|
| labor_id | string (PK) | Composite: `{store_id}-{pay_period}-{date}` |
| store_id | string (FK → stores) | |
| date | date | Labor date |
| pay_period_end | date | Pay period ending |
| regular_hours | decimal(6,2) | |
| overtime_hours | decimal(6,2) | |
| regular_cost | decimal(10,2) | |
| overtime_cost | decimal(10,2) | |
| total_labor_cost | decimal(10,2) | Wages + employer taxes + benefits |
| headcount | integer | Staff that shift |
| owner | string | |
| source_system | string | `payroll` |
| created_at | datetime | |
| confidence | enum | |
| snapshot_id | string | |

---

## Entity 5: payroll

Payroll cycle-level summary (biweekly/monthly).

| Column | Type | Description |
|---|---|---|
| payroll_id | string (PK) | Unique payroll run id |
| store_id | string (FK → stores) | |
| pay_period_start | date | |
| pay_period_end | date | |
| gross_pay | decimal(12,2) | |
| employer_taxes | decimal(12,2) | |
| benefits | decimal(12,2) | |
| total_cost | decimal(12,2) | |
| employee_count | integer | |
| overtime_hours | decimal(8,2) | |
| owner | string | |
| source_system | string | `payroll` |
| created_at | datetime | |
| confidence | enum | |
| snapshot_id | string | |

---

## Entity 6: food_cost

Weekly food cost rows.

| Column | Type | Description |
|---|---|---|
| food_cost_id | string (PK) | Composite: `{store_id}-{week_start}` |
| store_id | string (FK → stores) | |
| week_start | date | Week starting Monday |
| week_end | date | Week ending Sunday |
| vendor_bills_total | decimal(10,2) | Sum of vendor bills classified as food |
| beginning_inventory | decimal(10,2) | |
| ending_inventory | decimal(10,2) | |
| food_cost | decimal(10,2) | bills + beginning − ending |
| owner | string | |
| source_system | string | `qb` |
| created_at | datetime | |
| confidence | enum | |
| snapshot_id | string | |

---

## Entity 7: profit

Monthly profit summary.

| Column | Type | Description |
|---|---|---|
| profit_id | string (PK) | Composite: `{store_id}-{month}` |
| store_id | string (FK → stores) | |
| month | date | First day of month |
| revenue | decimal(12,2) | From revenue entity |
| cogs | decimal(12,2) | From food_cost entity |
| labor | decimal(12,2) | From payroll entity |
| overhead | decimal(12,2) | Other operating expenses from QB |
| gross_profit | decimal(12,2) | revenue − cogs |
| net_profit | decimal(12,2) | gross_profit − labor − overhead |
| margin_pct | decimal(5,2) | (net_profit / revenue) × 100 |
| owner | string | |
| source_system | string | `warehouse_calc` |
| created_at | datetime | |
| confidence | enum | |
| snapshot_id | string | |

---

## Entity 8: financial_snapshots

Records every ingestion batch.

| Column | Type | Description |
|---|---|---|
| snapshot_id | string (PK) | Unique batch id |
| source_id | string (FK → sources) | |
| snapshot_at | datetime | When the snapshot was registered |
| record_count | integer | Rows ingested |
| entity_type | string | Target entity (`revenue`, `orders`, `labor`, `payroll`, `food_cost`, `profit`) |
| confidence | enum | |
| notes | string | |
| owner | string | |
| source_system | string | |
| created_at | datetime | |

---

## Entity 9: source_health

Tracks health state transitions.

| Column | Type | Description |
|---|---|---|
| health_id | string (PK) | |
| source_id | string (FK → sources) | |
| health | enum | `HEALTHY`, `DEGRADED`, `DOWN`, `UNKNOWN` |
| observed_at | datetime | |
| details | string | JSON string with probe details |
| owner | string | |

---

## Entity 10: data_freshness

Tracks source freshness (the runtime query target of `GET /freshness`).

| Column | Type | Description |
|---|---|---|
| source_id | string (PK, FK → sources) | |
| source_name | string | |
| last_seen | datetime | ISO 8601 UTC |
| age | string | ISO 8601 duration |
| health | enum | |
| status | enum | `LIVE`, `STALE`, `PARTIAL`, `MISSING`, `BLOCKED` |
| expected_cadence | string | e.g. `daily`, `hourly` |
| last_refresh_at | datetime | |
| owner | string | |

---

## Entity Relationships

```text
stores ──< revenue
stores ──< orders
stores ──< labor
stores ──< payroll
stores ──< food_cost
stores ──< profit

sources ──< data_freshness
sources ──< source_health
sources ──< financial_snapshots

financial_snapshots ──< revenue (via snapshot_id)
financial_snapshots ──< orders
financial_snapshots ──< labor
financial_snapshots ──< payroll
financial_snapshots ──< food_cost
financial_snapshots ──< profit
```

## Migration Path (Phase 3B)

Each entity above maps 1:1 to a DuckDB table. The Phase 3A JSON warehouse
exposes the same column names. Phase 3B migration requires:

1. `CREATE TABLE` DDL per entity
2. Insert from JSON store
3. dbt model layer for KPI transformations

No schema redesign required.
