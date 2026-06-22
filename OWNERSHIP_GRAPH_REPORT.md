# OWNERSHIP_GRAPH_REPORT

Generated: 2026-06-13
Status: DESIGN_ONLY

## Objective

Build an ownership model that answers:

- Dev nao so huu project nao?
- Store nao thuoc he thong nao?
- Module nao chua co owner?
- Owner nao dang qua tai?

## Ownership Model

Node labels:

| Label | Examples |
|---|---|
| `Owner` | Dev1, Dev2, Dev3, QA_AGENT, RELEASE_AGENT |
| `Project` | Dashboard, Mi-Core, Review Automation |
| `Store` | Stone Oak, Bandera, Rim, Raw Sushi |
| `System` | Bakudan Ramen, Mi Operating Backend |
| `Module` | Knowledge Universe, Work Order Engine, Dashboard Connector |
| `Responsibility` | QA, release, security, support, owner |

Relationships:

```text
Owner -> OWNS -> Project/Module
Owner -> SUPPORTS -> Project/Module
Store -> PART_OF -> System
Project -> SERVES -> Store/System
Module -> PART_OF -> Project
Module -> HAS_NO_OWNER -> Gap
Owner -> HAS_LOAD -> Workload
```

## Load Model

Owner load score:

```text
active_work_orders * 3
+ P0/P1 ownership * 5
+ active_blockers_owned * 4
+ critical_services_owned * 2
- backup_owner_count
```

Load bands:

| Score | Status |
|---:|---|
| 0-9 | Normal |
| 10-19 | Busy |
| 20-29 | Overloaded |
| 30+ | Critical overload |

## Required Queries

Unowned modules:

```cypher
MATCH (m:Module)
WHERE NOT (m)<-[:OWNS|SUPPORTS]-(:Owner)
RETURN m;
```

Owner overload:

```cypher
MATCH (o:Owner)-[:OWNS|SUPPORTS]->(x)
RETURN o, count(x) AS owned_items
ORDER BY owned_items DESC;
```

Store ownership:

```cypher
MATCH (store:Store)-[:PART_OF]->(system:System)<-[:OWNS]-(owner:Owner)
RETURN store, system, owner;
```

## Initial Ownership Seeds

| Entity | Owner |
|---|---|
| Mi-Core | Liem Do, Dev2 Knowledge Layer, Dev3 Operating Backend |
| Dashboard | Liem Do, Dev3 Operating Backend, QA Agent |
| Review Automation | Liem Do, QA Agent |
| WhatsApp AI Gateway | Liem Do, Dev3 Operating Backend |
| Stone Oak/Bandera/Rim | Bakudan Ramen system |
| Raw Sushi | Raw Sushi system |

## Integration Plan

Ownership Graph should initially power reports only. After approval, it can improve package ownership and blocker routing, but it must not replace Dev3 Role Engine logic.
