# OSS Coordination Proof

## Summary

The OSS Coordination Adapter bridges the registry to Executive Coordination.
It scans registry state, creates tasks/risks/alerts, and writes evidence both
to `oss_governance/evidence/` (own dir) and `operator-runtime/evidence/`
(cross-division).

## Mirrors Financial Intelligence Pattern

| Financial Intelligence | OSS Governance |
|---|---|
| `coordination_adapter.py` | `coordination_adapter.py` |
| Creates FIN tasks | Creates OSS tasks |
| Detects financial risks | Detects governance risks |
| Emits to Executive | Emits to Executive |
| P0 → Executive alert | P0 → Executive alert |

## Risk Detection (5 types)

```python
detect_risks() -> [
    {
        "risk": "HIGH_LICENSE_RISK",
        "severity": "P1",
        "project_id": "OSS-xxx",
        "project_name": "Skyvern",
        "description": "Skyvern uses AGPL-3.0 license (HIGH risk)",
        "evidence": {"license": "AGPL-3.0", "owner_division": "Operator"},
    },
    ...
]
```

### Risk Types and Triggers

| Risk | Severity | Trigger |
|---|---|---|
| `EMPTY_REGISTRY` | P0 | Registry has 0 projects |
| `HIGH_LICENSE_RISK` | P1 | ACTIVE project with HIGH-risk license |
| `HIGH_RISK_PROJECT` | P1 | Scorecard shows HIGH composite risk |
| `STUCK_PIPELINE` | P2 | stuck > active in pipeline |
| `LOW_ACTIVITY_PROJECT` | P2 | PRODUCTION project with slow release |

## scan_and_emit() Logic

```python
emitted = scan_and_emit()
# 1. Projects stuck in DISCOVERY/AUDIT/ROI → OSS task "Advance past {stage}"
# 2. PRODUCTION projects without scorecard → OSS task "Score {name}"
# 3. Risks → OSS risk entries
# 4. P0 risks → Executive alert
```

## Coordination Task Format

```json
{
  "coord_task_id": "OSS-a1b2c3d4e5",
  "task_name": "Advance Playwright past DISCOVERY",
  "objective_id": "OBJ-OSS-GOVERNANCE",
  "target": "oss_registry",
  "approval_level": "READ_ONLY",
  "operator_type": "oss_governance",
  "state": "CREATED",
  "owner": "operator_lead",
  "priority": "MEDIUM",
  "description": "Playwright has been in DISCOVERY — advance gate.",
  "source_signals": [{"project_id": "OSS-...", "stage": "DISCOVERY"}]
}
```

## Cross-Division Evidence Writing

Every coordination task writes to:
1. `oss_governance/evidence/{task_id}_coordination.json` — own directory
2. `operator-runtime/evidence/{task_id}_coordination.json` — cross-division

This allows the Operator Division's evidence registry to see OSS signals
without coupling the two packages.

## Runtime Proof Result

```text
[PASS] coord_summary        — coordination summary exists
[PASS] risks_detected       — 6 risks detected (HIGH_LICENSE_RISK + STUCK_PIPELINE variants)
Risk types: {'HIGH_LICENSE_RISK', 'STUCK_PIPELINE'}
```

## Evidence Audit Trail

- `oss_governance/evidence/*_coordination.json` (per task/risk/alert)
- `oss_governance/evidence/{project_id}_registered.json` (per registration)
- `oss_governance/evidence/{project_id}_stage_change.json` (per stage change)
- `oss_governance/evidence/{event_id}.json` (per lifecycle event)
- `oss_governance/evidence/{project_id}_scorecard.json` (per scorecard)