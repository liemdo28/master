# OPERATIONAL_MEMORY_INDEX

Generated: 2026-06-13
Owner: Dev2

## Purpose

Operational Memory Index lets Mi answer:

```text
Da tung bi loi nay chua?
```

with previous incidents, root causes, fixes, audits, deployments, and outcomes.

## API

```http
GET /api/operational-memory?query=dashboard%20incident
```

## Indexed Tracks

| Track | Meaning |
|---|---|
| `previous_incidents` | Past runtime/business failures |
| `previous_fixes` | Root cause and remediation evidence |
| `previous_audits` | QA/security/knowledge/project audit reports |
| `previous_deployments` | Release, deploy, rollback, readiness evidence |

## Current Implementation

The first implementation queries the existing Knowledge Universe local index with operational terms and returns source-bearing matches.

Default query:

```text
incident fix audit deployment QA blocker
```

## Result Shape

```json
{
  "tracks": ["previous_incidents", "previous_fixes", "previous_audits", "previous_deployments"],
  "matches": [
    {
      "title": "DASHBOARD_CONNECTOR_SYNC_VALIDATION",
      "source": "master-workspace",
      "category": "report",
      "file_path": "...",
      "snippet": "..."
    }
  ]
}
```

## Dev3 Usage

For any Work Order with `fix`, `incident`, `bug`, `audit`, `deploy`, or `rollback`, Dev3 should call Operational Memory before generating a plan. The answer should state whether a similar problem has evidence, what fixed it, and what still needs verification.
