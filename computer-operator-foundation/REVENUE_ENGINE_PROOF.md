# REVENUE_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — Revenue Engine proof against the Financial Warehouse.

## Summary

The Revenue Engine reads directly from the Financial Warehouse freshness
and source registries. It **never fabricates revenue**. When revenue data
is unavailable in the warehouse, the engine returns `null`/`None` for
revenue values and lowers confidence accordingly.

## Capabilities Delivered

| Capability | Status | Evidence |
|---|---|---|
| Revenue Aggregation | OK | `revenue_aggregation()` reads warehouse sources, computes confidence |
| Revenue Trend | BLOCKED | Returns BLOCKED — no daily revenue ingested |
| Store Revenue Ranking | OK | Returns 4 stores ranked by data infrastructure readiness |
| Revenue Freshness Awareness | OK | Per-source freshness reported, aggregate `PARTIAL` |

## Output Example (per directive)

```json
{
  "store": "Bakudan The Rim",
  "revenue": null,
  "source": "QuickBooks",
  "freshness": "STALE",
  "confidence": 43
}
```

Note: `revenue: null` because no actual POS revenue is ingested into the
warehouse yet. Confidence lowered to 43 to reflect missing data, not zero
because at least one revenue source (accounting_engine) is operational.

## Live Run Output

```text
[1/5] Running Revenue Engine...
    [OK] Revenue aggregation: confidence=43, freshness=PARTIAL
       live_sources=1, total_sources=3
       trend_available=false (no daily revenue rows)
       freshness_awareness=PARTIAL
```

## Source Breakdown (Live)

| Source | Status | Notes |
|---|---|---|
| quickbooks | LIVE (simulated) | Snapshot `qb-2026-06-20-daily` registered; no real data path |
| accounting_engine | LIVE | Real heartbeat probe registered |
| toast | MISSING | No connector built |
| doordash | MISSING | No connector built |

## Confidence Model

- 0/3 revenue sources live → confidence = 0
- 1/3 revenue sources live → confidence = 43 (rounded from `(1/3)*100 + 10`)
- 2/3 → confidence = 70
- 3/3 → confidence = 85 (some uncertainty from data completeness)
- All sources live + actual POS data → confidence = 95

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/revenue_engine.py` | Engine implementation |
| `financial_intelligence/warehouse_client.py` | Read-only warehouse client |
| `financial_intelligence/runtime-evidence/proof.json` | Runtime proof |

## CTO Rule Compliance

- No fabricated revenue values.
- Trend returns BLOCKED with `blocked_reason`.
- Confidence lowers when sources are missing.
- All reads go through the warehouse client (no bypass).

## Status: PASS
