# OPENMETADATA_FIT_ANALYSIS

Generated: 2026-06-13
Status: RESEARCH_ONLY
Target: OPENMETADATA_RESEARCH_READY

## Directive Boundary

This research does not modify Mi-Core runtime, Dev3 APIs, Work Order logic, Role Engine, Approval Engine, or QA Engine.

Locked APIs remain unchanged:

- `/api/execution-package`
- `/api/work-orders/enrich`
- `/api/projects/intelligence`
- `/api/skills/recommend`
- `/api/risks/classify`

## Research Question

Can OpenMetadata support Mi Knowledge Universe V2 as a metadata and source-of-truth layer for:

- Ownership Graph
- Dependency Graph
- Source Lineage
- Service Metadata
- Project Metadata
- Operational Source of Truth

## Core Architecture

OpenMetadata is an open-source metadata platform for discovery, governance, lineage, ownership, usage, data quality, observability, and context for people and AI. It exposes a REST API and uses schema-first metadata entities.

Core deployment components:

| Component | Role |
|---|---|
| OpenMetadata server | API, UI, metadata business logic |
| Backend database | MySQL or PostgreSQL metadata store |
| Search engine | Elasticsearch or OpenSearch for discovery/search |
| Ingestion service | Metadata ingestion workflows, often Airflow-backed |
| Connectors | Database, dashboard, pipeline, messaging, storage, ML, and other metadata sources |

Official references:

- OpenMetadata docs: https://docs.open-metadata.org/v1.13.x
- Docker deployment: https://docs.open-metadata.org/v1.12.x/deployment/docker
- Local Docker quickstart: https://docs.open-metadata.org/v1.12.x/quick-start/local-docker-deployment
- Minimum requirements: https://docs.open-metadata.org/v1.12.x/deployment/minimum-requirements
- API model: https://docs.open-metadata.org/v1.12.x/api-reference/main-concepts/metadata-standard/apis
- Lineage API: https://docs.open-metadata.org/v1.12.x/api-reference/lineage

## Metadata Model Fit

OpenMetadata is strongest when Mi treats operational assets as governed metadata entities.

| Capability | Fit for Mi | Notes |
|---|---|---|
| Entity metadata | Strong | Projects, services, repos, reports can be modeled as assets or custom extensions |
| Ownership | Strong | Supports owners as users/teams and ownership propagation |
| Lineage | Strong for data/pipeline/dashboard lineage | Native lineage may need adaptation for project/service dependencies |
| Tags/classifications | Strong | Useful for `critical`, `P0`, `certified`, `blocked`, `owner_missing` |
| REST APIs | Strong | Good for read/write metadata integration |
| UI | Strong | Useful operational catalog for humans |
| Source-of-truth | Medium | Good metadata truth, but not execution truth |
| Work Order orchestration | Weak | Not designed to replace Dev3 Work Order or Role Engine |

## Ownership Model

OpenMetadata supports ownership on data assets by assigning users or teams as owners. It also supports owner propagation in data hierarchies, such as database to schema to table.

Fit for Mi:

- Dev1, Dev2, Dev3 can map to users or teams.
- QA_AGENT, RELEASE_AGENT, AUDITOR_AGENT can map to teams or roles.
- Owner propagation concept can inspire Mi ownership inheritance from System -> Project -> Service -> Module.

Reference:

- Data ownership guide: https://docs.open-metadata.org/v1.12.x/how-to-guides/guide-for-data-users/data-ownership
- Roles and policies: https://docs.open-metadata.org/v1.12.x/how-to-guides/admin-guide/roles-policies

## Lineage Graph

OpenMetadata Lineage API manages lineage relationships between entities and supports upstream/downstream graph retrieval with configurable depth.

Fit for Mi:

- Good for source lineage and service impact graph.
- Native lineage is data-asset oriented, so Mi project/service dependencies may need custom mapping.
- Useful for answering dependency impact questions if Dashboard, Review Automation, Mi-Core, and Knowledge Universe are represented as assets/services.

Reference:

- Lineage API: https://docs.open-metadata.org/v1.12.x/api-reference/lineage
- Lineage ingestion: https://docs.open-metadata.org/v1.12.x/connectors/ingestion/lineage

## API Support

OpenMetadata uses REST APIs with schema-first entities in JSON Schema. APIs support listing, retrieving, creating, updating, and lineage graph operations.

Relevant API areas:

| API Area | Mi Use |
|---|---|
| Services | Represent Dashboard, Review Automation, Mi-Core, Knowledge Universe |
| Users/Teams | Represent Dev1, Dev2, Dev3, Role Engine groups |
| Lineage | Represent dependency and source flow |
| Classifications/Tags | Represent risk, blocker, certification, owner state |
| Data products/domains | Represent business systems and stores |

## Docker / Local Deployment

OpenMetadata supports Docker and local Docker quickstart. The local quickstart explicitly supports OSX, Linux, and Windows through Docker.

Local quickstart requirement:

- At least 6 GiB memory allocated to Docker
- 4 vCPUs allocated to Docker

Production-style minimum requirements are heavier:

- MySQL/PostgreSQL: 4 vCPUs, 16 GiB memory, 100 GB+ storage
- Elasticsearch/OpenSearch: 2 vCPUs, 8 GiB memory, 100 GB storage per node

## Windows Compatibility

Fit: Medium to Strong.

OpenMetadata can run locally on Windows through Docker Desktop. It is not as lightweight as Mi’s current SQLite/Qdrant/local file approach. Windows compatibility is acceptable for research and local prototype, but the resource footprint matters.

## Resource Cost

| Deployment | Expected Cost |
|---|---|
| Research sandbox | 6 GiB Docker memory, 4 vCPUs |
| Serious local service | Docker Desktop plus DB/search/orchestrator overhead |
| Production-like | Separate database, search engine, ingestion service |

Risk: OpenMetadata may be too heavy to run always-on beside Mi-Core on the same PC if memory is constrained.

## Fit Summary

| V2 Need | OpenMetadata Fit | Verdict |
|---|---|---|
| Ownership Graph | Strong | Good candidate |
| Dependency Graph | Medium | Needs modeling adaptation |
| Source Lineage | Strong | Good candidate |
| Service Metadata | Strong | Good candidate |
| Project Metadata | Medium | Can model, but project/repo assets are not the default core domain |
| Operational Source of Truth | Medium | Good metadata truth, not execution truth |
| Dev3 Execution Package | Weak | Keep Mi package generator as contract |

## Fit Verdict

OpenMetadata is valuable as an external metadata/catalog/lineage layer, but should not replace Mi Operational Knowledge or Dev3 execution contracts.

Recommended posture: `PARTIAL_ADOPT`.
