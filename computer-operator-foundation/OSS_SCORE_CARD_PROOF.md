# OSS Scorecard Proof

## Summary

The OSS Scorecard evaluates ROI, risk, and maintenance cost for each registered project.
It is BLOCKED when observable data is not provided — never fabricating GitHub stats.

## License Evaluation

```python
evaluate_license("MIT")        -> score=1.0, verdict=GREEN
evaluate_license("Apache-2.0")  -> score=1.0, verdict=GREEN
evaluate_license("GPL-3.0")     -> score=0.6, verdict=YELLOW
evaluate_license("AGPL-3.0")    -> score=0.2, verdict=RED
evaluate_license("Proprietary") -> score=0.0, verdict=RED
evaluate_license("UNKNOWN")     -> score=0.3, verdict=UNKNOWN
```

## Community Health — BLOCKED Without Data

```python
evaluate_community_health(stars=None, forks=None, ...)
  -> {"status": "BLOCKED", "reason": "Missing community health data...", "score": None}
```

## Integration Fit — Evaluated With Signals

```python
evaluate_integration_fit(
    has_api=True,
    has_cli=True,
    has_python_sdk=True,
    has_rest_api=True,
    language_match=True,
)
  -> {"status": "EVALUATED", "score": 0.88, "signals": {...}}
```

## Maintenance Burden — BLOCKED Without Data

```python
evaluate_maintenance_burden()
  -> {"status": "BLOCKED", "reason": "No maintenance data provided", "score": None}

evaluate_maintenance_burden(release_frequency_months=1.0, breaking_changes_per_year=0, documentation_quality="excellent")
  -> {"status": "EVALUATED", "score": 0.93, ...}
```

## Full Scorecard Build

```python
sc = build_scorecard(
    project_id="OSS-abc123",
    license_name="Apache-2.0",
    stars=50000, forks=8000, contributors=300, last_commit_days=3,
    has_api=True, has_cli=True, has_python_sdk=True,
    release_frequency_months=1.0, breaking_changes_per_year=0,
    documentation_quality="excellent",
)
# ROI: STRONG_BUY (composite=0.94)
# Risk: LOW (composite=0.18)
```

## ROI Weights

| Component | Weight |
|---|---|
| license_friendlyness | 0.20 |
| community_health | 0.25 |
| integration_fit | 0.30 |
| maintenance_burden | 0.25 |

## ROI Verdicts

| Composite Score | Verdict |
|---|---|
| >= 0.80 | STRONG_BUY |
| >= 0.60 | BUY |
| >= 0.40 | HOLD |
| < 0.40 | PASS |

## CTO Rule: No Fabrication

```python
# When community health data is missing:
community = evaluate_community_health()  # returns BLOCKED, score=None
roi_components["community_health"] = None
# -> roi["status"] = "BLOCKED", roi["blocked_components"] = ["community_health"]
# NO scores are assumed. The scorecard honestly reports BLOCKED.
```
