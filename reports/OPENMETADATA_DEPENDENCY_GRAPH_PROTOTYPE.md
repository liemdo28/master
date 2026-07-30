# OpenMetadata Dependency Graph Prototype
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE  
**Analyst:** Mi Operating Backend

---

## 1. Purpose

Design a dependency graph for Mi's known services and projects, answering three CEO-level questions:
1. Which projects depend on Mi-Core?
2. What are the single points of failure?
3. Who owns each component?

This prototype shows what the graph would look like if implemented in OpenMetadata's lineage system.

---

## 2. Known Mi Services (from pm2 + master-projects.json)

Based on observed pm2 process list and project registry:

| Service | Port | Stack | Owner |
|---------|------|-------|-------|
| mi-core | 4001 | Node.js/TypeScript | Hoang Le |
| antigravity-gateway | 3002 | Node.js | Hoang Le |
| whatsapp-ai-gateway | 3001 | Node.js | Hoang Le |
| bakudanramen-dashboard | 3000 | Next.js | Hoang Le |
| agent-coding-api-keys | 3003 | Node.js | Hoang Le |

---

## 3. Dependency Graph (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Mi Dependency Graph                          │
│                        (arrows = "depends on")                      │
└─────────────────────────────────────────────────────────────────────┘

  CEO (WhatsApp)
       │
       ▼
  ┌─────────────────────┐
  │  whatsapp-ai-gateway│ ──────────────────────────────────────────┐
  │  port:3001          │                                          │
  └─────────────────────┘                                          │
       │                                                           │
       ▼                                                           │
  ┌─────────────────────┐       ┌──────────────────────────┐       │
  │      mi-core        │◄──────│  bakudanramen-dashboard  │       │
  │      port:4001      │       │  port:3000               │       │
  │   [SPOF ⚠️]         │       └──────────────────────────┘       │
  └─────────────────────┘                                          │
       │         │                                                  │
       │         └──────────────────────────────────────────────►  │
       ▼                                                           │
  ┌─────────────────────┐       ┌──────────────────────────┐       │
  │ antigravity-gateway │       │  agent-coding-api-keys   │       │
  │ port:3002           │       │  port:3003               │       │
  └─────────────────────┘       └──────────────────────────┘       │
       │                                                           │
       ▼                                                           │
  ┌─────────────────────┐                                          │
  │   External APIs     │◄─────────────────────────────────────────┘
  │   (OpenAI, etc.)    │
  └─────────────────────┘
```

---

## 4. Dependency Matrix

| Consumer ↓ \ Provider → | mi-core | antigravity-gateway | whatsapp-ai-gateway | agent-coding-api-keys | External APIs |
|--------------------------|---------|--------------------|--------------------|----------------------|--------------|
| whatsapp-ai-gateway | ✅ | ✅ | — | ✅ | ✅ |
| bakudanramen-dashboard | ✅ | ✅ | — | — | — |
| mi-core | — | — | — | — | ✅ |
| agent-coding-api-keys | — | — | — | — | ✅ |

**Reading:** Row depends on Column. Example: `whatsapp-ai-gateway` depends on `mi-core`, `antigravity-gateway`, `agent-coding-api-keys`, and External APIs.

---

## 5. Single Points of Failure Analysis

A **Single Point of Failure (SPOF)** is a service whose failure cascades to multiple other services.

### SPOF Score (number of downstream dependents)

| Service | Dependents | SPOF Score | Risk Level |
|---------|-----------|-----------|-----------|
| **mi-core** | whatsapp-ai-gateway, bakudanramen-dashboard | **2** | 🔴 HIGH |
| **antigravity-gateway** | whatsapp-ai-gateway, bakudanramen-dashboard | **2** | 🔴 HIGH |
| **External APIs** | mi-core, whatsapp-ai-gateway, agent-coding-api-keys | **3** | 🟡 MEDIUM (not owned) |
| agent-coding-api-keys | whatsapp-ai-gateway | 1 | 🟡 LOW |
| whatsapp-ai-gateway | CEO communication | 1 | 🟠 MEDIUM (CEO channel) |

### SPOF Detail: mi-core

**If mi-core goes down:**
- WhatsApp AI gateway loses GStack intelligence → CEO gets no responses
- Dashboard loses backend API → dashboard goes down
- Work Order processing stops

**Current mitigation:**
- pm2 auto-restart (online, 5 restarts observed)
- Health check skill monitors it
- No hot-standby or load balancer

**Risk:** HIGH — mi-core is the operational brain of the system. It has restarts but no redundancy.

### SPOF Detail: antigravity-gateway

**If antigravity-gateway goes down:**
- WhatsApp gateway loses routing capability
- Dashboard loses its API proxy layer

**Current state:** 1907 restarts observed — historically unstable, currently `online`.

**Risk:** HIGH — high restart count suggests reliability issues. If it enters a crash loop, two services are affected.

---

## 6. OpenMetadata Lineage Representation

If implemented in OM, this graph would be stored as lineage edges:

```python
# Python ingestion script (prototype — not for production)
from metadata.ingestion.ometa.ometa_api import OpenMetadata

