# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-24T08:16:02.366Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 0

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | up | 76.29 | 0 | 0 |
| AI Service | up | 85.57 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 6.19 | 0 | 0 |
| Gmail | up | 100 | 0 | 0 |
| Calendar | up | 100 | 0 | 0 |
| Drive | up | 100 | 0 | 0 |
| QB Connector | degraded | 6.19 | 0 | 0 |
| Health Connector | up | 100 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 10
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | stale | yes | 14052 |
| Calendar | stale | yes | 5735 |
| Drive | stale | yes | 5735 |
| Sheets | degraded | no | 0 |
| Asana | fresh | no | 30 |
| Health | fresh | no | 30 |
| Website bakudanramen.com | fresh | no | 30 |
| Website rawsushibar.com | fresh | no | 30 |
| QuickBooks | degraded | no | 0 |
| Work Orders | stale | yes | 11809 |
| Graph | fresh | no | 120 |
| Memory | fresh | no | 345 |

## Active Incidents
| Type | Source | Summary | Escalation |
| --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | watch |
| sync_failure | Gmail | Gmail freshness stale | escalated |
| runtime_failure | Visibility | Visibility degraded | watch |
| runtime_failure | QB Connector | QB Connector degraded | watch |
| sync_failure | QuickBooks | QuickBooks freshness degraded | watch |
| sync_failure | Work Orders | Work Orders freshness stale | escalated |
| sync_failure | Calendar | Calendar freshness stale | escalated |
| sync_failure | Drive | Drive freshness stale | escalated |
| sync_failure | Sheets | Sheets freshness degraded | watch |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.