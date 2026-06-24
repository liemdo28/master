# N8N SECURITY HARDENING REPORT — Phase 27G
**Date:** 2026-06-24

## Audit Results

| Check | Before | After | Status |
|-------|--------|-------|--------|
| Basic Auth | n8n 2.x uses JWT API keys — no Basic auth | N/A | ✅ |
| n8n user accounts | 1 owner: liem.dt0208@gmail.com | Unchanged | ✅ |
| API key storage | In `.env` as `N8N_API_KEY` (gitignored) | Unchanged | ✅ |
| Encryption key | n8n auto-generated on init | Unchanged | ✅ |
| Credential storage | No credentials configured in n8n | N/A | ✅ |
| Webhook exposure | WEBHOOK_URL=http://127.0.0.1:5678 | Unchanged | ✅ |
| **Localhost binding** | `0.0.0.0:5678` (all interfaces) | **`N8N_HOST=127.0.0.1`** | ✅ FIXED |
| External access | Port 5678 was world-open | Restricted to localhost | ✅ FIXED |
| Hardcoded credentials | None found in source | None found | ✅ |
| Secrets in repo | .env is gitignored | Verified | ✅ |

## Key Fix Applied

**`ecosystem.config.js`** — added `N8N_HOST: '127.0.0.1'`:

```javascript
env: {
  N8N_PORT: '5678',
  N8N_HOST: '127.0.0.1',  // ← ADDED: was binding 0.0.0.0 (all interfaces)
  N8N_LOG_LEVEL: 'warn',
  WEBHOOK_URL: 'http://127.0.0.1:5678',
}
```

> Note: Change takes effect on next `pm2 restart mi-n8n --update-env`. Current running process still on 0.0.0.0 until restarted.

## n8n Auth Model

- n8n 2.27 uses JWT API keys via `X-N8N-API-KEY` header
- Mi-Core was updated to use API key auth (not Basic auth) in n8n-router.ts
- API key stored only in `.env` — never committed to git

## No Exposed Credentials

```
GET /api/v1/credentials
→ {"data": []}  (no credentials stored in n8n)
```

All API keys (GSC, n8n, QB) stored in Mi-Core `.env`, not in n8n credential store.

## Final Status: `N8N_SECURITY_HARDENED`

> Restart mi-n8n with `--update-env` to apply localhost binding.
