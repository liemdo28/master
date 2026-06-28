# DEPENDENCY_INTELLIGENCE_REPORT

Generated: 2026-06-13
Status: DESIGN_ONLY

## Directive Boundary

No locked Dev3 API changes. No new execution logic. This is architecture and prototype design only.

## Objective

Design a Dependency Intelligence Engine that answers:

- Neu Dashboard chet thi anh huong gi?
- Neu Review Automation loi thi project nao bi anh huong?
- Project nao dang la single point of failure?
- Service nao la critical path?

## Core Model

Dependency Intelligence should treat every dependency as an operational edge, not plain text.

```text
Project/Service
-> DEPENDS_ON
Project/Service/DataSource/API/Node/Owner
```

Edge properties:

| Property | Purpose |
|---|---|
| `criticality` | `critical`, `high`, `medium`, `low` |
| `failure_mode` | What happens when dependency fails |
| `fallback` | Whether there is an alternate path |
| `owner` | Who must respond |
| `last_verified_at` | Freshness |
| `source_report` | Evidence |

## Prototype Dependency Map

```text
Dashboard
-> Mi-Core API
-> Review Automation
-> Visibility cache
-> Bakudan project data

Review Automation
-> Mi-Core
-> Laptop1
-> Agent-Coding stack

WhatsApp AI Gateway
-> Mi-Core
-> WhatsApp session storage
-> API key manager
```

## Required Queries

Impact of a failed node:

```cypher
MATCH path = (affected)-[:DEPENDS_ON*1..4]->(failed {id: $failed_id})
RETURN affected, path;
```

Single point of failure:

```cypher
MATCH (p:Project)-[:DEPENDS_ON*1..3]->(d)
WITH d, collect(DISTINCT p) AS projects
WHERE size(projects) >= 2
RETURN d, projects, size(projects) AS blast_radius
ORDER BY blast_radius DESC;
```

Critical path:

```cypher
MATCH path = (p:Project)-[:DEPENDS_ON*1..5]->(d)
WHERE all(r IN relationships(path) WHERE r.criticality IN ["critical", "high"])
RETURN p, path;
```

## Engine Output Shape

```json
{
  "target": "Review Automation",
  "blast_radius": ["Dashboard", "Bakudan project data workflows"],
  "single_point_of_failure": true,
  "critical_paths": [
    "Dashboard -> Review Automation -> Mi-Core"
  ],
  "required_owner": "QA_AGENT",
  "recommended_action": "Block Dashboard signoff until Review Automation evidence path is verified"
}
```

## Integration Plan

Dependency Intelligence V2 should not replace `/api/execution-package`. It should feed the existing package generator later, after approval, by improving `depends_on`, `blocked_by`, and `prerequisite_steps`.

Phase gates:

1. Import existing operational seeds into prototype graph.
2. Import project scanner results.
3. Import report evidence as `Report` nodes.
4. Compare graph answer against current execution package output.
5. Only after CEO approval, make the package generator read from graph instead of static seed fallback.

## Success Metrics

| Metric | Target |
|---|---|
| Dashboard impact query latency | < 200 ms local |
| 3-hop dependency traversal | < 200 ms local |
| Unknown dependency rate | < 10 percent for critical projects |
| Single point of failure identification | 100 percent for Dashboard, Mi-Core, Review Automation, WhatsApp Gateway |
