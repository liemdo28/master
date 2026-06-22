# OpenMetadata Fit Analysis
**Research Task:** DEV2 — Knowledge Universe V2  
**Date:** 2026-06-13  
**Status:** RESEARCH_COMPLETE  
**Analyst:** Mi Operating Backend

---

## 1. What Is OpenMetadata?

OpenMetadata is an open-source, end-to-end metadata management platform. It provides a unified catalog for all data assets — databases, dashboards, pipelines, ML models, APIs — with built-in lineage, ownership, quality, and discovery layers.

**Repository:** github.com/open-metadata/OpenMetadata  
**License:** Apache 2.0  
**Current version:** 1.3.x (2024)  
**Language:** Java (server), Python (ingestion), React (UI)

---

## 2. Core Architecture

```
┌─────────────────────────────────────────────────────┐
│                  OpenMetadata Server                │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │ REST API │  │ EventBus │  │ Search (ES/OS)    │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │         Entity Store (MySQL / PostgreSQL)       │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         │                          │
  ┌──────────────┐        ┌─────────────────┐
  │ OpenMetadata │        │   Ingestion     │
  │ UI (React)   │        │ Framework (Py)  │
  └──────────────┘        └─────────────────┘
```

**Key components:**
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Metadata Server | Java (Spring) | Core API, entity management, lineage |
| Entity Store | MySQL 8 / PostgreSQL | Persistence |
| Search Index | Elasticsearch / OpenSearch | Discovery, full-text search |
| Ingestion | Python (airflow-compatible) | Connectors to 80+ data sources |
| UI | React | Web interface |
| Event Bus | Internal + Kafka (optional) | Change data capture |

---

## 3. Metadata Model

OpenMetadata uses a **typed entity model** — every asset is a first-class entity with schema:

### Core Entities
| Entity | Description |
|--------|-------------|
| `Table` | Database table with columns, tags, stats |
| `Database` | Database service (Postgres, MySQL, etc.) |
| `DatabaseService` | Connection to a DB cluster |
| `Dashboard` | BI dashboard (Superset, Metabase, etc.) |
| `Pipeline` | Airflow DAG or ETL workflow |
| `ML Model` | Trained model with features, metrics |
| `API` | REST/GraphQL endpoint |
| `Container` | Object store (S3 bucket) |
| `Glossary` | Business terminology |
| `Team` | Group of users (owns entities) |
| `User` | Individual (has roles, owns entities) |

### Entity Schema Pattern
```json
{
  "id": "UUID",
  "name": "dashboard_sales",
  "fullyQualifiedName": "superset.default.dashboard_sales",
  "description": "Sales performance dashboard",
  "owner": { "type": "team", "name": "dev2" },
  "tags": ["critical", "production"],
  "lineage": { "upstreamEdges": [], "downstreamEdges": [] },
  "domain": "finance",
  "version": "0.3"
}
```

### Extension Points
- **Custom Properties** — add arbitrary key-value fields to any entity
- **Glossary Terms** — tag any entity with business terms
- **Classification Tags** — PII, sensitivity, domain labels
- **Custom Entities** — define entirely new entity types via API

---

## 4. Lineage Graph

OpenMetadata's lineage is a **directed acyclic graph (DAG)** of data flow:

```
Source DB → Pipeline → Transformed Table → Dashboard
```

**Lineage capabilities:**
- Column-level lineage (field → field)
- Entity-level lineage (table → dashboard)
- Pipeline-driven lineage (Airflow DAG → tables)
- Manual lineage (API-added edges)
- Lineage search (what depends on X?)
- Impact analysis (if X breaks, what is affected?)

**API example:**
```
GET /api/v1/lineage/table/{id}?upstreamDepth=3&downstreamDepth=3
```

**Limitation for Mi:** OpenMetadata lineage is designed for **data lineage** (data flowing between databases and dashboards), not **service dependency** (Service A calls Service B). This requires mapping Mi's dependency model onto a non-native concept.

---

## 5. Ownership Model

OpenMetadata has a formal ownership model:

```
Domain
  └── Team
        └── User
              └── owns Entity (1:1 or team:many)
```

**Features:**
- `owner` field on every entity (Team or User)
- Automatic change notifications to owners
- Ownership-aware search ("show me my tables")
- Orphaned entity detection (entities with no owner)
- Team hierarchy with role inheritance

**Roles:**
| Role | Permission |
|------|-----------|
| `DataConsumer` | Read |
| `DataSteward` | Read + tag + edit description |
| `DataOwner` | Full on owned entities |
| `Admin` | Full system access |

---

## 6. REST API

OpenMetadata has a complete REST API (OpenAPI spec available):

```
Base: http://localhost:8585/api/v1/

Entity CRUD:
  GET    /tables
  GET    /tables/{id}
  POST   /tables
  PATCH  /tables/{id}
  DELETE /tables/{id}

Search:
  GET    /search/query?q=dashboard&index=table_search_index

Lineage:
  GET    /lineage/{entityType}/{id}
  PUT    /lineage

Ownership:
  GET    /teams
  GET    /users
  PATCH  /tables/{id} (with owner field)

Custom Properties:
  POST   /metadata/types/{id}/customProperties
```

