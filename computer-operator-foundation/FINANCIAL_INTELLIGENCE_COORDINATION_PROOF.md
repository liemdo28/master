# FINANCIAL_INTELLIGENCE_COORDINATION_PROOF

Status: **OPERATIONAL**
Date: 2026-06-26
Scope: Phase 3B — Financial Intelligence Coordination Integration proof.

## Summary

The Coordination Adapter bridges the Financial Intelligence Engine to the
Phase 0 Executive Coordination system. When warehouse state indicates a
problem, the adapter creates FIN tasks, risk entries, and executive alerts
in the coordination system.

## Integration Points

| Registry | Integration |
|---|---|
| Objective Registry | Tagged with `OBJ-FIN-DATA-GOVERNANCE` / `OBJ-FIN-RISK-GOVERNANCE` / `OBJ-EXEC-FINANCIAL` |
| Task Registry | FIN tasks for stale sources + missing connectors |
| Evidence Registry | Each coordination task has its own disk artifact (JSON) |
| Approval Registry | Executive alerts require `PRODUCTION_WRITE` approval |
| Dashboard | Coordination summary exposed via `/api/finance/coordination` |

## Signal Flow

```text
Financial Warehouse (GET /freshness, GET /sources)
   |
   v
Source Health Engine + Financial Risk Engine
   |
   v
Coordination Adapter (scan_and_emit)
   |
   +---> FIN tasks    (per stale source, per missing connector)
   +---> FIN risks    (per detected risk)
   +---> EXEC alerts  (when P0 risks exist)
   |
   v
Persisted JSON files in:
   - operator-runtime/evidence/{task_id}_coordination.json
   - financial_intelligence/evidence/{task_id}_coordination.json
```

## Live Coordination Scan Output

```text
[coordination] Scanning and emitting...
    [OK] Tasks: 5, Risks: 5, Alerts: 0
```

### Tasks Created (5)

| # | ID | Title | Priority |
|---|---|---|---|
| 1 | FIN-... | Build connector: Toast POS | MEDIUM |
| 2 | FIN-... | Build connector: DoorDash Merchant | MEDIUM |
| 3 | FIN-... | Build connector: Payroll System | MEDIUM |
| 4 | FIN-... | Build connector: Google Analytics 4 | MEDIUM |
| 5 | FIN-... | Build connector: Google Search Console | MEDIUM |

### Risks Created (5)

| # | Risk | Severity |
|---|---|---|
| 1 | TOAST_MISSING | P1 |
| 2 | DOORDASH_MISSING | P1 |
| 3 | PAYROLL_MISSING | P1 |
| 4 | MISSING_CONNECTORS | P2 |
| 5 | GBP_BLOCKED | P2 |

### Alerts Created (0)

No P0 risks detected — so no executive alerts were emitted.

## Adapter Functions

| Function | Purpose |
|---|---|
| `create_fin_task(title, owner, priority, source_signals, description)` | Create a FIN coordination task |
| `create_fin_risk(risk_id, severity, description, evidence)` | Create a FIN risk entry |
| `create_executive_alert(severity, title, description)` | Create an executive alert |
| `scan_and_emit()` | Scan warehouse state and emit all signals |
| `get_coordination_summary()` | Summary of all created coordination items |

## Files

| File | Purpose |
|---|---|
| `financial_intelligence/coordination_adapter.py` | Coordination adapter implementation |
| `operator-runtime/evidence/*.json` | Persisted coordination task evidence |
| `financial_intelligence/evidence/*.json` | Intelligence-side coordination copies |

## CTO Rule Compliance

- Only derived signals sent to coordination (source_id, status, severity).
- No raw financial data leaves the warehouse through this adapter.
- Each signal carries `evidence` payload linking back to warehouse state.

## Status: PASS
