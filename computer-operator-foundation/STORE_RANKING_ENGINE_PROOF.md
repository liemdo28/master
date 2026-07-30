# STORE_RANKING_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — Store Ranking Engine proof.

## Summary

The Store Ranking Engine scores and ranks all known stores. Because no
actual revenue or profit data is yet ingested into the warehouse, the
ranking reflects **data infrastructure readiness**, not fabricated financial
performance.

## Ranking Factors

| Factor | Weight | Source |
|---|---|---|
| Freshness | 40% | warehouse freshness registry |
| Confidence | 40% | source registration + live count |
| Revenue Data | 20% | warehouse revenue rows (currently 0 — no data ingested) |

## Output Example (per directive)

```json
{
  "rank": 1,
  "store": "Bakudan The Rim",
  "score": 23
}
```

## Live Rankings

| Rank | Store | Score | Freshness | Confidence | Note |
|---|---|---|---|---|---|
| 1 | Bakudan The Rim | 23 | 23 | 35 | Data readiness only |
| 2 | Bakudan Bandera | 23 | 23 | 35 | Data readiness only |
| 3 | Bakudan Stone Oak | 23 | 23 | 35 | Data readiness only |
| 4 | Raw Sushi | 23 | 23 | 35 | Data readiness only |

All stores currently score identically because they all share the same
data infrastructure footprint. Scores will diverge as per-store revenue
and profit data is ingested into the warehouse.

## Engine Behavior

- Reads `/sources` and `/freshness` from warehouse.
- Computes freshness score per source (LIVE=100, STALE=20, etc.).
- Aggregates across revenue sources (QB, Toast, DoorDash).
- Returns ranked list with rank, store, score, and supporting dimensions.

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/store_ranking_engine.py` | Engine implementation |

## CTO Rule Compliance

- No fabricated store performance metrics.
- Score clearly labeled as "data infrastructure readiness" not "profitability".
- All scores derived from warehouse state only.

## Status: PASS
