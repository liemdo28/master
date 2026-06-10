# UNIVERSAL_VISIBILITY_LAYER_REPORT
**Generated:** 2026-06-09 | **Phase:** Daily Work Automation Phase 1

## Status: ✅ UNIVERSAL_VISIBILITY_LAYER_READY

## Connectors Built

### New JS Connectors (`local-agent/universal-visibility/`)

| Connector | File | Status | Data Source |
|---|---|---|---|
| Gmail | `GmailVisibilityConnector.mjs` | ✅ Built | `.local-agent-global/visibility/gmail/inbox_cache.json` |
| Google Drive | `GoogleDriveVisibilityConnector.mjs` | ✅ Built | `google-drive/files_cache.json` |
| Google Calendar | `GoogleCalendarVisibilityConnector.mjs` | ✅ Built | `google-calendar/events_cache.json` |
| Asana | `AsanaVisibilityConnector.mjs` | ✅ Built | `asana/tasks_cache.json` |
| Dashboard | `DashboardVisibilityConnector.mjs` | ✅ Built | Live HTTP + `dashboard/snapshot.json` |
| Local Files | `LocalFileVisibilityConnector.mjs` | ✅ Built | Local filesystem walk |

### Auth Status
- Gmail/Calendar/Drive: `CONNECTOR_NOT_CONFIGURED` — token file absent → setup at `/api/auth/google/start`
- Asana: `CONNECTOR_NOT_CONFIGURED` — `ASANA_TOKEN` not set → add to `.env`
- Dashboard: `connected` — live HTTP check passes
- Local Files: `connected` — always available

### Cache Structure
```
.local-agent-global/visibility/
  gmail/inbox_cache.json          ← written by syncGmail()
  google-calendar/events_cache.json
  google-drive/files_cache.json
  asana/tasks_cache.json
  dashboard/snapshot.json
  projects/projects.json
  platform_health.json
```

### Key Design Rules
- **Never fake data**: If not configured → return `CONNECTOR_NOT_CONFIGURED` with exact setup steps
- **Always show source + last_sync** in every connector response
- **Read-only** in Phase 1 — no write actions in visibility connectors
- **Cache age tracking** — age_min calculated from file mtime

## Visibility Commands Supported

| Command | Handler | Status |
|---|---|---|
| "Hôm nay anh có gì cần làm?" | Daily snapshot pipeline | ✅ |
| "Email nào quan trọng?" | Gmail cache / AI fallback | ✅ |
| "Calendar hôm nay có gì?" | Calendar cache | ✅ |
| "Task nào overdue?" | Asana cache | ✅ |
| "File/report nằm đâu?" | LocalFileVisibilityConnector | ✅ |
| "Dashboard có task gì?" | DashboardVisibilityConnector | ✅ |
| "Project nào đang lỗi?" | Local projects registry | ✅ |
| "Maria còn task nào?" | Asana cache + people-memory | ✅ |

---
UNIVERSAL_VISIBILITY_LAYER_READY
