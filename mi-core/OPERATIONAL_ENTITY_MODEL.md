# OPERATIONAL_ENTITY_MODEL

Generated: 2026-06-13
Owner: Dev2

## Purpose

The operational entity model extends Knowledge Universe beyond static project/store entities so Mi can reason about live operating state.

## API

```http
GET /api/entities/operational
```

## New Entity Types

| Entity | Purpose |
|---|---|
| `work_order` | CEO/Dev3 execution request with status, priority, assignee |
| `blocker` | Condition preventing execution or release |
| `deployment` | Release or runtime deployment event |
| `certification` | QA/security/production readiness proof |
| `release` | Versioned delivery event |
| `incident` | Runtime/business failure event |
| `risk` | Known or inferred execution risk |
| `dependency` | Required system, service, repo, owner, or data source |

## Entity Shape

```json
{
  "id": "blocker.dashboard.1",
  "type": "blocker",
  "name": "Review Automation dependency must be checked for blocker status",
  "attributes": {
    "project": "Dashboard",
    "owner": "Liem Do, Dev3 operating backend, QA agent"
  },
  "source": "operational-seed"
}
```

## Sources

| Source | Entity Types |
|---|---|
| GStack work order engine | `work_order` |
| Knowledge graph | Existing `project`, `store`, `person`, `node`, `service`, `document` |
| Operational seed model | `blocker`, `risk`, `dependency` |
| Future event ingestion | `deployment`, `certification`, `release`, `incident` |

## Required Answer

Question:

```text
Dev nao dang giu blocker?
```

Process:

1. Filter `type=blocker`.
2. Read `attributes.owner`.
3. Group by project and owner.
4. Return the blocker source and project context.
