# INCIDENT_INTELLIGENCE_REPORT

Generated: 2026-06-13
Status: DESIGN_ONLY

## Directive Boundary

No Work Order contract change. No Role Engine, Approval Engine, or QA Engine implementation.

## Objective

Design an Incident Intelligence Engine that answers:

- Loi nay da tung xay ra chua?
- Ai fix lan gan nhat?
- Root cause la gi?
- Mat bao lau de fix?
- Co tai dien khong?

## Sources

| Source | Incident Evidence |
|---|---|
| Audit reports | Findings, severity, remediation |
| QA reports | Failing checks, pass/fail history |
| Deployment reports | Release timing, rollback, environment |
| Work Orders | Request, owner, status, result |
| PM2 logs | Runtime failures, restarts, timestamps |
| Certification reports | Readiness, residual risk, signoff |

## Incident Entity Model

Node labels:

| Label | Properties |
|---|---|
| `Incident` | `id`, `title`, `severity`, `opened_at`, `resolved_at`, `recurrence_key` |
| `RootCause` | `summary`, `category`, `evidence_path` |
| `Fix` | `summary`, `owner`, `duration_minutes`, `commit_or_report` |
| `Service` | `name`, `environment`, `health_url` |
| `Report` | `path`, `type`, `created_at` |

Relationships:

```text
Incident -> AFFECTED -> Service/Project
Incident -> CAUSED_BY -> RootCause
Incident -> FIXED_BY -> Fix
Fix -> PERFORMED_BY -> Owner
Incident -> EVIDENCED_BY -> Report
Incident -> RECURS_WITH -> Incident
```

## Matching Strategy

1. Normalize incident text.
2. Extract project, service, symptom, error signature, and time window.
3. Search Knowledge Universe for matching reports/logs.
4. Query graph for same `recurrence_key`.
5. Return last occurrence, owner, root cause, fix, duration, and recurrence count.

Recurrence key:

```text
project + service + normalized_symptom + root_cause_category
```

## Example Output

```json
{
  "query": "Dashboard connector down",
  "seen_before": true,
  "last_seen": "2026-06-12",
  "last_owner": "QA_AGENT",
  "root_cause": "Connector API health unavailable",
  "last_fix": "Re-sync Dashboard connector and rerun QA",
  "duration_minutes": 45,
  "recurrence_count": 2,
  "evidence": ["reports/DASHBOARD_CONNECTOR_SYNC_VALIDATION.md"]
}
```

## Architecture

```text
Knowledge Search
-> Candidate incident evidence
-> Incident extractor
-> Incident graph writer
-> Recurrence matcher
-> Incident answer generator
```

## Guardrails

- Never infer a root cause without evidence.
- If duration is missing, return `duration_unknown`.
- If owner is missing, return `owner_unknown`.
- Do not trigger remediation; Dev3 owns execution.

## Integration Plan

Future approved integration can add incident intelligence as a read-only enrichment source for `/api/execution-package`, but this design phase does not change the API.
