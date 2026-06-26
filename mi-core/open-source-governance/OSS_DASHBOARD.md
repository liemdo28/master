# OSS Dashboard

Status:

```text
OSS_DASHBOARD_OPERATIONAL
```

Runtime source:

- `server/src/open-source-governance/oss-dashboard.ts`

Dashboard fields:

- totalProjects
- byCategory
- byStatus
- riskSummary
- pilotCandidates
- productionCandidates
- blockedProjects

Runtime proof snapshot:

```json
{
  "totalProjects": 27,
  "byCategory": {
    "Engineering": 6,
    "Operator": 5,
    "Finance": 5,
    "Marketing": 4,
    "IT": 4,
    "Creative": 3
  },
  "byStatus": {
    "Discovery": 26,
    "Audit": 1
  }
}
```
