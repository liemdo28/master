# PROJECT_KNOWLEDGE_GRAPH_REPORT

Generated: 2026-06-13
Status: DESIGN_ONLY
Target status: KNOWLEDGE_UNIVERSE_V2_DESIGN_READY

## Directive Boundary

This report does not modify the locked Dev3 integration contract. No production API, Work Order contract, Role Engine, Approval Engine, or QA Engine change is included.

Locked APIs remain unchanged:

- `/api/execution-package`
- `/api/work-orders/enrich`
- `/api/projects/intelligence`
- `/api/skills/recommend`
- `/api/risks/classify`

## Objective

Design and prototype a Project Knowledge Graph:

```text
Project
-> Repository
-> Dependency
-> Owner
-> Service
-> Report
```

Example target traversal:

```text
Dashboard
-> depends_on
-> Review Automation
-> depends_on
-> Mi-Core
```

## Engine Research

| Engine | Strength | Local Deployment | Windows Compatibility | Agent Fit | Recommendation |
|---|---|---|---|---|---|
| Neo4j | Mature durable property graph, Cypher, strong ecosystem | Docker, Windows ZIP/service, Desktop | Strong | Strong for stable project graph and explainable traversal | Best durable default |
| Memgraph | In-memory real-time graph, Cypher-compatible style, streaming focus | Docker, Memgraph Platform, WSL on Windows | Good via Docker/WSL | Strong for live operational dependency traversal | Best real-time candidate |
| Graphiti | Temporal context graph for AI agents, provenance, changing facts | Python framework, typically backed by graph/vector/full-text components | Depends on Python/backend stack | Best temporal agent memory candidate | Best temporal layer, not primary durable project DB |

## Research Sources

- Neo4j Docker and operations documentation: https://neo4j.com/docs/operations-manual/current/docker/introduction/
- Neo4j Windows installation documentation: https://neo4j.com/docs/operations-manual/current/installation/windows/
- Neo4j operations introduction: https://neo4j.com/docs/operations-manual/current/introduction/
- Memgraph getting started documentation: https://memgraph.com/docs/getting-started
- Memgraph Docker installation documentation: https://memgraph.com/docs/getting-started/install-memgraph/docker
- Memgraph WSL installation documentation: https://memgraph.com/docs/getting-started/install-memgraph/wsl
- Graphiti GitHub: https://github.com/getzep/graphiti
- Graphiti platform overview: https://www.getzep.com/platform/graphiti/

## Prototype Graph Model

Node labels:

| Label | Required Properties |
|---|---|
| `Project` | `id`, `name`, `status`, `criticality` |
| `Repository` | `url`, `local_path`, `branch`, `dirty` |
| `Dependency` | `id`, `name`, `kind`, `criticality` |
| `Owner` | `id`, `name`, `role`, `capacity` |
| `Service` | `id`, `name`, `port`, `health_url`, `environment` |
| `Report` | `id`, `title`, `path`, `type`, `created_at` |

Relationship types:

| Relationship | From | To |
|---|---|---|
| `HAS_REPOSITORY` | Project | Repository |
| `DEPENDS_ON` | Project/Service | Project/Service/Dependency |
| `OWNED_BY` | Project/Service | Owner |
| `EXPOSES_SERVICE` | Project | Service |
| `HAS_REPORT` | Project/Service | Report |
| `BLOCKED_BY` | Project | Dependency |
| `CERTIFIED_BY` | Project/Release | Report |

## Prototype Cypher

```cypher
MERGE (dashboard:Project {id: "dashboard", name: "Dashboard", criticality: "high"})
MERGE (review:Project {id: "review-automation", name: "Review Automation", criticality: "high"})
MERGE (mi:Project {id: "mi-core", name: "Mi-Core", criticality: "critical"})
MERGE (repo:Repository {local_path: "E:/Project/Master/Bakudan/dashboard.bakudanramen.com"})
MERGE (owner:Owner {id: "qa-agent", name: "QA Agent", role: "QA_AGENT"})
MERGE (report:Report {path: "reports/DASHBOARD_CONNECTOR_SYNC_VALIDATION.md", type: "qa"})
MERGE (dashboard)-[:HAS_REPOSITORY]->(repo)
MERGE (dashboard)-[:DEPENDS_ON]->(review)
MERGE (review)-[:DEPENDS_ON]->(mi)
MERGE (dashboard)-[:OWNED_BY]->(owner)
MERGE (dashboard)-[:HAS_REPORT]->(report);
```

Impact traversal:

```cypher
MATCH path = (:Project {id: "dashboard"})-[:DEPENDS_ON*1..3]->(:Project)
RETURN path;
```

Reverse impact traversal:

```cypher
MATCH path = (:Project)-[:DEPENDS_ON*1..3]->(:Project {id: "review-automation"})
RETURN path;
```

## Local Prototype Benchmark

Prototype: in-memory JavaScript adjacency list, synthetic graph with project, repo, owner, service, report, and dependency edges. This is not a database benchmark; it validates traversal shape and expected cardinality.

| Projects | Edges | Samples | Avg 3-hop traversal | Avg nodes touched |
|---:|---:|---:|---:|---:|
| 100 | 900 | 200 | 0.0123 ms | 60 |
| 1,000 | 9,000 | 200 | 0.0104 ms | 60 |
| 5,000 | 45,000 | 200 | 0.0067 ms | 60 |
| 10,000 | 90,000 | 200 | 0.0057 ms | 60 |

Interpretation: graph traversal shape is small enough for real-time answering. The production decision should be based on durability, temporal facts, query language, agent integration, and operational maintenance.

## Recommendation

Use a two-tier V2 graph plan:

1. Neo4j as the durable Project Knowledge Graph candidate.
2. Graphiti as the temporal operational memory layer candidate.
3. Memgraph as the real-time dependency traversal alternative if in-memory speed and stream updates become more important than mature Neo4j ecosystem support.

No rollout is approved in this phase.
