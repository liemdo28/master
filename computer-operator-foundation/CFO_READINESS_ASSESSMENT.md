# CFO_READINESS_ASSESSMENT

Status: **FOUNDATION_READY_INTELLIGENCE_BLOCKED**
Date: 2026-06-26
Scope: Honest assessment of what Mi can and cannot answer as a CFO today, what is still blocked, which sources are missing, and what is required to reach CFO capability.

## Bottom Line

```text
Mi HAS the Financial Warehouse foundation (sources, freshness, snapshots, MVP API).
Mi DOES NOT HAVE the financial data needed to answer CFO questions.
```

The warehouse is the spine. The body (real revenue, labor, profit data) is not yet wired.

---

## What Mi Can Answer Today

| Question | Answer today? | Why |
|---|---|---|
| Which financial sources are registered? | **YES** | `GET /sources` returns 8 sources |
| Is source X live, stale, or missing? | **YES** | `GET /freshness` returns status per source |
| Was a snapshot ingested for source X? | **YES** | `GET /sources` and snapshot log |
| Did the warehouse service itself run successfully? | **YES** | `GET /runtime-proof` |
| How many sources have a snapshot? | **YES** | count returned |
| Is the local accounting engine reachable? | **YES** | heartbeat probe of `127.0.0.1:8844` |
| What is the freshness SLA for source X? | **YES** | registry schema documented |

## What Is Still Blocked

| Question | Why blocked |
|---|---|
| Revenue hôm nay bao nhiêu? | No POS data ingested (Toast missing, DoorDash missing) |
| Revenue tuần này tăng hay giảm? | Depends on daily revenue, which is not ingested |
| Store nào lời nhất? | Profit engine requires revenue + COGS + labor, none ingested |
| Store nào đang giảm doanh thu? | Requires revenue by store trend |
| Labor cost có vượt chuẩn không? | Payroll source missing |
| Food cost có vượt chuẩn không? | QB vendor bills not mapped |
| Profit giảm vì sao? | Profit bridge not built; no cost decomposition |
| Payroll có bất thường không? | Payroll source missing |
| Cashflow có rủi ro không? | Bank data not connected |
| Tuần này cần chú ý tài chính gì? | All upstream blocked |

## What Data Sources Are Missing

| Source | Status | Why it matters |
|---|---|---|
| Toast POS daily sales | **MISSING** | Primary revenue source |
| DoorDash orders / sales | **MISSING** | Delivery revenue source |
| Payroll | **MISSING** | Required for labor cost, labor %, profit |
| QuickBooks COGS / vendor bills | **PARTIAL** | QB reachable as heartbeat but no read path implemented |
| GA4 transactions | **MISSING** | Marketing attribution |
| GSC search data | **MISSING** | Marketing attribution |
| GBP reviews | **BLOCKED** | API not approved |

## What Is Needed for CFO Capability

### Tier 1 — Connect revenue sources

1. Build Toast API connector (preferred) or Playwright portal fallback.
2. Build DoorDash Playwright connector with WAF handling.
3. Wire both into `POST /snapshots/register` on hourly cadence.
4. Define store dimension mapping between Toast location ids, DoorDash merchant ids, and Mi `store_id`.

**Outcome**: `daily_revenue` rows populate. Revenue Today / Revenue This Week widgets become live.

### Tier 2 — Connect labor source

1. Identify payroll provider (Gusto, ADP, Paychex, etc.).
2. Set up read-only API token or SFTP CSV.
3. Build connector that calls `POST /snapshots/register` biweekly.
4. Define store-level allocation rule.

**Outcome**: `labor`, `payroll` rows populate. Labor %, Payroll Trend widgets become live.

### Tier 3 — Connect QuickBooks COGS

1. Implement QB Web Connector sync (QBWC) → staging CSV.
2. Map QB expense accounts to `food_cost` and `overhead` categories.
3. Wire weekly `POST /snapshots/register` for `food_cost` entity.

**Outcome**: `food_cost` rows populate. Food Cost % widget becomes live.

### Tier 4 — Build profit engine

1. With Tier 1–3 done, write dbt models that join revenue + food_cost + labor + overhead.
2. Produce `profit` monthly rows.
3. Expose `/api/v1/profit/estimate` endpoint (already spec'd in CFO dashboard design).

**Outcome**: Profit Estimate widget, Store Ranking widget, profit bridge question become live.

### Tier 5 — Executive coordination wiring

1. Implement `coordination/warehouse_emit.py` polling `/freshness`.
2. Wire FIN task creation, evidence logging, dashboard widget updates.
3. Define escalation policy when a revenue-critical source is STALE for >48h.

**Outcome**: Financial Risks widget, Stale Data Alerts widget, executive weekly summary become live.

### Tier 6 — CFO question router

1. Build NL → question id mapping.
2. Route to warehouse endpoints.
3. Format answers per `REVENUE_QUESTION_ENGINE.md`.

**Outcome**: Mi can answer all 10 CFO questions in Vietnamese.

## CFO Readiness Score

| Dimension | Score (0-10) | Reason |
|---|---|---|
| Data foundation | 9 | Warehouse MVP + freshness registry + 14/14 endpoints proven |
| Source connectivity | 1 | Only Accounting Engine heartbeat; no revenue, payroll, COGS data |
| KPI calculations | 0 | No data, no models |
| Dashboard rendering | 0 | Not yet built (CTO rule) |
| Question answering | 1 | Engine designed, but no data to query |
| Coordination wiring | 2 | Design complete, adapter not built |
| Overall | **2.2 / 10** | Foundation is solid; intelligence layer is empty |

## Required CEO Decisions

1. Authorize Toast API access (CEO sign-off).
2. Identify payroll provider and authorize read-only data access.
3. Approve QB sandbox company file creation for safe QB Web Connector development.
4. Approve Finance Lead hiring (if not already staffed).
5. Set executive appetite for how long Mi can wait on QuickBooks data (governance vs speed).

## Required Dev Team Actions

1. Build `connectors/toast/` — Python module with API + portal fallback (Phase 3B).
2. Build `connectors/doordash/` — Playwright portal module (Phase 3B).
3. Build `connectors/payroll/` — provider-agnostic CSV import (Phase 3B).
4. Build `connectors/quickbooks/` — QBWC wrapper (Phase 3B).
5. Implement `coordination/warehouse_emit.py` (Phase 3B).
6. Swap JSON store to DuckDB without changing API contracts (Phase 3B).
7. Add dbt models for KPI transformations (Phase 3B).

## Conclusion

The Financial Warehouse Foundation is **READY** as data infrastructure. The path to CFO-grade intelligence is **CLEAR** but blocked on three categories of work:
1. Real connector implementations.
2. Payroll provider identification + access.
3. DuckDB migration + dbt transformation layer.

Until those are done, Mi can answer "what data do we have?" but cannot answer "what is our profit this week?".
