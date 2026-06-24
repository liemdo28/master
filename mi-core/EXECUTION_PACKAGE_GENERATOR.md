# EXECUTION_PACKAGE_GENERATOR

Generated: 2026-06-13
Owner: Dev2
Consumer: Dev3 Role Engine

## Purpose

`ExecutionPackageGenerator` converts Knowledge-enriched Work Orders into executable operational packages. Dev3 can hand the package directly to the Role Engine.

## API

```http
GET /api/execution-package?input=Mi%20oi%20kiem%20tra%20Dashboard
```

## Required Fields

| Field | Meaning |
|---|---|
| `target_project` | Resolved project identity, repo, location, owners |
| `risk_level` | P0-P3 operational risk |
| `required_skills` | Skills Dev3 should load |
| `recommended_role` | `QA_AGENT`, `RELEASE_AGENT`, `DEV_AGENT`, `AUDITOR_AGENT`, `PM_AGENT`, or `CEO_INTERPRETER` |
| `workflow_steps` | Ordered role-owned execution steps |
| `estimated_duration` | Human-readable duration estimate |
| `approval_required` | Whether CEO approval is required before mutation |
| `success_criteria` | Measurable completion criteria |

## Role Recommendation Rules

| Work Order | Role |
|---|---|
| `dashboard_audit` | `QA_AGENT` |
| `production_deploy` | `RELEASE_AGENT` |
| `code_fix` | `DEV_AGENT` |
| `security_audit` | `AUDITOR_AGENT` |

## Dependency Intelligence

The package includes:

| Field | Meaning |
|---|---|
| `blocked_by` | Known blockers that must be checked |
| `depends_on` | Runtime/repo/service dependencies |
| `prerequisite_steps` | Required checks before execution |

Dashboard deploy/audit depends on Review Automation API or evidence path before final signoff.

## Success Criteria Rule

No package may rely on generic `DONE`. Criteria must be measurable, for example:

- Repository and runtime target identified.
- Prior audit and QA evidence attached.
- Active blockers explicitly listed.
- Health or connector QA result recorded.
- Final findings classified with severity and next action.

## Readiness Score

Readiness score is 0-100 and explains both strengths and missing pieces.

Dashboard Audit target:

```text
92/100
```

Reason:

- Knowledge available
- Repo found
- Skills found
- Workflow known
- Measurable criteria generated
- Dependencies known
- Known blocker attached as execution risk
