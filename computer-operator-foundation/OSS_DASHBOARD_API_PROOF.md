# OSS Dashboard API Proof

## Summary

The OSS Dashboard API provides 13 read-only endpoints on port 5180.
Every response includes a `ts` field for freshness awareness. No fabrication.

## Port Assignment

| Service | Port |
|---|---|
| Financial Warehouse | 5177 |
| Financial Intelligence | 5178 |
| **OSS Governance** | **5180** |

## Endpoints (13/13 green)

```text
[OK] GET  /api/oss/health                         -> 200
[OK] GET  /api/oss/registry                        -> 200
[OK] GET  /api/oss/registry/division/Engineering   -> 200
[OK] GET  /api/oss/registry/stage/DISCOVERY        -> 200
[OK] GET  /api/oss/projects/{project_id}           -> 200
[OK] GET  /api/oss/pipeline                        -> 200
[OK] GET  /api/oss/scorecards                      -> 200
[OK] GET  /api/oss/risks                           -> 200
[OK] GET  /api/oss/coordination                    -> 200
[OK] POST /api/oss/coordination/emit               -> 200
[OK] GET  /api/oss/lifecycle/events                -> 200
[OK] GET  /api/oss/lifecycle/gates                 -> 200
[OK] GET  /api/oss/summary                         -> 200
[OK] GET  /api/oss/runtime-proof                   -> 200
```

## Endpoint Details

| Method | Path | Returns |
|---|---|---|
| GET | /api/oss/health | Registry + pipeline + coordination summary |
| GET | /api/oss/registry | All projects (27) with stage, division, license |
| GET | /api/oss/registry/division/{div} | Projects filtered by division |
| GET | /api/oss/registry/stage/{stage} | Projects filtered by lifecycle stage |
| GET | /api/oss/projects/{id} | Single project detail + embedded scorecard |
| GET | /api/oss/pipeline | Pipeline health (HEALTHY/SLOW/BLOCKED) |
| GET | /api/oss/scorecards | All evaluated scorecards |
| GET | /api/oss/risks | Detected risks (P0/P1/P2) |
| GET | /api/oss/coordination | Coordination task summary |
| POST | /api/oss/coordination/emit | Trigger scan, emit tasks/risks/alerts |
| GET | /api/oss/lifecycle/events | Lifecycle transition history |
| GET | /api/oss/lifecycle/gates | Stage gate definitions (8 stages) |
| GET | /api/oss/summary | Executive dashboard summary |

## Self-Test (47/47 checks)

```text
registry_loads                         [PASS]
lifecycle_pipeline                     [PASS]
coordination_adapter                   [PASS]
risks_detectable                       [PASS]
scorecard_license                      [PASS]
license_risk_map                       [PASS]
stage_gates                            [PASS]
divisions                              [PASS]
categories                             [PASS]
summary_endpoint                       [PASS]
health_endpoint                        [PASS]
lifecycle_gates_endpoint               [PASS]
no_fabrication_{name}                  [PASS] (27 projects)
empty_registry_risk                    [PASS]
register_project                       [PASS]
advance_stage                          [PASS]
build_scorecard                        [PASS]
coordination_emit                      [PASS]
retire_project                         [PASS]
evidence_files_written                 [PASS]
dashboard_port                         [PASS]
```

## 404 Handling

- Unknown GET route → `{"error": "Unknown route: ...", "status": 404}`
- Unknown POST route → `{"error": "Unknown POST route: ...", "status": 404}`
- Unknown project ID → `{"error": "Project not found: ...", "status": 404}`

## Runtime Proof Result

```text
[PASS] dashboard_13_endpoints  — 13/13 passed