# RUNTIME_ALERT_CLASSIFICATION_REPORT

Generated: 2026-06-25T08:49:10.411Z
Target: RUNTIME_ALERT_CLASSIFICATION_READY

INFO: 0
WARNING: 9
CRITICAL: 1

| Severity | Source | Rule | Message | Evidence |
| --- | --- | --- | --- | --- |
| WARNING | Mi-Core | pm2_restart_increase | Mi-Core: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | AI Service | pm2_restart_increase | AI Service: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Ollama | pm2_restart_increase | Ollama: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Agent Engine | pm2_restart_increase | Agent Engine: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | WhatsApp Gateway | pm2_restart_increase | WhatsApp Gateway: restarts_last_hour=0, restart_increased=false, port_matches_pm2=null |  |
| WARNING | Gmail | connector_stale | Gmail is stale | E:\Project\Master\.local-agent-global\visibility\gmail\data.json |
| CRITICAL | AI Service | runtime_down | AI Service is down | fetch failed |
| WARNING | Agent Engine | runtime_not_green | Agent Engine is unknown | pm2_status=pm2_unavailable |
| WARNING | Visibility | runtime_not_green | Visibility is degraded | 1 connector(s) unhealthy |
| WARNING | QB Connector | runtime_not_green | QB Connector is degraded | Connector is not fully healthy |

Classification rules: Ollama timeout once = WARNING; repeated timeout = CRITICAL; PM2 restart > 3/hour = CRITICAL; connector stale/missing = WARNING; dashboard mismatch = CRITICAL.