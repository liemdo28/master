# SOURCE_HEALTH_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — Source Health Engine proof.

## Summary

The Source Health Engine evaluates every registered financial source and
classifies it as `LIVE`, `STALE`, `PARTIAL`, `MISSING`, or `BLOCKED`. It
reads directly from the warehouse freshness registry and source registry.

## Status Vocabulary

| Status | Meaning |
|---|---|
| LIVE | Source registered + snapshot exists + within cadence |
| STALE | Snapshot exists but exceeds expected cadence threshold |
| PARTIAL | Health is DOWN or snapshot is partial |
| MISSING | Registered but no snapshot ever ingested |
| BLOCKED | Classification explicitly marked BLOCKED in registry |

## Cadence Thresholds

| Cadence | Threshold (days) |
|---|---|
| real_time | 0.5 (12h) |
| hourly | 1 |
| daily | 2 |
| weekly | 8 |
| monthly | 35 |

## Output Example (per directive)

```json
{
  "source": "quickbooks",
  "status": "LIVE",
  "age_days": 0
}
```

## Live Evaluation

```text
[3/5] Running Source Health Engine...
    [OK] Overall health: BLOCKED, counts={'LIVE': 2, 'STALE': 0, 'PARTIAL': 0, 'MISSING': 5, 'BLOCKED': 1}
```

### Per-Source Detail

| Source | Status | Age (days) | Cadence | Reason |
|---|---|---|---|---|
| quickbooks | LIVE | 0 | daily | Snapshot registered |
| accounting_engine | LIVE | 0 | real_time | Heartbeat snapshot |
| toast | MISSING | null | daily | No snapshot ever |
| doordash | MISSING | null | daily | No snapshot ever |
| payroll | MISSING | null | weekly | No snapshot ever |
| ga4 | MISSING | null | daily | No snapshot ever |
| gsc | MISSING | null | daily | No snapshot ever |
| gbp | BLOCKED | null | daily | API not approved |

Overall posture: **BLOCKED** — at least one source (gbp) is explicitly blocked.

## Engine Functions

| Function | Purpose |
|---|---|
| `evaluate_all_sources()` | Return status for every registered source |
| `evaluate_source(src_id)` | Status for one source |
| `get_stale_sources()` | Return only STALE/PARTIAL |
| `get_missing_sources()` | Return only MISSING/BLOCKED |
| `get_live_sources()` | Return only LIVE |
| `health_summary()` | Aggregate counts and overall posture |

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/source_health_engine.py` | Engine implementation |

## CTO Rule Compliance

- Reads only from warehouse.
- Never reclassifies BLOCKED sources to LIVE.
- Age computed from real timestamps.
- All 5 status values supported.

## Status: PASS
