# BURN_IN_WATCHDOG_FEED_REPORT

Generated: 2026-06-26T16:48:36.557Z
Target: BURN_IN_WATCHDOG_FEED_READY
Burn-in score: 0
Ollama timeouts: 0
Mi-Core uptime %: 33.33

## PM2 Restarts
| Service | Restarts | Restarts Last Hour | Alert |
| --- | --- | --- | --- |
| Mi-Core | 0 | 0 | WARNING |
| AI Service | 0 | 0 | WARNING |
| Ollama | 0 | 0 | WARNING |
| Agent Engine | 0 | 0 | WARNING |
| WhatsApp Gateway | 0 | 0 | WARNING |

## Stale Data
| Source | Status | Age Min | Threshold Min |
| --- | --- | --- | --- |
| QuickBooks | degraded | 0 | 1440 |
| Work Orders | stale | 15201 | 2880 |
| Memory | stale | 2448 | 1440 |

## Flow Gaps
| Severity | Source | Rule | Message |
| --- | --- | --- | --- |
| WARNING | Mi-Core | pm2_restart_increase | Mi-Core: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |
| WARNING | AI Service | pm2_restart_increase | AI Service: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |
| WARNING | Ollama | pm2_restart_increase | Ollama: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |
| WARNING | Agent Engine | pm2_restart_increase | Agent Engine: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |
| WARNING | WhatsApp Gateway | pm2_restart_increase | WhatsApp Gateway: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |
| WARNING | Work Orders | connector_stale | Work Orders is stale |
| WARNING | Memory | connector_stale | Memory is stale |
| WARNING | Agent Engine | runtime_not_green | Agent Engine is unknown |
| WARNING | Visibility | runtime_not_green | Visibility is degraded |
| WARNING | Gmail | runtime_not_green | Gmail is degraded |
| WARNING | Calendar | runtime_not_green | Calendar is degraded |
| WARNING | Drive | runtime_not_green | Drive is degraded |
| WARNING | QB Connector | runtime_not_green | QB Connector is degraded |