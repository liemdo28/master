# Graph Intelligence REST APIs
**Phase 14.6 — Graph Router**
**Base path: `/api/graph`**
**Auth: `x-api-key` header required**

---

## Authentication

All endpoints require:
```
x-api-key: <MI_CORE_API_KEY>
```
Key: set `MI_CORE_API_KEY` in `server/.env`. No default — server returns 503 if unset.

---

## Entity Resolution

All `:id` parameters accept:
- Full ID: `project:dashboard`
- Prefixed short form: tries `project:`, `service:`, `owner:`, `team:`, `store:`, `repo:`
- Partial name: `dashboard`, `mi-core`, `Review Automation`

---

## Endpoints

### `GET /api/graph/project/:id`
Full project context — ownership + dependency tree + impact analysis.

**Response:**
```json
{
  "success": true,
  "data": {
    "entity": { "id": "project:dashboard", "name": "Dashboard", "type": "project" },
    "ownership": { "owners": [...], "has_owner": true },
    "dependencies": { "depends_on": [...], "depended_on_by": [...] },
    "impact": { "severity": "LOW", "total_impacted": 0, "risk_score": 0 }
  }
}
```

---

### `GET /api/graph/dependencies/:id`
Dependency tree — upstream (what X needs) and downstream (who needs X).

---

### `GET /api/graph/ownership/:id`
Ownership information for an entity.

**Response:**
```json
{
  "entity_id": "project:dashboard",
  "owners": [{ "id": "owner:hoang", "name": "Hoang Le (CEO)", "relationship": "owner_of" }],
  "has_owner": true
}
```

---

### `GET /api/graph/impact/:id`
Impact analysis — what fails if this entity fails.

**Response:**
```json
{
  "failed_entity_name": "Mi-Core",
  "directly_impacted": [...],
  "transitively_impacted": [...],
  "total_impacted": 5,
  "severity": "CRITICAL",
  "risk_score": 95
}
```

---

### `GET /api/graph/risks/:id?severity=OFFLINE`
Risk propagation chain simulation.

**Query params:**
- `severity`: `OFFLINE` (default) | `DEGRADED` | `OVERLOADED`

**Response:**
```json
{
  "blast_radius": 3,
  "overall_risk_score": 75,
  "ceo_alert_required": true,
  "affected_entities": [...],
  "remediation_steps": [...]
}
```

---

### `GET /api/graph/spof`
All single points of failure in the system.

**Response:** Array of `CriticalPathResult` sorted by `criticality_score` DESC.

---

### `GET /api/graph/system-risk`
Full system risk report — scans all entities.

---

### `GET /api/graph/summary`
Ownership summary — owned vs. unowned, owner load levels.

---

### `GET /api/graph/search?q=<name>`
Search entities by partial name.

---

### `GET /api/graph/stats`
Graph database statistics.

**Response:**
```json
{
  "entity_count": 17,
  "edge_count": 28,
  "entity_types": { "project": 8, "service": 3, "store": 3, "owner": 2, "team": 1, "repository": 1 },
  "relationship_types": { "depends_on": 13, "owner_of": 7, "supports": 2, "contains": 3, "responsible_for": 3 }
}
```

---

### `GET /api/graph/owner/:id/workload`
Owner load report.

**Response:**
```json
{
  "owner_id": "owner:hoang",
  "owned_count": 9,
  "load_level": "HIGH",
  "owned_entities": [...]
}
```

---

### `GET /api/graph/blocker/:id`
Who owns a blocker entity — used for escalation routing.

---

## Error Response

```json
{
  "success": false,
  "error": "Entity not found: unknown-project"
}
```
HTTP 404 for entity-not-found, HTTP 401 for missing/invalid API key.
