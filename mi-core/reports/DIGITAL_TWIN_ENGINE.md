# DIGITAL_TWIN_ENGINE — Phase 24
**Target:** DIGITAL_TWIN_READY ✅

## What It Does
Simulates failure scenarios before they happen.
CEO can ask: "Nếu PM2 chết thì sao?", "Nếu Dev1 nghỉ?", "Dashboard fail thì ảnh hưởng gì?"

## Simulation Types

### Entity Failure Simulation
```
GET /api/digital-twin/simulate/failure/:entity
POST /api/digital-twin/simulate  { type: "failure", target: "dashboard" }
```
Returns:
- `direct_impact` — systems directly depending on failed entity
- `cascade_impact` — 2nd/3rd order effects (recursive graph traversal)
- `severity` — LOW / MEDIUM / HIGH / CRITICAL (based on affected_count)
- `estimated_downtime_hours` — CRITICAL: 4h, HIGH: 2h, else 0.5h
- `recovery_complexity` — SIMPLE / MODERATE / COMPLEX
- `mitigation_vi` — Vietnamese action recommendations

### Owner Absence Simulation
```
GET /api/digital-twin/simulate/absence/:role  (dev1, qa, pm)
POST /api/digital-twin/simulate  { type: "absence", target: "dev1" }
```
Returns:
- `tasks_at_risk` — what this owner was doing last 7 days
- `blockers_unaddressed` — open incidents with no other assignee
- `recommendation_vi` — who should cover, what to reassign

## Graph Integration
Uses Phase 14 `graph.db` edges (`depends_on` relationship) for blast radius calculation.
Recursive DFS with visited-Set to prevent infinite loops in circular graphs.

## Severity Scale
| Affected Count | Severity |
|---------------|---------|
| 0 | LOW |
| 1-2 | MEDIUM |
| 3-4 | HIGH |
| 5+ | CRITICAL |

## API Routes
```
GET  /api/digital-twin/entities                  — all entities with criticality scores
GET  /api/digital-twin/simulate/failure/:entity  — failure simulation
GET  /api/digital-twin/simulate/absence/:role    — owner absence simulation
POST /api/digital-twin/simulate                  — generic simulation endpoint
```
