# Knowledge Graph Audit — Phase 25
**Generated:** 2026-06-12T11:05:00Z  
**Source:** GET /api/jarvis/graph/*  
**Verdict:** PROVEN (graph contains real business entities and correct relationships)

---

## Graph Statistics (Live)

```
Total entities:   15
Total relations:  16
By type:
  store:   5
  project: 6
  node:    3
  person:  1
```

---

## All Entities

### People (1)
| ID | Name | Role | Phone |
|----|------|------|-------|
| person.liem | Liêm Đỗ | CEO/Founder | +84931773657 |

### Stores (5)
| ID | Name | Location | Parent |
|----|------|----------|--------|
| store.bakudan | Bakudan Ramen | San Antonio TX | — |
| store.stone_oak | Stone Oak | San Antonio TX | Bakudan Ramen |
| store.bandera | Bandera | San Antonio TX | Bakudan Ramen |
| store.rim | Rim | San Antonio TX | Bakudan Ramen |
| store.raw_sushi | Raw Sushi Bar | Stockton CA | — |

### Projects (6)
| ID | Name | Status | Port |
|----|------|--------|------|
| project.mi_core | Mi-Core | active | 4001 |
| project.dashboard | Dashboard | active | — |
| project.whatsapp_gateway | WhatsApp AI Gateway | active | 3211 |
| project.doordash | DoorDash Campaigns | active | — |
| project.review_automation | Review Automation | active | — |
| project.integration | Integration System | active | — |

### Nodes (3)
| ID | Name | Role | OS |
|----|------|------|----|
| node.laptop1 | Laptop1 | ACTIVE writer | Windows |
| node.laptop2 | Laptop2 | PASSIVE standby | Windows |
| node.pc | PC | Mi-Core host | Windows |

---

## All 16 Relationships

| From | Relation | To |
|------|----------|----|
| person.liem | owns | store.bakudan |
| person.liem | owns | store.raw_sushi |
| person.liem | owns | project.mi_core |
| store.bakudan | part_of | store.stone_oak |
| store.bakudan | part_of | store.bandera |
| store.bakudan | part_of | store.rim |
| project.mi_core | deployed_on | node.pc |
| project.whatsapp_gateway | deployed_on | node.laptop1 |
| project.doordash | deployed_on | node.laptop1 |
| project.review_automation | deployed_on | node.laptop1 |
| project.integration | deployed_on | node.laptop1 |
| project.mi_core | depends_on | project.whatsapp_gateway |
| project.dashboard | depends_on | project.mi_core |
| store.stone_oak | related_to | project.doordash |
| store.bandera | related_to | project.doordash |
| store.bakudan | related_to | project.review_automation |

---

## Stone Oak — Full Graph Traversal

```
Stone Oak (store)
  Attributes:
    location: San Antonio TX
    parent: Bakudan Ramen
  Connects to:
    related_to → DoorDash Campaigns
  Connected by:
    Bakudan Ramen (part_of)
```

**API:** `GET /api/jarvis/graph/explore/Stone%20Oak`

---

## Gaps

1. **No Manager entity** — no employee/staff entities in graph. "Who manages Stone Oak?" returns no answer.
2. **No Review entities** — customer reviews not mapped.
3. **No Task entities** — tasks not in graph.
4. **No Deployment history** — graph is static, not event-sourced.
5. **Neo4j/GraphRAG not used** — in-memory only, no persistence, resets on restart.
