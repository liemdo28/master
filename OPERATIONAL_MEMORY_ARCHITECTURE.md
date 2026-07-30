# OPERATIONAL_MEMORY_ARCHITECTURE

Generated: 2026-06-13
Status: DESIGN_ONLY

## Objective

Design an Operational Memory Engine so Mi learns from previous operations.

Example:

```text
Dashboard Audit
-> Executed 12 times
-> Best workflow discovered
-> Recommended automatically
```

## Memory Types

| Memory | What It Stores |
|---|---|
| Previous fixes | Symptoms, root causes, changed components, verification |
| Previous deployments | Version, environment, approval, result, rollback status |
| Previous incidents | Impact, owner, fix time, recurrence |
| Previous certifications | QA/security/release readiness proof |
| Workflow outcomes | Steps used, skipped steps, duration, success rate |

## Data Model

```text
Operation
-> HAS_WORK_ORDER
-> USED_SKILL
-> ASSIGNED_ROLE
-> TOUCHED_PROJECT
-> HAD_OUTCOME
-> PRODUCED_REPORT
```

Operation properties:

| Property | Purpose |
|---|---|
| `operation_type` | `dashboard_audit`, `code_fix`, `production_deploy` |
| `started_at` | Temporal anchor |
| `completed_at` | Duration calculation |
| `success` | Outcome |
| `readiness_score` | Starting readiness |
| `risk_level` | Risk at execution |
| `approval_required` | Whether gate was needed |
| `approval_id` | Evidence if applicable |

## Best Workflow Discovery

For each operation type:

1. Group by target project and work order type.
2. Compare workflows by success rate and median duration.
3. Penalize workflows with repeated blockers or failed QA.
4. Promote workflow when sample size >= 5 and success rate >= 90 percent.

Example output:

```json
{
  "operation_type": "dashboard_audit",
  "executions": 12,
  "best_workflow": [
    "Resolve project and repo",
    "Check Review Automation dependency",
    "Run Dashboard connector QA",
    "Attach previous audit evidence",
    "Produce CEO report"
  ],
  "confidence": 0.91
}
```

## Retention Policy

| Data | Retention |
|---|---|
| Work order summaries | Permanent |
| Reports/certifications | Permanent |
| PM2 raw logs | Rolling 30-90 days, summarized permanently |
| Incident root causes | Permanent |
| Operational metrics | Rolling aggregate plus monthly snapshot |

## Integration Plan

Operational Memory V2 should first run as read-only analytics over reports and work orders. Later, after approval, it can improve package defaults by recommending known good workflows.

No execution behavior is changed in this phase.
