# OPENMETADATA_MI_MAPPING

Generated: 2026-06-13
Status: RESEARCH_ONLY

## Directive Boundary

This mapping does not create or modify production metadata. It is a design map only.

## Mapping Goal

Map OpenMetadata concepts to Mi Knowledge Universe V2 entities.

```text
OpenMetadata Entity
-> Mi Project / Service / Store / Repo / Owner / Dependency
```

## Core Mapping

| OpenMetadata Concept | Mi Concept | Example |
|---|---|---|
| Domain | Business/system boundary | Bakudan Operations, Mi Operating Backend |
| Data Product | Operational product/system | Dashboard Operations, Knowledge Universe |
| Dashboard Service | Dashboard service metadata | Dashboard |
| Pipeline Service | Automation or workflow service | Review Automation |
| Database Service | Structured data backend | Knowledge DB, QuickBooks DB |
| API/Custom Service | Mi runtime service | Mi-Core, WhatsApp Gateway |
| Table/Topic/Container | Data asset | Reports index, logs, connector cache |
| User | Individual owner | Dev1, Dev2, Dev3, Liem Do |
| Team | Functional owner group | QA_AGENT, RELEASE_AGENT, AUDITOR_AGENT |
| Tag/Classification | Operational marker | P0, P1, certified, blocked |
| Lineage Edge | Dependency/source flow | Dashboard depends_on Review Automation |
| Glossary Term | Business meaning | Work Order, blocker, certification |
| Data Contract | Expected interface | Execution Package Contract |

## Mi Entity Mapping

| Mi Entity | OpenMetadata Representation | Notes |
|---|---|---|
| Dashboard | Data Product or Dashboard Service | Treat as operational product with dashboard service metadata |
| Review Automation | Pipeline Service or custom service | Best modeled as automation/pipeline service |
| Mi-Core | API/custom service or Data Product | Core system, not just a data service |
| Knowledge Universe | Data Product + Database/Search service | Contains Knowledge DB, reports, embeddings/indexes |
| Dev1 / Dev2 / Dev3 | Users and/or Teams | Depends whether individual or functional role |
| QA Agent | Team | Functional role owner |
| Release Agent | Team | Deployment/release ownership |
| Reports | Assets with classification | Certification Evidence, Audit Report, QA Report |
| Work Orders | Custom entity or asset extension | Do not replace Dev3 Work Order contract |
| Blockers | Tag/classification plus relationship | Could be `blocked` tag with owner and evidence |
| Stores | Domain/Data Product | Stone Oak, Bandera, Rim, Raw Sushi under business domain |
| Repos | Custom asset or service extension | OpenMetadata has no perfect native Git repo entity |

## Example Mapping

| Mi Object | OpenMetadata Object |
|---|---|
| Dashboard | Data Product: `Dashboard Operations`; Dashboard Service: `dashboard.bakudanramen.com` |
| Review Automation | Pipeline Service: `review-automation` |
| Mi-Core | API/custom service: `mi-core` |
| Dev2 | User/Team owner: `dev2-knowledge` |
| Reports | Tagged assets: `CertificationEvidence`, `QAReport`, `AuditReport` |

## Relationship Mapping

```text
Dashboard
-> owned_by -> Dev3 / QA_AGENT
-> depends_on -> Review Automation
-> depends_on -> Mi-Core
-> has_report -> Dashboard QA Reports
-> tagged -> P2 / audit / operational
```

OpenMetadata-native equivalent:

```text
DataProduct(Dashboard Operations)
-> owner: Team(QA_AGENT)
-> lineage upstream: Service(Review Automation)
-> lineage upstream: Service(Mi-Core)
-> classification: Operational.P2
```

## Mapping Gaps

| Gap | Impact | Proposed Handling |
|---|---|---|
| Git repository as first-class asset | Medium | Use custom properties or custom entity later |
| Work Order as first-class asset | High if forced | Keep Work Orders in Mi; link report/evidence only |
| Role Engine state | High | Do not model execution state in OpenMetadata |
| Approval state | High | Keep in Mi approval layer |
| Store operations | Medium | Model stores as domains/data products with custom properties |

## Recommendation

Use OpenMetadata concepts for governance vocabulary and optional external catalog. Keep Mi as the execution and operational package authority.
