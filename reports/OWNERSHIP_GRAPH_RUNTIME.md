# Ownership Graph Runtime
**Phase 14.2 — OwnershipGraphService**
**Status: PRODUCTION**

---

## Entity Types

| Type | Example ID | Description |
|------|-----------|-------------|
| `owner` | `owner:hoang` | Individual person (CEO, lead) |
| `team` | `team:dev` | Team or group |
| `project` | `project:dashboard` | Top-level deployable project |
| `service` | `service:pm2` | Infrastructure or runtime service |
| `store` | `store:sqlite-knowledge` | Data store (DB, file, registry) |
| `repository` | `repo:master` | Source code repository |

---

## Relationship Types

| Relationship | Direction | Meaning |
|---|---|---|
| `owner_of` | owner → entity | Person/team owns this entity |
| `responsible_for` | owner → entity | Accountable for this entity (less than full ownership) |
| `depends_on` | consumer → provider | Consumer breaks if provider fails |
| `contains` | parent → child | Logical containment (project contains service) |
| `supports` | infrastructure → app | Runtime support (PM2 supports Mi-Core) |

---

## Seeded Graph (Mi Project)

### Owners
| ID | Name | Owns |
|----|------|------|
| `owner:hoang` | Hoang Le (CEO) | Dashboard, Mi-Core, Review Automation, WhatsApp Gateway, Knowledge Universe, Jarvis + 3 stores |
| `team:dev` | Dev Team | GStack Pipeline service |

### Projects (8)
- Dashboard, Mi-Core, Review Automation, WhatsApp AI Gateway, Knowledge Universe, Jarvis, Antigravity Gateway, Visibility Layer

### Services (3)
- PM2 Process Manager (weight 10 — all critical paths run through it)
- GStack Pipeline
- WhatsApp Client

### Stores (3)
- Knowledge SQLite DB, Skills Registry JSON, Evidence Directory

---

## Ownership Queries

### `getOwnership(entityId): OwnershipInfo`

Returns:
```typescript
{
  entity_id: string;
  entity_name: string;
  owners: Array<{ id, name, type, relationship, weight }>;
  has_owner: boolean;
  owner_count: number;
}
```

### `getOwnerLoad(ownerId): OwnerLoadReport`

Load levels:
| Level | Count |
|-------|-------|
| LOW | < 5 entities |
| MEDIUM | 5–9 |
| HIGH | 10–14 |
| CRITICAL | ≥ 15 |

### `findUnownedEntities(): UnownedReport`

Returns all entities with no inbound `owner_of` or `responsible_for` edge. Used for ownership gap detection.

---

## REST Endpoints

```
GET /api/graph/ownership/:id      — who owns this entity
GET /api/graph/owner/:id/workload — owner's load report
GET /api/graph/summary            — full ownership summary
```

All require `x-api-key` header.
