# WHATSAPP_RELIABILITY_CERTIFICATION

**Generated:** 2026-06-15T09:32:45.177Z
**Result:** FAIL

| Metric | Value |
|---|---:|
| Real messages requested | 50 |
| Real messages sent | 0 |
| Mi-Core WhatsApp health HTTP | 200 |
| Gateway PM2 status | online |
| Gateway restarts | 1162 |
| Gateway uptime seconds | 0 |

Real 50-message run blocked: whatsapp-ai-gateway status=online, restarts=1162, uptime=0s

Acceptance requires no unavailable burst, no crash, no dropped reply, and no secret leak. This cannot be certified while the gateway is unstable.
