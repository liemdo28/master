# PM2_RESTART_MONITOR_REPORT

Generated: 2026-06-26T13:45:09.654Z
Target: PM2_RESTART_MONITOR_READY

| Service | PM2 Name | Status | Restarts | Restarts Last Hour | Crashes | PM2 PID | Port PID | Port Match | Alert |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mi-Core | mi-core | pm2_unavailable | 0 | 0 | 0 |  | 10660 |  | WARNING |
| AI Service | mi-ai-service | pm2_unavailable | 0 | 0 | 0 |  | 21892 |  | WARNING |
| Ollama | ollama | pm2_unavailable | 0 | 0 | 0 |  | 23888 |  | WARNING |
| Agent Engine | agent-engine | pm2_unavailable | 0 | 0 | 0 |  |  |  | WARNING |
| WhatsApp Gateway | whatsapp-ai-gateway | pm2_unavailable | 0 | 0 | 0 |  | 8752 |  | WARNING |

Rules: restart count increase = WARNING; restarts > 3/hour, repeated uptime reset, or port PID mismatch = CRITICAL.