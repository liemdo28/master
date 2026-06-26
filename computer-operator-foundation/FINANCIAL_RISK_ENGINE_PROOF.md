# FINANCIAL_RISK_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — Financial Risk Engine proof.

## Summary

The Financial Risk Engine detects risks from current warehouse state and
classifies them by severity (P0–P3). It surfaces actionable items to the
Coordination Adapter for task/risk creation.

## Severity Tiers

| Severity | Meaning | Example |
|---|---|---|
| P0 | Critical / Revenue pipeline degraded | All revenue sources offline |
| P1 | High | Single revenue source missing; payroll missing |
| P2 | Medium | Single connector missing; payroll stale |
| P3 | Low | Marketing source missing; registry empty |

## Risk Categories Detected

1. `REVENUE_SOURCE_OFFLINE` — all of toast/doordash/qb offline (P0)
2. `TOAST_MISSING` / `DOORDASH_MISSING` / `QB_MISSING` (P1)
3. `QB_STALE` (P1)
4. `QB_BLOCKED` (P0)
5. `PAYROLL_MISSING` (P1) / `PAYROLL_STALE` (P2)
6. `WAREHOUSE_DOWN` (P0) / `WAREHOUSE_STALE` (P1)
7. `SNAPSHOTS_MISSING` (P2)
8. `MISSING_CONNECTORS` (P2)
9. `GA4_MISSING` / `GSC_MISSING` (P3)
10. `GBP_BLOCKED` (P2)

## Output Example (per directive)

```json
{
  "risk": "QB_STALE",
  "severity": "P1"
}
```

## Live Run Output

```text
[4/5] Running Financial Risk Engine...
    [OK] Total risks: 5, by_severity={'P0': 0, 'P1': 3, 'P2': 2, 'P3': 0}
```

### Detected Risks

| # | Risk | Severity | Description |
|---|---|---|---|
| 1 | TOAST_MISSING | P1 | Toast POS source missing from warehouse |
| 2 | DOORDASH_MISSING | P1 | DoorDash Merchant source missing |
| 3 | PAYROLL_MISSING | P1 | Payroll source missing — labor/profit KPIs blocked |
| 4 | MISSING_CONNECTORS | P2 | No connector built for: toast, doordash, payroll, ga4, gsc |
| 5 | GBP_BLOCKED | P2 | Google Business Profile blocked — review data unavailable |

## Risk Sorting

Risks are sorted by severity (P0 → P3) so the dashboard and
coordination adapter see the most critical first.

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/financial_risk_engine.py` | Engine implementation |

## CTO Rule Compliance

- Only derived signals sent to coordination (no raw financial data).
- Severity rules documented in source.
- Risk engine never invents risks — only those with warehouse evidence.

## Status: PASS
