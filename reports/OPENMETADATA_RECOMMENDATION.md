# OpenMetadata Recommendation
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE — FINAL VERDICT  
**Analyst:** Mi Operating Backend

---

## Verdict: DO_NOT_ADOPT_YET

**Adopt OM's concepts. Do not deploy OM's infrastructure.**

---

## 1. Executive Summary

OpenMetadata is a well-designed, enterprise-grade metadata platform. Its entity model, ownership graph, and lineage DAG are exactly the right abstractions for Mi's Knowledge Universe V2. **The problem is not the concepts — the problem is the infrastructure cost.**

Deploying OpenMetadata on Mi's current machine would consume more RAM than all existing Mi services combined. The three CEO-level questions that motivated this research (who owns what, what depends on what, what are the single points of failure) can be answered with 3 SQL queries against the existing SQLite database — no Docker stack required.

**Recommended action:** Extract OpenMetadata's entity model, ownership model, and lineage graph as design patterns. Implement them natively in Mi's existing SQLite database. Revisit full OM deployment when Mi scales to 20+ projects or needs a data catalog UI for non-technical stakeholders.

---

## 2. Reasoning

### Why NOT adopt OM now

| Blocker | Detail |
|---------|--------|
| Resource footprint | 9 GB RAM minimum (Dev mode). Mi's total current footprint: ~400 MB |
| Dependency burden | Requires Docker Desktop, MySQL 8, Elasticsearch 8, Java 17 |
| Maintenance cost | 3 additional services to monitor, update, and troubleshoot |
| Connector gap | No pre-built Mi connector — requires 3 days of custom Python development |
| Semantic mismatch | OM lineage = data flow (table → dashboard). Mi deps = service calls (A calls B) |
| Overkill for scope | Mi has 7 services, 1 owner, 5 dependency edges — a SQLite table handles this in 100 lines |

### Why OM's concepts ARE right

| Value | Detail |
|-------|--------|
| Entity model | Typed entities with owner, tags, custom properties — correct abstraction |
| Ownership model | Team → User → Entity hierarchy is the right structure for Mi |
| Lineage DAG | Directed edges for dependencies are the correct representation |
| Orphan detection | Automated detection of unowned services is valuable |
| Impact analysis | "What breaks if X goes down?" is exactly what Mi needs |

**The concepts are right. The deployment is wrong for Mi's current scale.**

---

## 3. What to Adopt Now (Option B)

### Implement the OM entity model natively in SQLite

**Target file:** `mi-core/data/qb-agent.db`

```sql
-- Knowledge Universe V2 tables (OM-compatible schema, SQLite storage)
CREATE TABLE ku_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'active',        -- active | deprecated | archived
  criticality TEXT DEFAULT 'MEDIUM',   -- CRITICAL | HIGH | MEDIUM | LOW
  port INTEGER,
  owner_id TEXT,                       -- FK to ku_users
  team_id TEXT,                        -- FK to ku_teams
  runbook_path TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ku_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  project_id TEXT,
  port INTEGER,
  status TEXT,
  restart_count INTEGER DEFAULT 0,
  last_seen TEXT
);

CREATE TABLE ku_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE
);

CREATE TABLE ku_teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE ku_lineage_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity TEXT NOT NULL,
  to_entity TEXT NOT NULL,
  edge_type TEXT DEFAULT 'runtime',
  created_at TEXT DEFAULT (datetime('now'))
);
```

**API endpoints to add to mi-core:**
```
GET /api/knowledge/graph              — full graph (projects + services + edges)
GET /api/knowledge/spof               — single points of failure analysis
GET /api/knowledge/owners             — ownership report
GET /api/knowledge/impact/:service    — what breaks if :service goes down
```

**CEO questions answered:**
- "What depends on mi-core?" → `SELECT from_entity FROM ku_lineage_edges WHERE to_entity='mi-core'`
- "Who owns what?" → JOIN `ku_projects` + `ku_users`
- "SPOFs?" → `SELECT to_entity, COUNT(*) FROM ku_lineage_edges GROUP BY to_entity ORDER BY COUNT(*) DESC`

