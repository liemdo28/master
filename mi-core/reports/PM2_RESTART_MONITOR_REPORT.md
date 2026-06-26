# PM2_RESTART_MONITOR_REPORT

Generated: 2026-06-25T13:05:59.863Z
Target: PM2_RESTART_MONITOR_READY

| Service | PM2 Name | Status | Restarts | Restarts Last Hour | Crashes | PM2 PID | Port PID | Port Match | Alert |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mi-Core | mi-core | pm2_unavailable | 0 | 0 | 0 |  | 34788 |  | WARNING |
| AI Service | mi-ai-service | pm2_unavailable | 0 | 0 | 0 |  | 38980 |  | WARNING |
| Ollama | ollama | pm2_unavailable | 0 | 0 | 0 |  | 10932 |  | WARNING |
| Agent Engine | agent-engine | pm2_unavailable | 0 | 0 | 0 |  |  |  | WARNING |
| WhatsApp Gateway | whatsapp-ai-gateway | pm2_unavailable | 0 | 0 | 0 |  | 30500 |  | WARNING |

Rules: restart count increase = WARNING; restarts > 3/hour, repeated uptime reset, or port PID mismatch = CRITICAL.