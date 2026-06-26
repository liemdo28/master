# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-26T16:48:36.558Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 0

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | up | 33.33 | 0 | 0 |
| AI Service | up | 100 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 0 | 0 | 0 |
| Gmail | degraded | 0 | 0 | 0 |
| Calendar | degraded | 0 | 0 | 0 |
| Drive | degraded | 0 | 0 | 0 |
| QB Connector | degraded | 0 | 0 | 0 |
| Health Connector | up | 66.67 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 6
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | fresh | no | 30 |
| Calendar | fresh | no | 29 |
| Drive | fresh | no | 29 |
| Sheets | fresh | no | 29 |
| Asana | fresh | no | 29 |
| Health | fresh | no | 29 |
| Website bakudanramen.com | fresh | no | 29 |
| Website rawsushibar.com | fresh | no | 29 |
| QuickBooks | degraded | no | 0 |
| Work Orders | stale | yes | 15201 |
| Graph | fresh | no | 180 |
| Memory | stale | yes | 2448 |

## Active Incidents
| Type | Source | Summary | Escalation |
| --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | watch |
| runtime_failure | Visibility | Visibility degraded | watch |
| runtime_failure | Gmail | Gmail degraded | watch |
| runtime_failure | Calendar | Calendar degraded | watch |
| runtime_failure | Drive | Drive degraded | watch |
| runtime_failure | QB Connector | QB Connector degraded | watch |
| sync_failure | QuickBooks | QuickBooks freshness degraded | watch |
| sync_failure | Work Orders | Work Orders freshness stale | escalated |
| sync_failure | Memory | Memory freshness stale | escalated |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.