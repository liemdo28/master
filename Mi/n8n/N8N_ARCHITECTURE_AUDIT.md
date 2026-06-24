# N8N Architecture Audit — Mi Automation Fabric

**Audit Date:** 2026-06-24 08:43 (Asia/Ho_Chi_Minh)
**Auditor:** Cline (CTO Directive Phase A)
**Scope:** Current n8n installation under `E:\Project\Master\mi-core\services\n8n-execution-bus\`
**Target:** Upgrade to official Mi Automation Fabric at `Project/Master/Mi/n8n/`

---

## 1. n8n Install Path

| Property | Value |
|----------|-------|
| n8n binary | `C:\Users\liemdo\AppData\Roaming\npm\n8n.cmd` |
| n8n version | **2.27.3** |
| n8n package root | `C:\Users\liemdo\AppData\Roaming\npm\node_modules\n8n` |
| Install method | npm global (`npm install -g n8n`) |
| Wrapper script | `E:\Project\Master\mi-core\services\n8n-execution-bus\n8n-start.js` |

**Wrapper purpose**: PM2 forks the script. The wrapper manipulates `process.argv` to make oclif parse `n8n start` correctly.

---

## 2. n8n Port

| Property | Value |
|----------|-------|
| Configured port | **5678** (env `N8N_PORT`) |
| Webhook URL | `http://127.0.0.1:5678` |
| Public webhook URL | `http://localhost:5678/` (docker-compose) |
| Port binding status at audit time | **NOT BOUND** — curl to `:5678/healthz` returns connection refused (exit 7) |

---

## 3. n8n Start Method

| Property | Value |
|----------|-------|
| Process manager | **PM2** |
| PM2 process name | `mi-n8n` |
| PM2 process ID | 9 |
| Script | `services/n8n-execution-bus/n8n-start.js` |
| Working dir | `E:\Project\Master\mi-core` |
| Mode | fork, instances 1 |
| Restart policy | autorestart, max 512M, restart_delay 5s |
| Logs (out) | `E:\Project\Master\mi-core\.local-agent-global\logs\n8n-out.log` |
| Logs (err) | `E:\Project\Master\mi-core\.local-agent-global\logs\n8n-error.log` |

---

## 4. n8n Database Type

| Property | Value |
|----------|-------|
| Default DB | **SQLite** (n8n default — no PostgreSQL configured) |
| DB location | `./.n8n/database.sqlite` (within n8n data dir) |
| Container volume | `mi_n8n_data:/home/node/.n8n` (docker-compose) |
| Local data dir | `E:\Project\Master\mi-core\services\n8n-execution-bus\data\` (currently empty) |

---

## 5. n8n Credentials Storage

| Property | Value |
|----------|-------|
| Credentials store | n8n internal DB (encrypted with `N8N_ENCRYPTION_KEY`) |
| Encryption key env | `N8N_ENCRYPTION_KEY` |
| Default value | `mi-core-n8n-key-2025-secure` (from docker-compose) |
| Basic Auth user | `mi-admin` (env `N8N_BASIC_AUTH_USER`) |
| Basic Auth password | `mi-n8n-secure-2025` (default from docker-compose) |
| Auth active | `N8N_BASIC_AUTH_ACTIVE=true` |

---

## 6. Active Workflows

**0 active workflows** at audit time.

The existing workflow registry (`workflow-registry.json`) defines 15 workflows by intent, but none have been imported into the n8n instance. Data directory is empty.

---

## 7. Inactive Workflows

The 15 registry entries are dormant until imported:

| ID | Department | Schedule |
|----|------------|----------|
| exec-daily-brief | executive | 0 7 * * * |
| exec-weekly-brief | executive | 0 8 * * 1 |
| exec-monthly-report | executive | 0 9 1 * * |
| finance-qb-sync | finance | 0 */6 * * * |
| finance-tax-reminder | finance | 0 9 1,15 * * |
| finance-payroll-reminder | finance | 0 9 25 * * |
| ops-daily-store-health | operations | 0 6 * * * |
| ops-compliance-summary | operations | 0 7 * * 1 |
| ops-missed-task-alert | operations | 0 14 * * * |
| mkt-seo-summary | marketing | 0 8 * * 1 |
| mkt-review-summary | marketing | 0 9 * * 1 |
| mkt-campaign-summary | marketing | 0 10 * * 1 |
| eng-pm2-health | engineering | */15 * * * * |
| eng-build-monitor | engineering | on_push |
| eng-error-monitor | engineering | */30 * * * * |

---

## 8. Webhook URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:5678/` | Public webhook base (docker-compose) |
| `http://127.0.0.1:5678` | Internal webhook base (PM2 env) |
| `http://host.docker.internal:4001/api/n8n/evidence` | Evidence callback to Mi-Core |

