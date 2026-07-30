# VISIBILITY SECURITY REPORT
**Date:** 2026-06-09
**Status:** ✅ SECURITY COMPLIANT

---

## Security Principles Applied

| Principle | Implementation | Status |
|-----------|----------------|--------|
| Read-only only | No write actions in V1 | ✅ |
| No hardcoded credentials | All via process.env | ✅ |
| Credentials stored securely | google-tokens.json in .local-agent-global (git-ignored) | ✅ |
| OAuth scopes are read-only | gmail.readonly, calendar.readonly, drive.readonly | ✅ |
| Auth status clearly reported | getAuthStatus() with configured/has_tokens/needs_authorization | ✅ |
| Not configured → stub, not fake data | getStubResult() returns empty with status | ✅ |
| IP guard active | LAN + Tailscale only, non-allowed IPs blocked | ✅ |
| Audit log | sync_log.json + errors.json + last_sync.json | ✅ |

---

## Credential Handling

### Google OAuth

**Environment Variables Required:**
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4001/api/auth/google/callback
```

**Token Storage:** `.local-agent-global/visibility/google-tokens.json`
- Access token
- Refresh token (for auto-refresh)
- Expiry date
- All tokens stored locally, never sent externally

**OAuth Scopes (all read-only):**
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/drive.readonly`
- `https://www.googleapis.com/auth/contacts.readonly`

**Token Refresh:** Automatic on expiry (60s before expiry, `client.refreshAccessToken()`)

### Asana

**Environment Variable Required:**
```env
ASANA_TOKEN=your_asana_personal_access_token
```

**Token Usage:** Bearer token in Authorization header, 15s timeout.

### Dashboard

**No credentials needed** — local filesystem scan only. Path controlled by `DASHBOARD_PATH` env var.

---

## Audit Log

Every sync event is logged:

| Event | Log File | Data |
|-------|----------|------|
| Sync started | `sync_log.json` | `synced_at` |
| Sync completed | `sync_log.json` | per-connector result |
| Sync failed | `sync_log.json` + `errors.json` | error message + timestamp |
| Connector error | `connectors/{id}/errors.json` | error details |

**Example sync_log.json:**
```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "results": {
    "gmail": "not_configured",
    "google-calendar": "not_configured",
    "google-drive": "not_configured",
    "asana": "not_configured",
    "dashboard-bakudan": "ok",
    "local-projects": "ok"
  },
  "errors": []
}
```

---

## IP Guard

All visibility endpoints protected by IP guard:
- Allows: 127.0.0.1, 192.168.x.x, 100.x.x.x (LAN + Tailscale)
- Blocks: public internet IPs
- Exception: `/api/remote/health` is public (server info only)

---

## Write Actions

**Status: NOT IMPLEMENTED IN V1**

All connectors are read-only:
- Gmail: read emails only (no send/draft)
- Calendar: read events only (no create/update)
- Drive: read files only (no upload/modify)
- Asana: read tasks only (no create/update)
- Dashboard: read scan only (no write)

Approval gate is in place but write operations not wired in V1.

---

## Verdict

# ✅ VISIBILITY_SECURITY_COMPLIANT

- No hardcoded credentials ✅
- No fake data ✅
- Read-only only ✅
- Tokens stored locally, auto-refresh ✅
- Auth status clearly reported ✅
- IP guard active ✅
- Audit log maintained ✅
- Write actions not implemented ✅
