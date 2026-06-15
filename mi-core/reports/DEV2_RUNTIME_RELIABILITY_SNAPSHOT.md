# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-15T01:45:19.541Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 41

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | up | 92.31 | 0 | 0 |
| AI Service | up | 100 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 38.46 | 0 | 0 |
| Gmail | up | 100 | 0 | 0 |
| Calendar | up | 100 | 0 | 0 |
| Drive | up | 100 | 0 | 0 |
| QB Connector | degraded | 38.46 | 0 | 0 |
| Health Connector | up | 100 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 5
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | stale | yes | 701 |
| Calendar | fresh | no | 29 |
| Drive | fresh | no | 29 |
| Sheets | fresh | no | 29 |
| Asana | fresh | no | 29 |
| Health | fresh | no | 29 |
| Website bakudanramen.com | fresh | no | 29 |
| Website rawsushibar.com | fresh | no | 29 |
| QuickBooks | degraded | no | 0 |
| Work Orders | fresh | no | 2091 |
| Graph | fresh | no | 60 |
| Memory | fresh | no | 16 |

## Active Incidents
| Type | Source | Summary | Escalation |
| --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | watch |
| sync_failure | Gmail | Gmail freshness stale | escalated |
| runtime_failure | Visibility | Visibility degraded | watch |
| runtime_failure | QB Connector | QB Connector degraded | watch |
| sync_failure | QuickBooks | QuickBooks freshness degraded | watch |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.