---

## 9. Connected Services

| Service | Endpoint |
|---------|----------|
| Mi-Core | `http://127.0.0.1:4001` / `http://host.docker.internal:4001` |
| Accounting Engine | `http://127.0.0.1:8844` |
| WhatsApp AI Gateway | `http://127.0.0.1:3211` |
| CEO Observer | `http://127.0.0.1:3212` |
| Python AI Service | `http://127.0.0.1:4002` |
| Ollama | `http://localhost:11434` |

---

## 10. Environment Variables

| Variable | Value |
|----------|-------|
| `N8N_PORT` | `5678` |
| `N8N_LOG_LEVEL` | `warn` |
| `N8N_HOST` | `0.0.0.0` |
| `N8N_PROTOCOL` | `http` |
| `N8N_BASIC_AUTH_ACTIVE` | `true` |
| `N8N_BASIC_AUTH_USER` | `mi-admin` |
| `N8N_BASIC_AUTH_PASSWORD` | `mi-n8n-secure-2025` (default — should rotate) |
| `N8N_ENCRYPTION_KEY` | `mi-core-n8n-key-2025-secure` (default — should rotate) |
| `WEBHOOK_URL` | `http://localhost:5678/` |
| `GENERIC_TIMEZONE` | `Asia/Ho_Chi_Minh` |
| `MI_CORE_URL` | `http://host.docker.internal:4001` |
| `MI_CORE_API_KEY` | (unset — should configure) |
| `MI_EVIDENCE_WEBHOOK` | `http://host.docker.internal:4001/api/n8n/evidence` |

---

## 11. Logs Location

| Log | Path |
|-----|------|
| n8n out (PM2) | `E:\Project\Master\mi-core\.local-agent-global\logs\n8n-out.log` |
| n8n error (PM2) | `E:\Project\Master\mi-core\.local-agent-global\logs\n8n-error.log` |
| n8n internal (in container) | `/home/node/.n8n/logs/n8n.log` |
| Mi-Core evidence log | In-memory `evidenceLog` array (max 500 entries) |

---

## 12. Backup Status

**No backup scripts existed** before this audit. The data directory is empty. This is a critical gap addressed in Phase I.

---

## 13. Security / Auth Status

| Aspect | Status |
|--------|--------|
| Basic Auth on UI/API | ✅ Enabled |
| Credentials encryption | ✅ Key configured (but default value, should rotate) |
| Webhook URL public | ⚠️ Currently `localhost` only — OK for dev |
| API key for Mi-Core | ❌ Not configured (`MI_CORE_API_KEY` empty) |
| IP allowlist | ❌ Not enforced |
| HTTPS | ❌ HTTP only (dev) |
| Secrets in source | ⚠️ docker-compose.yml contains default creds |

---

## 14. Audit Commands (Raw Output Captured)

```cmd
where n8n
→ C:\Users\liemdo\AppData\Roaming\npm\n8n
→ C:\Users\liemdo\AppData\Roaming\npm\n8n.cmd

pm2 list
→ mi-accounting, mi-ai-service, mi-ceo-observer, mi-core, mi-n8n, mi-node-agent, mi-whatsapp-gateway
→ mi-n8n: online, pid 17428 (later restarted to pid 31216)

pm2 logs mi-n8n --lines 80
→ n8n-out.log: 0 bytes (empty)
→ n8n-error.log: 0 bytes (empty)
→ WARNING: n8n started but produced no output, port not bound

netstat -ano | findstr ":5678"
→ (no output) — port 5678 NOT listening

dir Project\Master /S /B | findstr /I "n8n"
→ Found 3 paths under mi-core and 1 registry file (workflow-registry.json)
```

---

## 15. Audit Conclusion

The n8n installation exists structurally but is **not functionally running**:

1. ✅ n8n binary installed globally (v2.27.3)
2. ✅ PM2 manages mi-n8n process (starts on PM2 boot)
3. ✅ Configuration files present (docker-compose.yml, ecosystem.config.js, n8n-start.js)
4. ❌ Port 5678 not bound — n8n internal start likely failing silently
5. ❌ No workflows imported (data dir empty)
6. ❌ Mi-Core `/api/mi/*` contract endpoints absent (only `/api/n8n/*` exists)
7. ❌ No backup scripts
8. ⚠️ Default credentials in source

**Remediation is applied in Phases B–I of this directive.**
