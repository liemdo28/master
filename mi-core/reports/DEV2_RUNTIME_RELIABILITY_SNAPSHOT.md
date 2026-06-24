# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-24T07:16:02.679Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 0

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | down | 76.04 | 0 | 0 |
| AI Service | up | 85.42 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 6.25 | 0 | 0 |
| Gmail | up | 100 | 0 | 0 |
| Calendar | up | 100 | 0 | 0 |
| Drive | up | 100 | 0 | 0 |
| QB Connector | degraded | 6.25 | 0 | 0 |
| Health Connector | up | 100 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 15
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | stale | yes | 13992 |
| Calendar | stale | yes | 5675 |
| Drive | stale | yes | 5675 |
| Sheets | degraded | no | 0 |
| Asana | fresh | no | 30 |
| Health | fresh | no | 30 |
| Website bakudanramen.com | fresh | no | 30 |
| Website rawsushibar.com | fresh | no | 30 |
| QuickBooks | degraded | no | 0 |
| Work Orders | stale | yes | 11749 |
| Graph | fresh | no | 60 |
| Memory | fresh | no | 285 |

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
| sync_failure | Calendar | Calendar freshness stale | escalated |
| sync_failure | Drive | Drive freshness stale | escalated |
| sync_failure | Sheets | Sheets freshness degraded | watch |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data. Keep critical runtime alerts open until verified resolved.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.