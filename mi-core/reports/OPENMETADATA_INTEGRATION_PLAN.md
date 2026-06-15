# OpenMetadata Integration Plan
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE  
**Analyst:** Mi Operating Backend

---

## 1. Purpose

Evaluate three integration options for bringing OpenMetadata concepts into Mi's Knowledge Universe V2. Each option trades complexity, resource cost, and fit against the specific capabilities Mi needs.

---

## 2. Integration Options Overview

| Option | Name | Approach |
|--------|------|---------|
| A | External OM Service | Deploy full OpenMetadata stack; sync Mi data to OM |
| B | Extract Concepts | Extract OM's entity model and ownership concepts; implement natively in SQLite/JSON |
| C | Hybrid Lineage + Execution | Deploy OM only for lineage/catalog; keep Mi engines for operations |

---

## 3. Option A: External OpenMetadata Service

### What it is
Deploy the full OpenMetadata Docker stack (server + MySQL + Elasticsearch). Build a custom Mi ingestion connector. Sync Mi's projects, services, owners, and dependencies to OM. Use OM as the system of record for catalog + lineage + ownership.

### Architecture
```
Mi System                          OpenMetadata (Docker)
─────────────────────────────────  ─────────────────────────────────
master-projects.json    ──────────► OM Service entities
pm2 process list        ──────────► OM Pipeline entities (adapted)
mi-core GStack data     ──────────► Custom properties
owner strings           ──────────► OM User entities
dependency arrays       ──────────► OM Lineage edges

mi-core queries OM ◄───────────────── OM REST API (port 8585)
```

### Implementation steps
1. Install Docker Desktop (Windows)
2. Pull OM Docker Compose stack
3. Write custom Python ingestion connector for Mi projects
4. Initial data load (1-time migration)
5. Set up sync job (cron: every 15 min)
6. Modify mi-core to query OM for ownership/lineage
7. Add OM health check to Mi's monitoring

### Pros
- Full OM feature set (UI, search, ownership, lineage, data quality)
- 80+ connectors for future data sources
- Industry-standard platform
- Active community + roadmap

### Cons
- **+9 GB RAM minimum** on the host machine
- Three additional services to maintain (server, MySQL, ES)
- Java + Python + React — 3 runtimes to troubleshoot
- Custom connector needed (no Mi connector exists)
- Cold start: 3-5 minutes for ES warm-up
- Mi becomes dependent on a Docker stack being up 24/7
- Significant overkill for current scale

### Cost estimate
| Phase | Effort |
|-------|--------|
| Docker setup + initial config | 1 day |
| Custom ingestion connector | 3 days |
| mi-core integration | 2 days |
| Testing + validation | 1 day |
| **Total** | **~7 days** |

### Risk level: HIGH
Resource footprint could destabilize existing services on the same machine.

---

## 4. Option B: Extract Concepts — Native Implementation

### What it is
Do NOT deploy OpenMetadata. Instead, extract the **patterns** from OM's entity model:
- Typed entities with owner, tags, custom properties
- Lineage as directed edges in a graph
- Team/User ownership model
- Orphan detection

Implement these patterns natively in Mi using:
- SQLite (already present: `qb-agent.db`)
- Extended `master-projects.json` schema
- A lightweight JavaScript graph library (or raw SQL)

### Architecture
```
Mi System (all in-process)
──────────────────────────────────────────────────────────────────
master-projects.json  ──► projects table (SQLite)
pm2 process list      ──► services table (SQLite) [polled every 60s]
owner fields          ──► users + teams tables (SQLite)
dependency arrays     ──► lineage_edges table (SQLite)

mi-core knowledge API ──► queries all above tables
GStack skills         ──► write to tables as side-effects
```

### Schema design (SQLite)
```sql
-- Knowledge Universe V2 schema
CREATE TABLE ku_projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT,
  status TEXT DEFAULT 'active',
  criticality TEXT DEFAULT 'MEDIUM',
  port INTEGER,
  owner_id TEXT REFERENCES ku_users(id),
  team_id TEXT REFERENCES ku_teams(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE ku_services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,          -- pm2 process name
  project_id TEXT REFERENCES ku_projects(id),
  port INTEGER,
  status TEXT,                 -- online|stopped|errored
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

CREATE TABLE ku_team_members (
  team_id TEXT REFERENCES ku_teams(id),
  user_id TEXT REFERENCES ku_users(id),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE ku_lineage_edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_entity TEXT NOT NULL,   -- FQN of consumer
  to_entity TEXT NOT NULL,     -- FQN of provider
  edge_type TEXT DEFAULT 'runtime',
  created_at TEXT DEFAULT (datetime('now'))
);

-- SPOF query
SELECT to_entity, COUNT(*) as dependent_count
FROM ku_lineage_edges
GROUP BY to_entity
ORDER BY dependent_count DESC;
```

