# FINANCIAL_COORDINATION_INTEGRATION

Status: **INTEGRATION_DESIGNED**
Date: 2026-06-26
Scope: Phase 3A integration of the Financial Warehouse with Phase 0 Executive Coordination.

## Existing Phase 0 Registries

| Registry | Purpose |
|---|---|
| Objective Registry | CEO-level objectives, division-tagged |
| Task Registry | Execution tasks, type-tagged, status-tracked |
| Ownership Engine | Maps every task/objective to a role |
| Dependency Graph | Tracks prerequisite relationships |
| Approval Registry | Enforces approval tiers per action |
| Evidence Registry | Stores redacted proof for every action |

The Financial Warehouse feeds these registries with **derived signals** — never raw financial data.

## Signal Flow

```text
Financial Warehouse (GET /freshness, GET /sources)
   ↓ signal event (LIVE / STALE / MISSING / BLOCKED)
   ↓
Phase 0 Coordination Adapter (Phase 3A: documented; Phase 3B: implement)
   ↓
Objective Registry / Task Registry / Evidence Registry
   ↓
Dashboard widget "Stale Data Alerts" / "Financial Risks"
   ↓
Executive weekly summary
```

## Signal Catalog

| Trigger | Source event | Coordination action |
|---|---|---|
| QB heartbeat stale | `freshness.status = STALE` for `quickbooks` | FIN task "Investigate QB sync staleness" |
| Payroll missing | `freshness.status = MISSING` for `payroll` | FIN risk "Payroll source offline — labor KPIs blocked" |
| Toast missing | `freshness.status = MISSING` for `toast` | FIN task "Toast export reconnect" |
| DoorDash missing | `freshness.status = MISSING` for `doordash` | FIN task "DoorDash portal re-authorization" |
| Revenue source offline | `freshness.status = BLOCKED` for revenue-critical | Executive alert "Revenue pipeline degraded" |
| GBPReviews blocked | `freshness.status = BLOCKED` for `gbp` | Marketing task "GBP API approval needed" |
| Accounting engine down | `health = DOWN` for `accounting_engine` | Executive alert "Local accounting engine down" |

## Event Examples

### Example A: QB stale → FIN task

```text
Warehouse freshness row for `quickbooks` transitions LIVE → STALE
  ↓
Coordination adapter emits FIN event
  ↓
Task Registry: CREATE task
  - id: FIN-2026-06-26-001
  - type: SOURCE_RECONNECT
  - title: "QB sync stale — investigate"
  - owner: data_engineering
  - priority: MEDIUM-HIGH
  - dependencies: []
  - evidence_required: ["warehouse.jsonl#freshness", "qb sync log"]
  ↓
Evidence Registry: warehouse.jsonl line logged with snapshot link
  ↓
Dashboard widget: "Stale Data Alerts" shows red entry
  ↓
If unresolved in 48h: escalate to CEO via Approval Registry
```

### Example B: Payroll missing → FIN risk

```text
Warehouse freshness row for `payroll` is MISSING
  ↓
Coordination adapter emits FIN event
  ↓
Objective Registry: APPEND risk flag
  - id: FIN-RISK-2026-06-26-001
  - category: DATA_GAP
  - severity: HIGH (because payroll is needed for labor%, profit)
  - description: "Payroll source missing — labor and profit KPIs cannot be computed"
  ↓
Task Registry: CREATE task to identify payroll provider
  ↓
Dashboard widget: "Financial Risks" shows HIGH severity alert
```

### Example C: Revenue source offline → executive alert

```text
Multiple revenue sources (toast + doordash + qb) flip to BLOCKED/STALE in same cycle
  ↓
Coordination adapter emits EXEC event
  ↓
Approval Registry: CREATE executive notification
  ↓
Dashboard widget: "Financial Division Status" turns red
  ↓
Executive weekly summary: dedicated section
```

## Required Adapters (Phase 3B)

1. `coordination/warehouse_emit.py` — polls `/freshness` periodically and emits events.
2. `coordination/task_templates/` — JSON templates for each trigger.
3. `coordination/escalation_policy.md` — when to escalate from FIN to CEO.
4. `coordination/evidence_manifest.json` — links each FIN task to warehouse evidence.

## Ownership Map

| Signal | Owner |
|---|---|
| Source connectivity | Data Engineering Lead |
| Source freshness | Data Engineering Lead |
| Financial KPI accuracy | Finance Lead |
| Labor source | HR Lead / Finance Lead |
| Payroll data | HR Lead / Finance Lead |
| Revenue source | Operations Lead |
| Marketing source | Marketing Lead |
| Executive escalation | Executive Lead |

## Dependency Wiring

```text
financial-warehouse/FINANCIAL_SOURCE_DISCOVERY.md
   → financial-warehouse/FINANCIAL_FRESHNESS_REGISTRY.md
      → financial-warehouse/app.py (GET /freshness)
         → coordination/warehouse_emit.py (Phase 3B)
            → Objective Registry / Task Registry
               → Dashboard "Stale Data Alerts" widget
                  → Executive weekly summary
```

## Safety

The integration MUST NOT include raw financial rows in coordination events. Only:
- source_id
- source_name
- status (LIVE / STALE / MISSING / BLOCKED)
- health (HEALTHY / DEGRADED / DOWN / UNKNOWN)
- age / last_seen
- severity tag

This keeps sensitive P&L data inside the warehouse and out of the coordination surface.
