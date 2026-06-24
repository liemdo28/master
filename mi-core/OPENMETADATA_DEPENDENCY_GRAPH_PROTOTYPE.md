# OPENMETADATA_DEPENDENCY_GRAPH_PROTOTYPE

Generated: 2026-06-13
Status: RESEARCH_ONLY

## Objective

Design an OpenMetadata-inspired dependency graph prototype:

```text
Dashboard
-> depends_on
Review Automation
-> depends_on
Mi-Core
-> depends_on
Knowledge Universe
```

## Questions Mi Must Answer

- Neu Review Automation loi thi project nao bi anh huong?
- Project nao phu thuoc Mi-Core?
- Service nao la single point of failure?
- Ai dang owner service do?

## Prototype Entities

| Entity | OpenMetadata Candidate | Mi Type |
|---|---|---|
| Dashboard | Data Product + Dashboard Service | Project |
| Review Automation | Pipeline Service | Service |
| Mi-Core | API/custom service | Core System |
| Knowledge Universe | Data Product + DB/Search services | Core Knowledge System |
| Dev3 | Team/User | Owner |
| QA_AGENT | Team | Owner |

## Prototype Lineage / Dependency Edges

```json
[
  {
    "from": "Dashboard",
    "to": "Review Automation",
    "type": "depends_on",
    "criticality": "high",
    "failure_mode": "Dashboard audit/signoff loses review evidence"
  },
  {
    "from": "Review Automation",
    "to": "Mi-Core",
    "type": "depends_on",
    "criticality": "critical",
    "failure_mode": "Review automation cannot route evidence or status"
  },
  {
    "from": "Mi-Core",
    "to": "Knowledge Universe",
    "type": "depends_on",
    "criticality": "critical",
    "failure_mode": "Execution packages lose evidence enrichment"
  }
]
```

## OpenMetadata API Concept

OpenMetadata Lineage API can retrieve upstream/downstream lineage by entity id or fully qualified name with depth.

Prototype query shape:

```text
GET /api/v1/lineage/{entity}/{id}?upstreamDepth=3&downstreamDepth=3
```

Mi should not expose this as a new production API during frozen phase. It is a candidate internal read path only.

## Answer Design

Question:

```text
Neu Review Automation loi thi project nao bi anh huong?
```

Expected answer:

```json
{
  "failed_service": "Review Automation",
  "affected_projects": ["Dashboard"],
  "affected_systems": ["Dashboard audit/signoff workflow"],
  "owner": ["QA_AGENT", "Dev3"],
  "criticality": "high",
  "reason": "Dashboard depends on Review Automation for review evidence and audit completion"
}
```

Question:

```text
Project nao phu thuoc Mi-Core?
```

Expected answer:

```json
{
  "dependency": "Mi-Core",
  "dependent_projects": ["Dashboard", "Review Automation", "WhatsApp AI Gateway"],
  "single_point_of_failure": true,
  "owner": ["Dev2", "Dev3"]
}
```

## Single Point of Failure Rule

A service is a single point of failure when:

```text
downstream_critical_dependents >= 2
AND fallback_service is empty
AND criticality in [high, critical]
```

## Prototype Limitations

- OpenMetadata lineage is designed mainly for data lineage, not arbitrary service dependency graphs.
- Custom services or custom properties may be needed for Mi-specific dependency types.
- OpenMetadata should not become the runtime decision engine.

## Prototype Verdict

OpenMetadata can represent this graph well enough for lineage and ownership exploration, but Mi should keep dependency intelligence logic in Mi V2 unless OpenMetadata is later approved as an external metadata service.
