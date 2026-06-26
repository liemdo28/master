# OSS Governance Dashboard Proof

Runtime test:

```powershell
node tests\phase05-oss-governance-runtime-test.mjs
```

Observed dashboard:

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
    "Audit": 1,
    "ROI": 0,
    "Architecture Review": 0,
    "Pilot": 0,
    "Production": 0,
    "Maintenance": 0,
    "Retirement": 0
  },
  "riskSummary": {
    "low": 10,
    "medium": 15,
    "high": 0,
    "unknown": 2
  },
  "pilotCandidates": [],
  "productionCandidates": [],
  "blockedProjects": []
}
```

Dashboard status:

```text
OSS_DASHBOARD_OPERATIONAL
```
