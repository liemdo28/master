# OpenMetadata → Mi Knowledge Universe Mapping
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE  
**Analyst:** Mi Operating Backend

---

## 1. Purpose

This document maps OpenMetadata's entity model to Mi's existing knowledge entities. The goal is to determine what OM concepts directly apply, what needs adaptation, and what has no OM equivalent.

---

## 2. Mi Knowledge Universe — Current State

Mi's current knowledge system consists of:

| Mi Concept | Where stored | Description |
|-----------|-------------|-------------|
| Projects | `master-projects.json` | Named software projects with status, owner, dependencies |
| Services | pm2 + `qb-agent.db` | Runtime processes (mi-core, antigravity-gateway, etc.) |
| Owners | `master-projects.json` → owner field | Person/team responsible for each project |
| Dependencies | `master-projects.json` → deps[] | Which project uses which |
| Work Orders | GStack engine (in-memory + SQLite) | Active/historical tasks |
| Knowledge nodes | Qdrant + SQLite knowledge-db | Unstructured knowledge chunks |
| Connectors | `connector-registry.json` | Integration connectors (visibility, food-safety) |

---

## 3. Entity Mapping Table

| Mi Concept | OM Entity | Mapping Quality | Notes |
|-----------|----------|----------------|-------|
| Project | `Service` (custom) or `Table` | ⚠️ Partial | OM has no "software project" entity; `Service` is closest but meant for DB connections |
| Service (pm2 process) | `Pipeline` or custom entity | ⚠️ Adapted | OM pipelines are Airflow DAGs, not Node processes |
| Owner (person) | `User` | ✅ Direct | OM User is 1:1 to Mi owner |
| Team (dev2, mi-ops) | `Team` | ✅ Direct | OM Team is 1:1 |
| Dependency (A → B) | `Lineage Edge` | ⚠️ Semantic shift | OM lineage = data flow, not service dependency |
| Work Order | No equivalent | ❌ None | OM has no operational task tracking concept |
| Knowledge node | `Glossary Term` or custom | ❌ Loose | OM Glossary is for business terms, not unstructured knowledge |
| Connector | `DatabaseService` / `ApiService` | ⚠️ Partial | OM connectors = data ingestion only |
| Evidence file | `Container` / custom property | ❌ None | No native concept for QA evidence |
| Config / env | `Custom Property` | ✅ Via extension | Can attach key-value pairs to any entity |

---

## 4. Detailed Mapping — Projects

**Mi `master-projects.json` entry:**
```json
{
  "name": "bakudanramen-dashboard",
  "status": "production",
  "owner": "Hoang Le",
  "dependencies": ["mi-core", "antigravity-gateway"],
  "port": 3000,
  "domain": "dashboard.bakudanramen.com"
}
```

**Mapped to OM `Service` entity (custom type):**
```json
{
  "name": "bakudanramen-dashboard",
  "fullyQualifiedName": "mi-project.bakudanramen-dashboard",
  "serviceType": "MiProject",
  "owner": { "type": "user", "name": "hoang-le" },
  "tags": ["production", "dashboard"],
  "customProperties": {
    "port": "3000",
    "domain": "dashboard.bakudanramen.com",
    "status": "production"
  }
}
```

**Lineage edges (dependencies):**
```json
{ "fromEntity": "mi-project.bakudanramen-dashboard",
  "toEntity": "mi-project.mi-core",
  "edgeType": "ServiceDependency" }
```

**Mapping fidelity: 80%** — Port, domain, status are custom properties (lossy vs first-class fields). Dependency is representable via lineage but semantically different from data flow.

---

## 5. Detailed Mapping — Services (pm2 processes)

**Mi runtime service:**
```json
{
  "name": "mi-core",
  "pm2_id": 0,
  "status": "online",
  "restarts": 5,
  "port": 4001,
  "uptime": "3d"
}
```

**Mapped to OM `Pipeline` entity (adapted):**
```json
{
  "name": "mi-core",
  "fullyQualifiedName": "mi-runtime.mi-core",
  "pipelineType": "MiService",
  "owner": { "type": "team", "name": "mi-ops" },
  "customProperties": {
    "port": "4001",
    "pm2_status": "online",
    "restart_count": "5"
  }
}
```

