# RUNTIME_ALERT_CLASSIFICATION_REPORT

Generated: 2026-06-20T07:44:44.172Z
Target: RUNTIME_ALERT_CLASSIFICATION_READY

INFO: 0
WARNING: 10
CRITICAL: 1

| Severity | Source | Rule | Message | Evidence |
| --- | --- | --- | --- | --- |
| WARNING | Mi-Core | pm2_restart_increase | Mi-Core: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | AI Service | pm2_restart_increase | AI Service: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Ollama | pm2_restart_increase | Ollama: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Agent Engine | pm2_restart_increase | Agent Engine: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | WhatsApp Gateway | pm2_restart_increase | WhatsApp Gateway: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Gmail | connector_stale | Gmail is stale | E:\Project\Master\.local-agent-global\visibility\gmail\data.json |
| WARNING | Work Orders | connector_stale | Work Orders is stale | E:\Project\Master\mi-core\.local-agent-global\work-orders |
| CRITICAL | Mi-Core | runtime_down | Mi-Core is down | fetch failed |
| WARNING | Agent Engine | runtime_not_green | Agent Engine is unknown | pm2_status=pm2_unavailable |
| WARNING | Visibility | runtime_not_green | Visibility is degraded | 1 connector(s) unhealthy |
| WARNING | QB Connector | runtime_not_green | QB Connector is degraded | Connector is not fully healthy |

Classification rules: Ollama timeout once = WARNING; repeated timeout = CRITICAL; PM2 restart > 3/hour = CRITICAL; connector stale/missing = WARNING; dashboard mismatch = CRITICAL.