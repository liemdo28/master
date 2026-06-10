# VISIBILITY_CONNECTOR_STATUS_REPORT
**Generated:** 2026-06-09

## Current Status

| Connector | Auth | Cache | Ready | Setup Needed |
|---|---|---|---|---|
| Gmail | ❌ no token | ❌ empty | ❌ | `/api/auth/google/start` |
| Google Calendar | ❌ no token | ❌ empty | ❌ | Same OAuth as Gmail |
| Google Drive | ❌ no token | ❌ empty | ❌ | Same OAuth as Gmail |
| Asana | ❌ no token | ❌ empty | ❌ | Add `ASANA_TOKEN` to `.env` |
| Dashboard | ✅ HTTP | ✅ live | ✅ | None |
| Master Workspace | ✅ exists | ✅ registry | ✅ | None |
| Huawei Health | ❌ no export | ❌ empty | ❌ | Export from app |
| Local Files | ✅ filesystem | N/A | ✅ | None |

## Setup Instructions (CEO Action Required)

### Google (Gmail + Calendar + Drive) — One OAuth flow for all:
1. Open: `http://localhost:4001/api/auth/google/start`
2. Select Google account
3. All three connectors activate simultaneously

### Asana:
1. Go to `asana.com/0/my-apps`
2. Create personal access token
3. Add to `server/.env`: `ASANA_TOKEN=<your-token>`
4. Restart Mi: re-run `start-mi-core-remote.bat`

### Huawei Health:
1. Open Huawei Health app
2. Export data as JSON/CSV
3. Place in: `.local-agent-global/visibility/health/export/`

## Behavior Without Auth
- Mi returns `CONNECTOR_NOT_CONFIGURED` for any connector not set up
- Mi includes exact setup instructions in the response
- Mi never fabricates data for unconfigured connectors
- Connected connectors (Dashboard, Local Files) work fully

---
VISIBILITY_CONNECTOR_STATUS_READY
