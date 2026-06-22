# QA_RUNTIME_CERTIFICATION.md
> Phase 4 — QA & Evidence Gate Certification
> Date: 2026-06-18
> Target: QA_GATE_OPERATIONAL

---

## QA Gate Checks (10 checks)

| # | Check Name | Description | Pass Condition |
|---|-----------|-------------|----------------|
| 1 | evidence_exists | Evidence records in SQLite evidence-store | At least 1 evidence row for pipeline_id |
| 2 | qa_independence | QA dept != executor dept | exec_dept_id != 'qa' |
| 3 | no_failed_steps | All pipeline steps completed | 0 steps with status = 'failed' |
| 4 | output_quality | No placeholder / empty outputs | No PLACEHOLDER, TODO, [], {}, null in step outputs |
| 5 | confidence_threshold | Average confidence ≥ 80% | avg(step.confidence) >= 0.80 |
| 6 | request_match | Output references request terms | ≥50% of request keywords found in all outputs |
| 7 | source_truth | Executing dept is registered | dept_id in VALID_DEPARTMENTS (14 entries) |
| 8 | business_requirement_match | Intent category → dept alignment | exec_dept in INTENT_DEPT_MAP[intentCategory] |
| 9 | regression_risk | No destructive shell/SQL patterns | 0 REGRESSION_RISK_PATTERNS matched |
| 10 | evidence_chain | All steps have dept + timestamp | 0 steps missing dept_id or started_at |

---

## Forbidden Verdicts

The following strings are BANNED from QA verdicts:
- `PROVISIONAL`
- `READY`
- `DESIGNED`
- `FRAMEWORK_COMPLETE`
- `REPORT_ONLY_PASS`

Only `PASS` or `FAIL` are valid outputs.

---

## Self-Certification Rule

`canSelfCertify()` always returns `false`.
No department can certify its own work. QA is always external to execution.

---

## Regression Risk Patterns Monitored

| Pattern | Risk |
|---------|------|
| `rm -rf` | Filesystem destruction |
| `DROP TABLE` | Database destruction |
| `DELETE FROM ... WHERE 1=1` | Mass data deletion |
| `format C:` | Drive format |
| `git reset --hard` | Git history loss |
| `git push --force` | Remote history overwrite |
| `TRUNCATE TABLE` | Table wipe |

If any of these appear in pipeline output, check 9 (regression_risk) fails and CEO approval is required before execution.

---

## Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| 10 checks implemented | ✅ |
| PASS/FAIL only | ✅ |
| No self-certification | ✅ |
| Regression risk scan | ✅ |
| Source truth validation | ✅ |
| Business requirement alignment | ✅ |
| Evidence chain completeness | ✅ |
| Verdict persisted to evidence-store | ✅ |

## Status: QA_GATE_OPERATIONAL ✅
