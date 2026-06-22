# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-20T07:44:44.172Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 1

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | down | 73.61 | 0 | 0 |
| AI Service | up | 95.83 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 8.33 | 0 | 0 |
| Gmail | up | 100 | 0 | 0 |
| Calendar | up | 100 | 0 | 0 |
| Drive | up | 100 | 0 | 0 |
| QB Connector | degraded | 8.33 | 0 | 0 |
| Health Connector | up | 100 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 12
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | stale | yes | 8261 |
| Calendar | fresh | no | 39 |
| Drive | fresh | no | 39 |
| Sheets | fresh | no | 39 |
| Asana | fresh | no | 39 |
| Health | fresh | no | 39 |
| Website bakudanramen.com | fresh | no | 39 |
| Website rawsushibar.com | fresh | no | 39 |
| QuickBooks | degraded | no | 0 |
| Work Orders | stale | yes | 6017 |
| Graph | fresh | no | 250 |
| Memory | fresh | no | 464 |

## Active Incidents
| Type | Source | Summary | Escalation |
| --- | --- | --- | --- |
| runtime_failure | Mi-Core | Mi-Core down | escalated |
| runtime_failure | Agent Engine | Agent Engine unknown | watch |
| sync_failure | Gmail | Gmail freshness stale | escalated |
| runtime_failure | Visibility | Visibility degraded | watch |
| runtime_failure | QB Connector | QB Connector degraded | watch |
| sync_failure | QuickBooks | QuickBooks freshness degraded | watch |
| sync_failure | Work Orders | Work Orders freshness stale | escalated |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data. Keep critical runtime alerts open until verified resolved.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.