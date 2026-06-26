# DEV2_RUNTIME_RELIABILITY_SNAPSHOT

Generated: 2026-06-26T05:58:16.052Z
Target: DAILY_RELIABILITY_SNAPSHOT_READY
Burn-in score: 26

## Uptime
| Service | Status | Uptime % | Restarts | Crashes |
| --- | --- | --- | --- | --- |
| Mi-Core | up | 74.19 | 0 | 0 |
| AI Service | up | 85.48 | 0 | 0 |
| Ollama | up | 100 | 0 | 0 |
| Agent Engine | unknown | 0 | 0 | 0 |
| Visibility | degraded | 4.84 | 0 | 0 |
| Gmail | up | 100 | 0 | 0 |
| Calendar | up | 100 | 0 | 0 |
| Drive | up | 100 | 0 | 0 |
| QB Connector | degraded | 4.84 | 0 | 0 |
| Health Connector | up | 100 | 0 | 0 |

## Ollama
Reachable: true
Model loaded: true
Latency ms: 12
Timeout count: 0

## Connector Freshness
| Source | Status | Stale | Age Min |
| --- | --- | --- | --- |
| Gmail | stale | yes | 16794 |
| Calendar | fresh | no | 29 |
| Drive | fresh | no | 29 |
| Sheets | fresh | no | 29 |
| Asana | fresh | no | 29 |
| Health | fresh | no | 29 |
| Website bakudanramen.com | fresh | no | 921 |
| Website rawsushibar.com | fresh | no | 921 |
| QuickBooks | degraded | no | 0 |
| Work Orders | fresh | no | 2730 |
| Graph | fresh | no | 305 |
| Memory | stale | yes | 1797 |

## Active Incidents
| Type | Source | Summary | Escalation |
| --- | --- | --- | --- |
| runtime_failure | Agent Engine | Agent Engine unknown | watch |
| sync_failure | Gmail | Gmail freshness stale | escalated |
| runtime_failure | Visibility | Visibility degraded | watch |
| runtime_failure | QB Connector | QB Connector degraded | watch |
| sync_failure | QuickBooks | QuickBooks freshness degraded | watch |
| sync_failure | Memory | Memory freshness stale | escalated |

## Action Required
Dev1: No Dev1 action required from current monitoring snapshot.
Dev2: Escalate and refresh stale or missing connector data.
Dev3: Use before/after restart, latency, timeout, and burn-in score deltas during chat hardening tests.