**Authentication:** Google OAuth / LDAP / SAML / Basic (dev mode — no auth)

---

## 7. Docker / Local Deployment

OpenMetadata provides Docker Compose for local deployment:

```yaml
# docker-compose.yml (simplified)
services:
  openmetadata-server:
    image: openmetadata/server:1.3.0
    ports: ["8585:8585"]
    depends_on: [mysql, elasticsearch]
    
  mysql:
    image: mysql:8.0
    
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.1
    
  ingestion:
    image: openmetadata/ingestion:1.3.0
```

**Pull command:**
```
docker compose -f docker-compose.yml up -d
```

**Startup time:** ~3-5 minutes (ES warm-up)

---

## 8. Windows Compatibility

| Component | Windows Support | Notes |
|-----------|----------------|-------|
| Docker deployment | ✅ Full | Docker Desktop required |
| Native Java server | ⚠️ Possible | Requires Java 17, manual setup |
| Python ingestion | ✅ Full | pip install openmetadata-ingestion |
| UI | ✅ Full | Browser-based, no OS dependency |
| REST API client | ✅ Full | Language-agnostic |

**Verdict:** Windows deployment via Docker Desktop is fully supported. Native (non-Docker) deployment is possible but complex and unsupported officially.

---

## 9. Resource Requirements

**Minimum (dev mode, Docker):**
| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| OpenMetadata Server | 1 core | 2 GB | 1 GB |
| MySQL 8 | 1 core | 2 GB | 10 GB |
| Elasticsearch | 2 cores | 4 GB | 10 GB |
| Ingestion | 0.5 core | 1 GB | - |
| **Total** | **4.5 cores** | **9 GB** | **21 GB** |

**Recommended (production):**
| Service | CPU | RAM |
|---------|-----|-----|
| OpenMetadata Server | 4 cores | 8 GB |
| MySQL 8 | 2 cores | 8 GB |
| Elasticsearch | 4 cores | 16 GB |
| **Total** | **10 cores** | **32 GB** |

**Current Mi-Core machine resource usage:**
- mi-core: ~140MB RAM, minimal CPU
- Total known processes: ~400MB RAM

**Impact:** Running full OpenMetadata stack would consume **5-10x more RAM** than all existing Mi services combined on the same machine.

---

## 10. Python SDK

```python
from metadata.ingestion.ometa.ometa_api import OpenMetadata
from metadata.generated.schema.entity.services.connections.metadata.openMetadataConnection import OpenMetadataConnection

server_config = OpenMetadataConnection(hostPort="http://localhost:8585/api")
metadata = OpenMetadata(server_config)

# Create a table entity
table = metadata.get_by_name(entity=Table, fqn="mysql.default.orders")
lineage = metadata.get_lineage_by_name(entity=Table, fqn="mysql.default.orders", up_depth=3)
```

---

## 11. Connector Ecosystem

OpenMetadata ships with 80+ connectors including:
- **Databases:** MySQL, PostgreSQL, Snowflake, BigQuery, SQLite
- **Dashboards:** Superset, Metabase, Looker, Tableau, Power BI
- **Pipelines:** Airflow, dbt, Spark, Fivetran
- **Storage:** S3, GCS, Azure Blob
- **APIs:** Custom REST API connector

**Mi relevance:** No pre-built connector for Node.js/TypeScript services. Mi would need a **custom ingestion connector**.

---

## 12. Fit Assessment Summary

| Dimension | Score | Notes |
|-----------|-------|-------|
| Lineage modeling | ⭐⭐⭐⭐ | Excellent for data lineage; needs adaptation for service deps |
| Ownership model | ⭐⭐⭐⭐⭐ | Exactly what Mi needs — teams, owners, orphan detection |
| API quality | ⭐⭐⭐⭐ | Well-documented REST API, Python SDK |
| Windows support | ⭐⭐⭐ | Via Docker only; adds Docker Desktop dependency |
| Resource footprint | ⭐⭐ | Heavy — 9GB RAM minimum; overkill for Mi's current scale |
| Custom entity support | ⭐⭐⭐ | Custom properties yes; custom entity types limited |
| Local-first | ⭐⭐ | Can run locally but requires persistent Docker stack |
| Maintenance cost | ⭐⭐ | Three services (server + MySQL + ES) to maintain |
| Mi-native fit | ⭐⭐⭐ | Designed for data assets, not software services |

**Overall fitness: 3/5 — Partial fit with significant adaptation required**

---

## 13. Key Finding

OpenMetadata is purpose-built for **data catalog + lineage** in analytics/data engineering contexts. Mi's use case is **software service metadata + dependency graph** — a related but distinct problem. The ownership and lineage concepts are transferable, but the data model, resource requirements, and deployment complexity are misaligned with Mi's local-first, lightweight architecture.

See `OPENMETADATA_INTEGRATION_PLAN.md` for option analysis and `OPENMETADATA_RECOMMENDATION.md` for final verdict.
