# OSS Lifecycle Engine Proof

## Summary

The Lifecycle Engine orchestrates projects through 8 stages with gate checks.
No project can skip stages. Every transition writes evidence to disk.

## Stage Gate Test (Runtime Proof)

```text
[PASS] 8_stage_gates          — 8 gates defined
[PASS] retired_is_terminal    — RETIRED next_action is None
[PASS] can_advance_to_audit   — gate check allows DISCOVERY→AUDIT
[PASS] cannot_skip_stages     — gate check blocks DISCOVERY→PRODUCTION
[PASS] advance_to_audit       — actual stage transition verified
```

## Gate Check Proof

```
can_advance("DISCOVERY", "AUDIT")
  -> allowed=True, reason="Stage gate satisfied"

can_advance("DISCOVERY", "PRODUCTION")
  -> allowed=False, reason="Cannot jump from DISCOVERY to PRODUCTION. Max one step forward at a time."

can_advance("RETIRED", "MAINTENANCE")
  -> allowed=False, reason="RETIRED is terminal — cannot advance further"
```

## Advancement Sequence

| From | To | Allowed |
|---|---|---|
| DISCOVERY | AUDIT | ✅ |
| AUDIT | ROI | ✅ |
| ROI | ARCHITECTURE_REVIEW | ✅ |
| ARCHITECTURE_REVIEW | PILOT | ✅ |
| PILOT | PRODUCTION | ✅ |
| PRODUCTION | MAINTENANCE | ✅ |
| MAINTENANCE | RETIRED | ✅ |
| DISCOVERY | PRODUCTION | ❌ (skips stages) |
| RETIRED | MAINTENANCE | ❌ (terminal) |
| AUDIT | DISCOVERY | ❌ (backwards) |

## Evidence Writing

Every `advance_stage()` call writes:
- `{event_id}.json` to `oss_governance/evidence/`
- Contains: event_id, project_id, from_stage, to_stage, approver, notes, gate, timestamp

## Pipeline Health Logic

```python
stuck_count = projects_in(DISCOVERY) + projects_in(AUDIT) + projects_in(ROI)
active_count = projects_in(ARCHITECTURE_REVIEW) + projects_in(PILOT) + projects_in(PRODUCTION) + projects_in(MAINTENANCE)

pipeline_health = "HEALTHY"  if stuck_count < active_count
               = "SLOW"     if stuck_count <= active_count * 2
               = "BLOCKED"  if stuck_count > active_count * 2
```

## Runtime Proof Result

```text
[PASS] pipeline_has_stages  — by_stage dict exists
[PASS] pipeline_total       — total_projects = 27
```