**Mapping fidelity: 50%** — OM Pipeline has no concept of "port", "restarts", "uptime". These are custom properties that OM doesn't query natively. No health monitoring in OM.

---

## 6. Detailed Mapping — Owners

**Mi owner:**
```
"owner": "Hoang Le"  // Free-text string in master-projects.json
```

**OM User:**
```json
{
  "name": "hoang-le",
  "displayName": "Hoang Le",
  "email": "hoang.d.le@gmail.com",
  "teams": ["mi-ops", "dev2"],
  "roles": ["DataOwner"]
}
```

**Mapping fidelity: 95%** — Near-perfect. Mi's free-text owner becomes a structured OM User with email, team membership, and role. The main gap is Mi's current free-text makes bulk migration require string normalization.

---

## 7. Detailed Mapping — Dependencies

**Mi dependency:**
```json
"dependencies": ["mi-core", "antigravity-gateway"]
```

**OM Lineage:**
```
PUT /api/v1/lineage
{
  "edge": {
    "fromEntity": { "type": "service", "fqn": "mi-project.bakudanramen-dashboard" },
    "toEntity":   { "type": "service", "fqn": "mi-project.mi-core" }
  }
}
```

**Query example — "what does mi-core affect if it breaks?":**
```
GET /api/v1/lineage/service/mi-core?downstreamDepth=3
```

**Mapping fidelity: 70%** — Lineage graph works for service-to-service dependency. Main limitation: OM's lineage UI and search are optimized for "data flows from table A to dashboard B", not "service A calls service B over HTTP". Impact analysis queries work but the UI context is different.

---

## 8. Gaps — What Has No OM Equivalent

| Mi Concept | Gap | Workaround |
|-----------|-----|-----------|
| Work Order (WO) | No OM entity for operational tasks | Keep in GStack, don't migrate |
| Knowledge nodes (Qdrant) | OM Glossary is structured, not semantic-search | Keep Qdrant for semantic search |
| Evidence files (QA) | No OM concept of evidence/audit trail | Keep in `.local-agent-global/evidence/` |
| Runtime health (pm2 status) | OM has no health check concept | Keep pm2 + health skill |
| WhatsApp integration | Not in OM's domain | Keep in mi-core transport layer |
| Approval Engine (SAFE/REQUIRES_APPROVAL) | No OM workflow concept | Keep in GStack |

**Conclusion:** OM can absorb 40-50% of Mi's knowledge universe (projects, owners, dependencies). The other 50% (operational + runtime + QA + knowledge search) must stay in Mi's native engines.

---

## 9. Migration Schema Draft

If OM were adopted, the migration path would be:

```
master-projects.json → OM Service entities (via Python ingestion script)
pm2 process list    → OM Pipeline entities (via custom connector)
owner strings       → OM User entities (via CSV import)
dependency arrays   → OM Lineage edges (via lineage API)
connector-registry  → OM ApiService entities
```

**Estimated migration effort:** 3-5 days for a custom Python ingestion connector + initial data load.

---

## 10. Mapping Summary

| Mi Domain | OM Coverage | Fidelity | Action |
|----------|------------|---------|--------|
| Projects | `Service` (custom) | 80% | Adoptable with custom entity type |
| Owners | `User` | 95% | Direct adoption |
| Teams | `Team` | 95% | Direct adoption |
| Dependencies | `Lineage` | 70% | Adoptable — semantic shift is acceptable |
| Runtime services | `Pipeline` | 50% | Marginal — loses health/uptime data |
| Work Orders | None | 0% | Do not migrate |
| Knowledge nodes | None | 5% | Do not migrate |
| Evidence/QA | None | 0% | Do not migrate |

**Recommendation:** OM is a good home for Mi's **catalog layer** (what exists, who owns it, what depends on what). It is a poor home for Mi's **operational layer** (what's running, what happened, what evidence exists).

See `OPENMETADATA_RECOMMENDATION.md` for the adoption decision.
