# DEPENDENCY_GRAPH_OPERATIONAL.md
**Status:** OPERATIONAL | **Phase:** 0F | **Engine:** `src/executive-coordination/dependency-graph.ts`

## Graph Model
Edges: fromTaskId → toTaskId with type (blocks, depends_on, related_to, duplicates, conflicts_with, requires_approval, requires_credentials, requires_human, produces_evidence, triggers)

## APIs
POST /api/coordination/dependencies | GET /api/coordination/dependencies | GET /api/coordination/dependencies/task/:id | GET /api/coordination/dependencies/objective/:id | POST /api/coordination/dependencies/check-blockers

## Capabilities
- Topological sort (execution order)
- Upstream/downstream traversal
- Cycle detection (DFS)
- Blocker identification
- Chain description (ASCII)

## Certification Test
Objective "Increase Raw Sushi Revenue 10%" → expected dependencies: GA4 live, GSC live, GBP missing, revenue source missing, content/SEO tasks.