edges = [
    # whatsapp-ai-gateway dependencies
    ("mi-service.whatsapp-ai-gateway", "mi-service.mi-core"),
    ("mi-service.whatsapp-ai-gateway", "mi-service.antigravity-gateway"),
    ("mi-service.whatsapp-ai-gateway", "mi-service.agent-coding-api-keys"),
    # dashboard dependencies
    ("mi-service.bakudanramen-dashboard", "mi-service.mi-core"),
    ("mi-service.bakudanramen-dashboard", "mi-service.antigravity-gateway"),
]

for from_entity, to_entity in edges:
    metadata.add_lineage_edge(
        from_fqn=from_entity,
        to_fqn=to_entity,
        edge_type="ServiceDependency"
    )
```

**Impact analysis query:**
```
GET /api/v1/lineage/mi-service/mi-core?downstreamDepth=5
→ Returns: whatsapp-ai-gateway, bakudanramen-dashboard (and their transitive dependents)
```

---

## 7. Graph Without OM — Native Implementation

Since OM is not yet deployed, this graph can be implemented natively in Mi with a simple SQLite table:

```sql
-- In mi-core/data/qb-agent.db (already exists)
CREATE TABLE IF NOT EXISTS service_dependencies (
  id INTEGER PRIMARY KEY,
  consumer TEXT NOT NULL,    -- service that depends
  provider TEXT NOT NULL,    -- service being depended on
  dep_type TEXT DEFAULT 'runtime',  -- runtime | build | optional
  created_at TEXT DEFAULT (datetime('now'))
);

-- Data
INSERT INTO service_dependencies VALUES
  (null, 'whatsapp-ai-gateway', 'mi-core', 'runtime', datetime('now')),
  (null, 'whatsapp-ai-gateway', 'antigravity-gateway', 'runtime', datetime('now')),
  (null, 'whatsapp-ai-gateway', 'agent-coding-api-keys', 'runtime', datetime('now')),
  (null, 'bakudanramen-dashboard', 'mi-core', 'runtime', datetime('now')),
  (null, 'bakudanramen-dashboard', 'antigravity-gateway', 'runtime', datetime('now'));

-- SPOF query
SELECT provider, COUNT(*) as dependent_count
FROM service_dependencies
GROUP BY provider
ORDER BY dependent_count DESC;
```

**This achieves the same impact analysis without OM.** A simple JavaScript query against this table answers "what breaks if X goes down" in milliseconds.

---

## 8. CEO Dashboard View (proposed)

The dependency graph would surface in the Mi Dashboard as:

```
┌─────────────────────────────────────────────────────┐
│ Dependency Risk View                                │
├─────────────────────────────────────────────────────┤
│ 🔴 mi-core          — 2 dependents — SPOF           │
│ 🔴 antigravity-gw   — 2 dependents — SPOF           │
│ 🟡 agent-api-keys   — 1 dependent                  │
│ ✅ bakudanramen-dash — 0 dependents (leaf)          │
│ ✅ whatsapp-gw       — 0 dependents (leaf)          │
├─────────────────────────────────────────────────────┤
│ "If mi-core fails → 2 services go down"            │
└─────────────────────────────────────────────────────┘
```

---

## 9. Answers to CEO Questions

**Q1: Which projects depend on Mi-Core?**
- `whatsapp-ai-gateway` — direct dependency (GStack pipeline)
- `bakudanramen-dashboard` — direct dependency (backend API)
- Indirectly: CEO WhatsApp communication (through whatsapp-ai-gateway)

**Q2: Single points of failure?**
- `mi-core` — 2 direct dependents, no redundancy → **HIGHEST RISK**
- `antigravity-gateway` — 2 direct dependents, 1907 historical restarts → **HIGH RISK**

**Q3: Who owns each component?**
- All services: **Hoang Le** (single owner)
- No team distribution — 100% concentration risk
- Recommendation: define a `mi-ops` team with at least one additional member for knowledge transfer

---

## 10. Conclusion

The dependency graph reveals two structural risks:
1. **mi-core** is a SPOF for CEO-critical services with no redundancy
2. **Single owner** across all services — knowledge is concentrated

These findings are valuable regardless of whether OM is adopted. The graph prototype works as a native SQLite implementation and could optionally be published to OM's lineage layer if OM is deployed.

See `OPENMETADATA_OWNERSHIP_GRAPH.md` for the ownership dimension.
