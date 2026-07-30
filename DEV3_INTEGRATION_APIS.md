# DEV3_INTEGRATION_APIS

Generated: 2026-06-13
Owner: Dev2
Consumer: Dev3

## Base URL

```text
http://127.0.0.1:4001
```

## APIs

| Purpose | Method | Endpoint |
|---|---|---|
| Enrich Work Order | GET | `/api/work-orders/enrich` |
| Project Intelligence Graph | GET | `/api/projects/intelligence` |
| Operational entities | GET | `/api/entities/operational` |
| Skill recommendations | GET | `/api/skills/recommend` |
| Risk classification | GET | `/api/risks/classify` |
| Operational memory | GET | `/api/operational-memory` |
| Execution package | GET | `/api/execution-package` |
| Role recommendation | GET | `/api/roles/recommend` |
| Readiness score | GET | `/api/readiness-score` |

## Acceptance Test

Request:

```http
GET /api/work-orders/enrich?input=Mi%20oi%20kiem%20tra%20Dashboard
```

Execution package request:

```http
GET /api/execution-package?input=Mi%20oi%20kiem%20tra%20Dashboard
```

Expected response contains:

| Field | Expected |
|---|---|
| `target_project.name` | `Dashboard` |
| `repository` | Dashboard repo/path |
| `previous_audits` | Knowledge-backed audit/QA/report evidence |
| `active_blockers` | Review Automation dependency blocker check |
| `required_skills` | Dashboard, Review, GitHub, QA, Report |
| `risk_level` | `P2` |
| `recommended_workflow` | Project resolve, evidence attach, health/QA, report |
| `recommended_role` | `QA_AGENT` |
| `readiness_score.score` | `92` for Dashboard audit when Knowledge, repo, skills, workflow, criteria, and dependencies are present |

## Dev3 Recommended Flow

1. Receive CEO request.
2. Call `/api/work-orders/enrich`.
3. If risk is P0/P1, create approval-gated execution plan.
4. Call `/api/execution-package` to create the Role Engine input.
5. Call `/api/projects/intelligence` for deeper repo/service/dependency context when needed.
6. Call `/api/operational-memory` for similar previous incidents/fixes/audits.
7. Invoke recommended skills and role.
8. Return evidence-backed Work Order result to CEO.

## Success Criteria

Mi can use Knowledge Universe to drive execution, not only answer questions. A Dashboard audit request now returns target project, repository, audits, blockers, required skills, risk level, and workflow without manual lookup.
