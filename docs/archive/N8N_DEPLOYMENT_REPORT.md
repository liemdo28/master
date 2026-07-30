# N8N DEPLOYMENT REPORT (C1)
**Date:** 2026-06-24  
**Status:** ✅ READY TO DEPLOY

---

## Deployment Package

### Files Created
```
services/n8n-execution-bus/
  docker-compose.yml              ← n8n Docker config
  control/n8n-control-service.js  ← Mi ↔ n8n connector
  workflows/workflow-registry.json ← 15 workflows registered
```

### n8n Docker Configuration
```yaml
Image:     docker.n8n.io/n8nio/n8n:latest
Container: mi-n8n
Port:      5678 (local)
Auth:      Basic Auth (mi-admin / configurable)
Volume:    mi_n8n_data (persistent)
Timezone:  Asia/Ho_Chi_Minh
Restart:   unless-stopped
Healthcheck: /healthz every 30s
```

### Mi-Core Integration
```
n8n → mi-core:
  Webhook trigger: POST /api/n8n/trigger/:workflow_id
  Evidence return: POST /api/n8n/evidence

mi-core → n8n:
  Container URL: http://host.docker.internal:4001
  n8n webhooks: http://localhost:5678/webhook/:id
```

### n8n Router Wired
```
GET    /api/n8n/health              → n8n health check
GET    /api/n8n/workflows           → list all workflows
POST   /api/n8n/trigger/:id         → trigger workflow
GET    /api/n8n/execution/:id       → get execution status
GET    /api/n8n/execution/:id/logs  → execution logs
DELETE /api/n8n/execution/:id       → stop execution
POST   /api/n8n/evidence            → receive workflow output
GET    /api/n8n/evidence            → list recent evidence
```

### Deploy Command
```bash
cd E:/Project/Master/mi-core/services/n8n-execution-bus
# Set password in .env or pass directly:
N8N_PASSWORD=<strong-password> docker-compose up -d
# Verify:
docker ps | grep mi-n8n
curl http://localhost:5678/healthz
curl http://localhost:4001/api/n8n/health
```

### PM2 Integration
n8n runs in Docker, not PM2. To monitor from PM2 side:
```bash
# Add to ecosystem.config.js for health monitoring:
# { name: 'n8n-health-check', script: 'scripts/check-n8n.js', cron: '*/5 * * * *' }
```

---

## Environment Variables Required
```
N8N_URL=http://localhost:5678
N8N_USER=mi-admin
N8N_PASS=<strong-password>
N8N_ENCRYPTION_KEY=<random-32-char>
```

---

## CEO Action Required
Run: `N8N_PASSWORD=<password> docker-compose up -d` from `services/n8n-execution-bus/`

**Status:** READY — Docker available, image will auto-pull on first run.
