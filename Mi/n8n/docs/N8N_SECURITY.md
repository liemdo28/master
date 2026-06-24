# N8N Security — Mi Automation Fabric

**Version:** 1.0.0
**Date:** 2026-06-24
**Owner:** Platform Engineering

---

## 1. Security Posture

| Control | Status | Notes |
|---------|--------|-------|
| n8n Basic Auth | ✅ Required | `N8N_BASIC_AUTH_ACTIVE=true` |
| n8n Encryption Key | ✅ Required | All credentials encrypted at rest |
| HTTPS (production) | ⚠️ Optional in dev | Reverse proxy with TLS recommended |
| Mi-Core API Key | ⚠️ Recommended | `MI_CORE_API_KEY` for service-to-service auth |
| Webhook signature | ⚠️ Recommended | Sign outgoing webhook payloads with HMAC |
| Secrets in source | ❌ Forbidden | All secrets in `.env` (gitignored) |
| Audit logging | ✅ Enabled | Every workflow → `/api/mi/workflows/log` |
| IP allowlist | ⚠️ Dev mode | Enforce in production |

---

## 2. Required Environment Variables

```bash
# REQUIRED
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=<admin-username>
N8N_BASIC_AUTH_PASSWORD=<min-16-char-strong-password>
N8N_ENCRYPTION_KEY=<32+-char-random-string>

# RECOMMENDED
MI_CORE_URL=http://127.0.0.1:4001
MI_API_KEY=<matches-MI_CORE_API_KEY>
N8N_WEBHOOK_BASE_URL=https://n8n.yourdomain.com

# OPTIONAL (for production)
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168  # 7 days
N8N_DIAGNOSTICS_ENABLED=false
```

**All variables must come from `.env`. NO secrets in source code, docker-compose, or PM2 ecosystem.**

---

## 3. Threat Model

| Threat | Mitigation |
|--------|------------|
| Unauthorized n8n UI access | Basic Auth + strong password + IP allowlist |
| Credential theft from n8n DB | `N8N_ENCRYPTION_KEY` (must be rotated) |
| Webhook spoofing | Validate HMAC signature on inbound webhooks |
| Lateral movement to Mi-Core | `MI_CORE_API_KEY` only valid for known endpoints |
| Workflow bypass of Mi approval | All workflows MUST call `/api/mi/approval/request` first |
| Brand/store-specific logic in n8n | Banned — workflows MUST support multi-brand via `brand_id` |

---

## 4. Audit & Compliance

All workflow execution is logged to `Mi-Core` at `/api/mi/workflows/log`. Every log record contains:

```json
{
  "workflow_id": "...",
  "domain": "...",
  "source": "n8n",
  "mi_required": true,
  "approval_required": true,
  "brand_id": "...",
  "location_id": "...",
  "task_id": "...",
  "status": "...",
  "started_at": "...",
  "completed_at": "...",
  "error": "..."
}
```

Audit logs persist to `E:\Project\Master\Mi\n8n\data\` and are backed up nightly via `backup-n8n.bat`.

---

## 5. Secret Rotation Schedule

| Secret | Rotation | Last Rotated | Next Due |
|--------|----------|--------------|----------|
| `N8N_BASIC_AUTH_PASSWORD` | Every 90 days | TBD-on-provisioning | +90 days |
| `N8N_ENCRYPTION_KEY` | Every 180 days | TBD-on-provisioning | +180 days |
| `MI_CORE_API_KEY` | Every 90 days | TBD-on-provisioning | +90 days |
| OAuth tokens (per integration) | Per provider policy | Per provider | Per provider |

Rotation procedure:

1. Generate new value (`openssl rand -base64 32`).
2. Update n8n `.env` AND Mi-Core `.env` (for shared keys).
3. `pm2 restart mi-n8n mi-core`.
4. Re-encrypt existing n8n credentials via n8n UI.
5. Run `check-n8n-runtime.bat` to verify.
6. Log rotation event to Mi-Core at `/api/mi/workflows/log` with `domain: "credentials"`.

---

## 6. Network Segmentation (Recommended for Production)

```
[ Internet ]
    ↓ (HTTPS only, WAF in front)
[ n8n Reverse Proxy ]  ← only public surface
    ↓ (private network)
[ n8n :5678 ]
    ↓ (loopback only)
[ Mi-Core :4001 ]  ← no public exposure
```

n8n should NEVER be directly exposed to the internet without a reverse proxy + TLS.

---

## 7. Compliance Checklist (CTO Directive Phase H)

- [x] `N8N_BASIC_AUTH_ACTIVE=true` documented in `.env.example`
- [x] `N8N_BASIC_AUTH_USER` documented (placeholder)
- [x] `N8N_BASIC_AUTH_PASSWORD` documented (placeholder)
- [x] `N8N_ENCRYPTION_KEY` documented (placeholder)
- [x] `MI_CORE_URL` documented
- [x] `MI_API_KEY` documented
- [x] `N8N_WEBHOOK_BASE_URL` documented
- [x] No secrets in source files
- [x] `docs/N8N_SECURITY.md` created
- [x] `config/.env.example` created (gitignore `.env`)