**Effort: 2-3 days. Zero new infrastructure.**

---

## 4. Risks of NOT Adopting Full OM

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Mi outgrows native SQLite (20+ projects) | LOW (6-12 months) | MEDIUM | Migrate to OM at that point; schema is OM-compatible |
| Catalog UI needed for non-technical stakeholders | LOW | MEDIUM | Add simple read-only dashboard view in mi-core |
| Connector ecosystem missed (Postgres, Superset) | LOW | LOW | Mi has no analytics data stack currently |
| OM community moves ahead, harder to adopt later | VERY LOW | LOW | Apache 2.0, stable API — migration path always available |

**None of these risks materialize in the next 6 months given Mi's current scale.**

---

## 5. When to Revisit Full OM Deployment

Trigger any one of these conditions:

| Trigger | Action |
|---------|--------|
| Mi grows to 20+ projects | Evaluate Option C (hybrid: separate VM for OM) |
| Team grows to 3+ engineers | Full OM ownership UI becomes valuable |
| Analytics/BI stack is added (Superset, Metabase) | OM's pre-built connectors justify deployment |
| CEO needs browsable catalog UI | Build OM UI or build Mi-native dashboard |
| Machine RAM upgraded to 32+ GB | Revisit Option A (local OM deployment) |

---

## 6. Implementation Roadmap

### Phase 1 (Now, 2-3 days)
- [ ] Add `ku_*` tables to `qb-agent.db`
- [ ] Write initial data (7 projects, 1 owner, 5 dependency edges)
- [ ] Add `knowledge-graph.ts` module to mi-core
- [ ] Add 4 API endpoints
- [ ] Add pm2 sync job (updates `ku_services` every 60s)

### Phase 2 (Next sprint, 1-2 days)
- [ ] Add dependency graph view to Mi Dashboard
- [ ] Add SPOF alert to GStack health check
- [ ] Add "unowned services" check to QA certification (G3 extension)

### Phase 3 (Future, when triggered)
- [ ] Evaluate OM deployment if scale triggers met
- [ ] Write Mi → OM ingestion connector (Python)
- [ ] Migrate `ku_*` data to OM (schema is already OM-compatible)

---

## 7. Final Recommendation Statement

> **DO_NOT_ADOPT_YET — Partial adoption of concepts, not infrastructure.**
>
> OpenMetadata's entity model and lineage concepts are the correct foundation for Mi Knowledge Universe V2. Deploy these patterns natively in SQLite with zero infrastructure overhead. Full OM deployment should be triggered by scale (20+ projects, 3+ engineers, analytics stack) — none of which apply today.
>
> Expected value from native implementation: CEO gets ownership graph, SPOF analysis, and impact queries within 2-3 days, at zero infrastructure cost.
>
> Expected value from full OM: same CEO queries + catalog UI + connector ecosystem — at the cost of 9 GB RAM, 7 days of integration work, and ongoing Docker maintenance.
>
> **The math clearly favors Option B.**

---

## 8. Document Index

| Document | Contents |
|----------|----------|
| `OPENMETADATA_FIT_ANALYSIS.md` | OM architecture, metadata model, Windows support, resource requirements |
| `OPENMETADATA_MI_MAPPING.md` | OM entities mapped to Mi concepts with fidelity scores |
| `OPENMETADATA_DEPENDENCY_GRAPH_PROTOTYPE.md` | Dependency graph design, SPOF analysis, CEO questions answered |
| `OPENMETADATA_OWNERSHIP_GRAPH.md` | Ownership landscape, concentration risk, transfer scenarios |
| `OPENMETADATA_INTEGRATION_PLAN.md` | Options A/B/C with effort estimates, pros/cons, comparison matrix |
| `OPENMETADATA_RECOMMENDATION.md` | *(this document)* Final verdict + implementation roadmap |
