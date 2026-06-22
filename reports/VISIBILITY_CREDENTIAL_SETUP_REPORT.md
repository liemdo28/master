# VISIBILITY CREDENTIAL SETUP REPORT

**Date:** 2026-06-11
**Status:** PARTIAL — 6/11 connectors live, Google + Asana need CEO credentials

---

## Connector Registry (11 total)

| Connector | Auth Status | Health | Last Sync |
|-----------|-------------|--------|-----------|
| local-projects | connected | healthy | 2026-06-10T15:52 |
| dashboard-bakudan | connected | healthy | 2026-06-10T15:52 |
| food-safety | connected | healthy | 2026-06-10T15:52 |
| health (Huawei export) | connected | healthy | cached |
| accounting | connected | healthy | cached |
| local-websites | connected | stale | 2026-06-10T15:52 |
| asana | **not_configured** | unknown | never |
| gmail | **not_configured** | unknown | never |
| google-calendar | **not_configured** | unknown | never |
| google-drive | **not_configured** | unknown | never |
| google-contacts | **not_configured** | unknown | never |

---

## Phase A — Google OAuth Setup

### Current Status
```json
{"configured":false,"status":"not_configured",
 "hint":"Add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REDIRECT_URI to .env"}
```

### OAuth Flow (already implemented)
- `GET /api/auth/google/start` → redirects to Google consent screen
- `GET /api/auth/google/callback` → exchanges code for tokens, saves to `google-tokens.json`
- `GET /api/auth/google/status` → returns current auth state

### CEO Action Required — Step by Step

1. Go to https://console.cloud.google.com/
2. Create project (or select existing)
3. APIs & Services → Enable:
   - Gmail API
   - Google Calendar API
   - Google Drive API
   - People API (contacts)
4. APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:4001/api/auth/google/callback`
5. Download credentials → copy Client ID and Client Secret
6. Add to `mi-core/server/.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:4001/api/auth/google/callback
   ```
7. Restart Mi server
8. Open in browser: `http://localhost:4001/api/auth/google/start`
9. Grant permissions → browser redirects back → tokens saved to `google-tokens.json`
10. Verify: `GET /api/auth/google/status` → `{"configured":true,"has_tokens":true}`

### Scopes Requested
- gmail.readonly, gmail.send, gmail.compose
- calendar.readonly, calendar.events
- drive.readonly, drive.file
- contacts.readonly

---

## Phase B — Asana Setup

### Current Status
```
not_configured — Set ASANA_TOKEN in .env
Setup hint: get from app.asana.com/0/my-apps
```

### CEO Action Required

1. Go to https://app.asana.com/0/my-apps
2. Create Personal Access Token
3. Add to `mi-core/server/.env`:
   ```
   ASANA_TOKEN=your-asana-personal-access-token
   ```
4. Restart Mi server
5. Verify: `GET /api/visibility/connectors` → asana auth = connected

---

## Phase C — Dashboard Connector

### Current Status: CONNECTED ✅

```
dashboard-bakudan: auth=connected, health=healthy
Dashboard API: live at https://dashboard.bakudanramen.com
```

Dashboard connector reads: tasks, users, reports, inventory, timesheets.
Write actions require Level 2 approval.

---

## Validation Commands (run after credentials added)

```bash
# Google
curl http://localhost:4001/api/auth/google/status
curl http://localhost:4001/api/visibility/emails
curl http://localhost:4001/api/visibility/calendar
curl http://localhost:4001/api/visibility/drive/search?q=report

# Asana
curl http://localhost:4001/api/visibility/tasks
curl http://localhost:4001/api/visibility/tasks/overdue

# Dashboard
curl http://localhost:4001/api/visibility/snapshot
```

---

## Verdict

```
UNIVERSAL_VISIBILITY_LIVE_READY: NOT YET
  6/11 connectors live
  Blocking: CEO must supply GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + ASANA_TOKEN
  Code: all connectors implemented and ready
  OAuth flow: /api/auth/google/start ready to use
```
