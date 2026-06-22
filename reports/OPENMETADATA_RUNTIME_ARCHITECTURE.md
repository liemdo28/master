# OpenMetadata Runtime Architecture
**Phase 14 — Graph Intelligence Runtime**
**Status: PRODUCTION**

---

## Runtime Selection Rationale

### Options Evaluated

| Option | Technology | Verdict |
|--------|-----------|---------|
| A — OpenMetadata Docker | Elasticsearch + MySQL + Java services | REJECTED |
| B — Lightweight Graph Runtime | SQLite + in-memory adjacency traversal | SELECTED |
| C — Neo4j Embedded | JVM-based graph database | REJECTED |

**Why Option B was selected:**

- The project already uses `better-sqlite3` for the Knowledge DB — zero new dependencies
- OpenMetadata Docker requires 3+ external services (MySQL, Elasticsearch, Airflow); not suitable for a local-first, offline-capable system
- SQLite WAL mode provides concurrent reads without blocking writes
- Directed adjacency list traversal is sufficient for the graph depth required (≤6 hops)
- Cold-start time: <50ms vs. Docker stack ~30s

---

## SQLite Graph Design

### Schema

```sql
CREATE TABLE entities (
  id          TEXT PRIMARY KEY,          -- "project:dashboard"
  name        TEXT NOT NULL,             -- "Dashboard"
  type        TEXT NOT NULL,             -- project | service | store | owner | team | repository
  description TEXT DEFAULT '',
  metadata    TEXT DEFAULT '{}',         -- JSON blob
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE edges (
  id           TEXT PRIMARY KEY,         -- "{from}__{rel}__{to}"
  from_id      TEXT NOT NULL,
  to_id        TEXT NOT NULL,
  relationship TEXT NOT NULL,            -- owner_of | depends_on | contains | supports | responsible_for
  weight       INTEGER DEFAULT 5,        -- 1-10; ≥8 = critical
  metadata     TEXT DEFAULT '{}',
  created_at   TEXT DEFAULT (datetime('now')),
  UNIQUE(from_id, to_id, relationship)
);

CREATE INDEX idx_edges_from ON edges(from_id);
CREATE INDEX idx_edges_to   ON edges(to_id);
```

### Conventions

- **Entity IDs** are `type:slug` (e.g., `project:mi-core`, `owner:hoang`)
- **Edge weight** encodes criticality: 10 = mission-critical, 7-9 = high, 5-6 = medium, 1-4 = low
- **WAL mode** enabled for concurrent read access from multiple modules
- **Idempotent seeding** via `INSERT OR REPLACE` — safe to call on every server boot

### Database Location

```
.local-agent-global/graph/graph.db
```

---

## Module Map

```
mi-core/server/src/graph/
├── graph-db.ts              — SQLite schema, CRUD, entity resolution
├── graph-seed.ts            — Idempotent boot seeder (Mi project graph)
├── ownership-graph.ts       — Ownership queries, owner load
├── dependency-intelligence.ts — Upstream/downstream traversal, SPOF, impact
├── risk-propagation.ts      — Cascade simulation, blast radius
├── ownership-intelligence.ts — Higher-level ownership intelligence APIs
├── graph-router.ts          — 12 REST routes at /api/graph/*
└── graph-execution-context.ts — Advisory enrichment for Dev3 (non-breaking)
```

---

## Integration Points

- **Boot**: `graph-router.ts` calls `seedGraph()` on first import → DB is always ready
- **REST API**: mounted at `/api/graph` in `index.ts` (line 149)
- **Dev3 advisory**: `graph-execution-context.ts` provides optional enrichment — never modifies existing contracts
- **Knowledge DB**: separate DB file; no cross-DB dependency

---

## Performance Characteristics

| Operation | Typical latency |
|-----------|----------------|
| Entity lookup by ID | <1ms |
| Ownership query | <2ms |
| Full dependency tree (depth 6) | <5ms |
| Impact analysis | <10ms |
| System risk report (all entities) | <25ms |
| Graph seeding (idempotent) | <15ms |
