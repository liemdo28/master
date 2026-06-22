# SERVICE_INVENTORY.md
> All runtime services: PM2, Docker, Windows, External.
> Source evidence: ecosystem.config.js, docker-compose.yml, .env files, source code.
> Updated: 2026-06-18

---

## PM2 Services (6)

| PM2 Name | Port | Runtime | Max Memory | Owner Dept | Health |
|----------|------|---------|-----------|-----------|--------|
| `mi-core` | 4001 | Node.js 18+ | 768M | dispatch | `GET /api/health` |
| `whatsapp-ai-gateway` | 3211 | Node.js / Baileys | 512M | executive-assistant | `GET /health` |
| `mi-accounting` | 8844 | Node.js / Express | 256M | finance | `GET /health` |
| `mi-ceo-observer` | 3212 | Node.js / Baileys (headless) | 512M | executive-assistant | `GET /health` |
| `mi-ai-service` | 4002 | Python / uvicorn FastAPI | 512M | dispatch | `GET /health` |
| `mi-node-agent` | 4004 | Node.js | 128M | technical-operations | — |

**All 6 in `ecosystem.config.js`. Restart all:** `pm2 restart ecosystem.config.js`

---

## Docker Services (3 — review-automation-system)

| Container | Port | Runtime | Owner Dept |
|-----------|------|---------|-----------|
| `review-api` | 8000 | Python / FastAPI | marketing |
| `postgres` | 5432 | PostgreSQL 16 | marketing |
| `redis` | 6379 | Redis 7 | marketing |

**CWD:** `E:/Project/Master/Bakudan/review-automation-system/`
**Start:** `docker-compose up -d`
**Stop:** `docker-compose down`

---

## Standalone Services (not in PM2)

| Name | Port | Runtime | Owner Dept | Start Command |
|------|------|---------|-----------|---------------|
| Antigravity AI Gateway | 3456 | Node.js / TypeScript | engineering | `cd Agent/agent-coding-api-keys && npm start` |

---

## Windows Services

| Name | Port | Runtime | Notes |
|------|------|---------|-------|
| Ollama | 11434 | Ollama binary | Required before mi-core. `ollama serve` |

---

## External Services (not on this machine)

| Name | Location | Port | Notes |
|------|----------|------|-------|
| QuickBooks Desktop | laptop1 (Tailscale) | — | Expected degraded when laptop1 offline |
| Bakudan Dashboard | dashboard.bakudanramen.com | 443 | Cloudflare-hosted |

---

## Recovery Runbook

### "Mi ơi sao Dashboard chết?"
```
GET /api/company-os/services/health
pm2 list
pm2 restart mi-core
pm2 logs mi-core --lines 50
```

### "Mi ơi sao WhatsApp down?"
```
pm2 restart whatsapp-ai-gateway
pm2 logs whatsapp-ai-gateway --lines 50
# If session expired: delete session files, restart
```

### "Mi ơi sao Mi-Core không trả lời?"
```
pm2 list
pm2 start ecosystem.config.js
ollama serve  # Ensure Ollama is up
```

### "Mi ơi sao Review System down?"
```
cd Bakudan/review-automation-system
docker-compose ps
docker-compose up -d
docker-compose logs review-api
```

---

## Port Conflict Check

No conflicts in registered services. All ports unique:
`3211, 3212, 3456, 4001, 4002, 4004, 5432, 6379, 8000, 8844, 11434`
