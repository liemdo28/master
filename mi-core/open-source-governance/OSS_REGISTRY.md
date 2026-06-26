# OSS Registry

Status:

```text
OSS_REGISTRY_OPERATIONAL
```

Runtime source:

- `server/src/open-source-governance/oss-registry.ts`
- `server/src/open-source-governance/seed-candidates.ts`

Runtime data location:

- `.mi-harness/open-source-governance/projects/`

Registry fields:

- project_id
- name
- category
- github
- owner_division
- status
- roi
- maintenance_cost
- license
- risk
- evidence

Truth rule:

```text
All seeded project licenses are UNVERIFIED until a real audit records evidence.
```