### Implementation steps
1. Add tables to `qb-agent.db` via migration script
2. Extend `master-projects.json` with criticality, team, secondary owner
3. Write `knowledge-graph.ts` service in mi-core (read/write the tables)
4. Add `GET /api/knowledge/graph` endpoint to mi-core
5. Add pm2 sync job (every 60s, updates ku_services)
6. Update GStack skills to write to knowledge tables as side-effects

### Pros
- Zero additional services or memory
- Uses existing SQLite database
- Full control over schema — no OM limitations
- SQL queries answer all CEO questions natively
- Can be built incrementally alongside GStack

### Cons
- No built-in UI (need to build dashboard view)
- No connector ecosystem (manual ingestion only)
- Less feature-rich than full OM (no full-text search, no data quality)
- Schema design work — can't just use OM's defaults

### Cost estimate
| Phase | Effort |
|-------|--------|
| Schema design + migration | 0.5 day |
| `knowledge-graph.ts` service | 1 day |
| API endpoint | 0.5 day |
| pm2 sync job | 0.5 day |
| Testing | 0.5 day |
| **Total** | **~3 days** |

### Risk level: LOW
All changes are additive and isolated in a new database table + service module.

---

## 5. Option C: Hybrid — OM for Catalog, Mi for Operations

### What it is
Deploy a minimal OpenMetadata instance (possibly on a separate machine or cloud) specifically for the **catalog layer**: projects, owners, lineage, tags. Keep Mi's operational layer (GStack, Evidence Engine, QA, Work Orders) entirely in mi-core.

OM and Mi-Core are separate systems. Mi-Core can optionally query OM's API for enriched metadata when needed.

### Architecture
```
                         ┌──────────────────────┐
Mi Runtime               │  OpenMetadata (Cloud  │
─────────────────         │  or separate VM)      │
GStack              ◄──► │  OM REST API          │
Evidence Engine          │  OM UI                │
QA Certification         │  Catalog + Lineage     │
WhatsApp Gateway         │  Ownership             │
                         └──────────────────────┘
                                  │
              Mi sync script (cron) ──► writes to OM
              Mi queries OM API ──► reads catalog metadata
```

### Pros
- Full OM feature set without burdening the Mi machine
- Clean separation: Mi = operations, OM = catalog
- Can evolve independently

### Cons
- Two systems to maintain
- Network dependency between Mi and OM
- More complex than Option B for the same information
- Still requires custom connector development
- Cloud cost or second machine required

### Cost estimate
| Phase | Effort |
|-------|--------|
| Cloud/VM OM setup | 1 day |
| Custom connector | 3 days |
| Mi-OM integration | 2 days |
| Testing | 1 day |
| **Total** | **~7 days** (same as Option A) |

### Risk level: MEDIUM
Adds network dependency; cloud cost; still requires OM maintenance.

---

## 6. Option Comparison Matrix

| Dimension | Option A (Full OM) | Option B (Native) | Option C (Hybrid) |
|-----------|-------------------|--------------------|-------------------|
| Resource cost | +9 GB RAM | 0 | External |
| Implementation effort | 7 days | 3 days | 7 days |
| Feature richness | ★★★★★ | ★★★ | ★★★★★ |
| Mi architecture fit | ★★ | ★★★★★ | ★★★ |
| Risk level | HIGH | LOW | MEDIUM |
| OM data model fidelity | 100% | ~70% | 100% |
| CEO questions answered | ✅ All | ✅ All | ✅ All |
| Dependency added | Docker + 3 services | None | Cloud/VM |
| Time to first value | 7 days | 3 days | 7 days |

---

## 7. Decision Framework

**Choose Option A if:**
- Mi is deployed on a machine with 32+ GB RAM
- The team plans to ingest multiple data sources (databases, dashboards, pipelines)
- A data catalog UI is a core requirement for non-technical stakeholders
- Long-term Mi Knowledge Universe is a data engineering platform

**Choose Option B if:**
- Mi runs on a constrained machine (current situation: ~400 MB total)
- The primary need is CEO-level queries (SPOF, ownership, dependency)
- Speed of delivery is more important than feature richness
- Mi's Knowledge Universe V2 scope is limited to software services/projects

**Choose Option C if:**
- A separate server is available (another machine, cloud VM, or separate Docker host)
- The full OM catalog UI is needed for stakeholders other than the CEO
- Budget allows for ongoing cloud/VM cost

---

## 8. Recommendation

**Option B (Extract Concepts, Native Implementation)** is recommended for Mi's current context.

Mi is a lightweight, local-first operating system for a small team. It does not need the full OpenMetadata stack. The three CEO questions (who owns what, what depends on what, what are the SPOFs) can be answered with 3 SQL queries against SQLite — no Docker, no Elasticsearch, no Java runtime required.

Option A and C should be revisited when:
- Mi scales to 20+ projects / 5+ team members
- A non-technical stakeholder needs a catalog browsing UI
- Multi-source data ingestion is required

See `OPENMETADATA_RECOMMENDATION.md` for formal verdict.
