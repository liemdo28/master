# Phase 18 — Business Knowledge Graph — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-18-knowledge-graph/src/` (`graph.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class KnowledgeGraph` |
| **API route** | `GET /api/agent-os/18` (live summary → `stats()`) |
| **OSS used** | KuzuDB (embedded property graph) — **SELECTED, NOT_INTEGRATED** (Neo4j rejected for embedded use) |
| **Division mapping** | Data Platform (primary) · Intelligence · Executive |
| **Input schema** | `node(entity, links[])`; impact via `impact.analyze(rootId)`; query via `query.shortestPath(a, b)` |
| **Output schema** | `stats{ entities, relationships }` · impact `{ impacted[], impactedCount }` (blast-radius BFS) · path `{ hops, nodes[] }` |
| **Evidence produced** | entities / relationships / impact-analyses stores |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **18/18 PASS** |
| **Status** | **READY** (engine + runtime) · graph-risk **PARTIAL** · OSS **PARTIAL** |

## Capabilities proven
- entity registry (5 entities) ✅ · relationship engine (4 typed edges) ✅
- dependency graph (depends_on / dependents) ✅
- impact analysis — blast-radius BFS (a QB outage reaches doordash→revenue→brand-health→finance; impactedCount=5) ✅
- knowledge query — shortest path (qb→doordash→revenue→brand-health, 3 hops; undirected reachability) ✅
- persistence across restart ✅

## Honest notes
- "Graph risk engine" is **PARTIAL**: impact analysis computes blast radius (the core risk signal), but there is no separate risk-scoring engine layered on the graph yet.
- Traversal is in-engine adjacency; KuzuDB is the governed-but-unwired substrate for Cypher-scale graphs.
