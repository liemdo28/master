# CONNECTOR REGISTRY REPORT
**Date:** 2026-06-09
**Status:** ✅ OPERATIONAL

---

## Registry Architecture

**File:** `server/src/visibility/connector-registry.ts`
**Data:** `.local-agent-global/visibility/connector-registry.json`

The Connector Registry is the **single source of truth** for what Mi can see. It tracks:
- Which connectors exist
- Their authentication status
- Their health status
- When they last synced
- What they can read/write
- How to set them up

---

## Registered Connectors (11 total)

| # | Connector ID | Name | Type | Status | Auth |
|---|-------------|------|------|--------|------|
| 1 | local-projects | Master Workspace (Local) | local | active | connected |
| 2 | dashboard-bakudan | Dashboard bakudanramen.com | local | active | connected |
| 3 | gmail | Gmail | api | pending | not_configured |
| 4 | google-calendar | Google Calendar | api | pending | not_configured |
| 5 | google-drive | Google Drive | api | pending | not_configured |
| 6 | asana | Asana | api | pending | not_configured |
| 7 | health-export | Huawei Health Export | export | pending | not_configured |
| 8 | website-raw | rawsushibar.com | local | active | connected |
| 9 | website-bakudan | bakudanramen.com | local | active | connected |
| 10 | accounting | Accounting Engine | api | active | connected |
| 11 | food-safety | Food Safety Gateway | local | active | connected |

---

## Priority Connectors Status

### 1. Gmail — ⚠️ NOT CONFIGURED

| Field | Value |
|-------|-------|
| Type | api |
| Auth Status | not_configured |
| Setup Required | GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env |
| Setup Hint | Google Cloud Console → OAuth 2.0 |
| Read Capability | emails, threads, labels, attachments |
| Write Capability | drafts, send |
| Approval Required | true |
| Scope | `https://www.googleapis.com/auth/gmail.readonly` |
| Cache Path | `.local-agent-global/visibility/gmail/` |
| Health Status | unknown |

**To activate:** Add OAuth credentials to `server/.env`

### 2. Google Calendar — ⚠️ NOT CONFIGURED

| Field | Value |
|-------|-------|
| Type | api |
| Auth Status | not_configured |
| Setup Required | Same as Gmail (shares OAuth credentials) |
| Setup Hint | Same OAuth as Gmail — shares GOOGLE_CLIENT_ID/SECRET |
| Read Capability | events, calendars, reminders |
| Write Capability | events |
| Approval Required | true |
| Scope | `https://www.googleapis.com/auth/calendar.readonly` |
| Cache Path | `.local-agent-global/visibility/google-calendar/` |
| Health Status | unknown |

**To activate:** Uses same OAuth as Gmail

### 3. Google Drive — ⚠️ NOT CONFIGURED

| Field | Value |
|-------|-------|
| Type | api |
| Auth Status | not_configured |
| Setup Required | Same as Gmail (shares OAuth credentials) |
| Setup Hint | Same OAuth as Gmail + add Drive scope: `https://www.googleapis.com/auth/drive.readonly` |
| Read Capability | files, folders, docs, sheets |
| Write Capability | files, docs |
| Approval Required | true |
| Scope | `https://www.googleapis.com/auth/drive.readonly` |
| Cache Path | `.local-agent-global/visibility/google-drive/` |
| Health Status | unknown |

**To activate:** Uses same OAuth as Gmail

### 4. Asana — ⚠️ NOT CONFIGURED

| Field | Value |
|-------|-------|
| Type | api |
| Auth Status | not_configured |
| Setup Required | ASANA_TOKEN in .env |
| Setup Hint | Get from app.asana.com/0/my-apps |
| Read Capability | tasks, projects, teams, goals |
| Write Capability | tasks, projects |
| Approval Required | true |
| Cache Path | `.local-agent-global/visibility/asana/` |
| Health Status | unknown |

**To activate:** Set `ASANA_TOKEN=your_token` in `server/.env`

### 5. Dashboard (bakudanramen.com) — ✅ OPERATIONAL

| Field | Value |
|-------|-------|
| Type | local |
| Auth Status | connected |
| Base URL | http://dashboard.bakudanramen.com |
| Local Path | E:/Project/Master/dashboard.bakudanramen.com |
| Read Capability | tasks, users, reports, inventory, timesheets |
| Write Capability | tasks, content |
| Approval Required | true |
| Cache Path | `.local-agent-global/visibility/dashboard/` |
| Health Status | unknown |

**Note:** Health status is unknown because it's a local scan, not an API health check. Actual sync should set health to healthy.

---

## Registry API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/visibility/connectors` | Get summary of all connectors |
| GET | `/api/visibility/connectors/health` | Get per-connector health status |
| POST | `/api/visibility/sync` | Sync all connectors |
| POST | `/api/visibility/sync/:connectorId` | Sync specific connector |

---

## Registry Management

The registry auto-initializes on first boot:
```
if (!fs.existsSync(REGISTRY_PATH)) {
  saveRegistry(DEFAULT_CONNECTORS);
}
```

Connectors can be updated dynamically via `connectorRegistry.update(id, patch)`.

On every sync, `connectorRegistry.markSynced(id, health)` updates:
- `last_sync` → timestamp
- `health_status` → healthy/degraded/offline

---

## Cache Structure

Each connector writes 4 files to its cache path:

```
.local-agent-global/visibility/
├── connector-registry.json     ← Registry data
├── gmail/
│   ├── data.json              ← Full connector data
│   ├── summary.json           ← Quick summary
│   ├── last_sync.json        ← Last sync timestamp
│   └── errors.json            ← Any errors encountered
├── google-calendar/
│   └── (same 4 files)
├── google-drive/
│   └── (same 4 files)
├── asana/
│   └── (same 4 files)
├── dashboard/
│   └── (same 4 files)
└── sync_log.json              ← Global sync log
```

---

## How to Add a New Connector

1. Add to `DEFAULT_CONNECTORS` array in `connector-registry.ts`
2. Create connector module in `visibility/connectors/`
3. Add sync function + getCached* + get*Summary* exports
4. Add to `syncAll()` in `visibility-hub.ts`
5. Add to `syncPlatform(connectorId)` switch
6. Connector auto-appears in registry and UI

---

## Setup Checklist

| Connector | Setup Action | Status |
|-----------|-------------|--------|
| Gmail | GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env | ❌ |
| Calendar | Same as Gmail | ❌ |
| Drive | Same as Gmail | ❌ |
| Asana | ASANA_TOKEN in .env | ❌ |
| Dashboard | Already connected | ✅ |

---

## Security Notes

- No credentials stored in code
- OAuth tokens stored in `google-tokens.json` (in .local-agent-global, git-ignored)
- ASANA_TOKEN via environment variable
- All Google scopes are read-only
- IP guard blocks non-LAN/Tailscale access
- Audit log tracks all sync events

---

## Verdict

# ✅ CONNECTOR_REGISTRY_READY

All 11 connectors registered. Priority 5 connectors tracked.
- 5 operational (local/connected)
- 6 pending setup (Google x3 + Asana + health + website)
- Registry auto-initializes on boot
- Cache structure follows spec
- Auth status clearly reported