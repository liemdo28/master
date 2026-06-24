# Connector Coverage Audit
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D3
**Result:** CONNECTOR_TRUTH_READY

---

## Connector Inventory

Source: `server/src/visibility/connector-registry.ts`

### Google Connectors

| Connector | ID | Status | Auth | Last Sync | Health |
|-----------|-----|--------|------|-----------|--------|
| Gmail | `gmail` | pending | not_configured | Never | unknown |
| Google Calendar | `google-calendar` | pending | not_configured | Never | unknown |
| Google Drive | `google-drive` | pending | not_configured | Never | unknown |
| Google Sheets | `google-sheets` | pending | not_configured | Never | unknown |

**Setup required:** `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` in `.env`
All 4 Google connectors share the same OAuth — configure once, get all 4.

**Fallback behavior:** All Google queries return `check_status` → status pipeline
shows "connector not_configured — set GOOGLE_CLIENT_ID in .env"

---

### Business Connectors

| Connector | ID | Status | Auth | Last Sync | Health |
|-----------|-----|--------|------|-----------|--------|
| Dashboard | `dashboard-bakudan` | active | connected | Never | unknown |
| Review Automation | (via dashboard) | active | connected | Never | unknown |
| QuickBooks Runtime | `quickbooks-runtime` | active | connected | Never | unknown |
| Accounting Engine | `accounting` | active | connected | Never | unknown |

**Dashboard:** Local connector — files at `E:/Project/Master/Bakudan/dashboard.bakudanramen.com`
**QuickBooks:** Local DB at `E:/Project/Master/mi-core/data/qb-agent.db` — populated when QB Web Connector syncs
**Accounting Engine:** Port 8844 local — starts when `node accounting-engine/api/server.js` runs

**Fallback behavior:**
- Dashboard: reads local files, never calls cloud
- QuickBooks: reads `qb-agent.db` — if no sync, Finance Truth Layer returns explicit "unavailable"
- Accounting Engine: if port 8844 offline, Finance Truth Layer skips to next source

---

### Health Connectors

| Connector | ID | Status | Auth | Last Sync | Health |
|-----------|-----|--------|------|-----------|--------|
| Huawei Health Export | `health-export` | pending | not_configured | Never | unknown |
| OpenHuman | (not registered) | — | — | — | — |

**Setup required:** Export from Huawei Health app → place in `.local-agent-global/visibility/health/export/`

**Fallback behavior:** Health queries return "export file not found — export from Huawei Health app"

---

### Marketing / Website Connectors

| Connector | ID | Status | Auth | Last Sync | Health |
|-----------|-----|--------|------|-----------|--------|
| rawsushibar.com | `website-raw` | active | connected | Never | unknown |
| bakudanramen.com | `website-bakudan` | active | connected | Never | unknown |

**Both are local file connectors** — read from `E:/Project/Master/RawSushi` and `E:/Project/Master/Bakudan`
**Fallback:** Files readable as long as local paths exist. No auth required.

---

### Other Connectors

| Connector | ID | Status | Auth | Notes |
|-----------|-----|--------|------|-------|
| Asana | `asana` | pending | not_configured | Set ASANA_TOKEN |
| Food Safety | `food-safety` | active | connected | Local files |
| Master Workspace | `local-projects` | active | connected | Always available |

---

## Connector Health Summary

| Category | Total | Active | Pending | Not Configured |
|----------|-------|--------|---------|---------------|
| Google | 4 | 0 | 4 | 4 |
| Business | 4 | 4 | 0 | 0 |
| Health | 1 | 0 | 1 | 1 |
| Marketing | 2 | 2 | 0 | 0 |
| Other | 3 | 2 | 1 | 1 |
| **TOTAL** | **14** | **8** | **6** | **6** |

**8 connectors active, 6 pending setup.**

---

## Silent Failure Policy

**No connector may silently fail.** The Finance Truth Layer and intent-router
are designed to make data absence explicit:

1. `query_finance` → Finance Truth Layer → checks each source → explicit "unavailable"
2. `check_status` → status pipeline → reads connector registry → reports `auth_status`
3. `send_message` → always requires approval (risk_level: 2) → never silently sends
4. Unknown queries → `buildUnknownIntentReply()` → hints about missing connector

---

## Certification

- ALL_CONNECTORS_INVENTORIED: ✅
- GOOGLE_CONNECTORS_DOCUMENTED: ✅
- BUSINESS_CONNECTORS_DOCUMENTED: ✅
- HEALTH_CONNECTORS_DOCUMENTED: ✅
- MARKETING_CONNECTORS_DOCUMENTED: ✅
- NO_SILENT_FAILURE: ✅
- FALLBACK_BEHAVIOR_DEFINED: ✅
- **CONNECTOR_TRUTH_READY: ✅**
