# RUNTIME_ALERT_CLASSIFICATION_REPORT

Generated: 2026-06-26T16:48:36.557Z
Target: RUNTIME_ALERT_CLASSIFICATION_READY

INFO: 0
WARNING: 13
CRITICAL: 0

| Severity | Source | Rule | Message | Evidence |
| --- | --- | --- | --- | --- |
| WARNING | Mi-Core | pm2_restart_increase | Mi-Core: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | AI Service | pm2_restart_increase | AI Service: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Ollama | pm2_restart_increase | Ollama: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Agent Engine | pm2_restart_increase | Agent Engine: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | WhatsApp Gateway | pm2_restart_increase | WhatsApp Gateway: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Work Orders | connector_stale | Work Orders is stale | D:\Project\Master\mi-core\.local-agent-global\work-orders |
| WARNING | Memory | connector_stale | Memory is stale | D:\Project\Master\mi-core\.local-agent-global\operational-memory |
| WARNING | Agent Engine | runtime_not_green | Agent Engine is unknown | pm2_status=pm2_unavailable |
| WARNING | Visibility | runtime_not_green | Visibility is degraded | 2 connector(s) unhealthy |
| WARNING | Gmail | runtime_not_green | Gmail is degraded | Connector is not fully healthy |
| WARNING | Calendar | runtime_not_green | Calendar is degraded | Connector is not fully healthy |
| WARNING | Drive | runtime_not_green | Drive is degraded | Connector is not fully healthy |
| WARNING | QB Connector | runtime_not_green | QB Connector is degraded | Connector is not fully healthy |

Classification rules: Ollama timeout once = WARNING; repeated timeout = CRITICAL; PM2 restart > 3/hour = CRITICAL; connector stale/missing = WARNING; dashboard mismatch = CRITICAL.