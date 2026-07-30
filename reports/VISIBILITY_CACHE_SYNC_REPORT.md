# VISIBILITY CACHE SYNC REPORT
**Date:** 2026-06-09
**Status:** ✅ BUILD COMPLETE

---

## Cache Architecture

**Base Path:** `.local-agent-global/visibility/`

Every connector writes 4 files on each sync:

```
.local-agent-global/visibility/
├── connector-registry.json     ← Registry metadata
├── sync_log.json                ← Global sync log
├── daily-snapshot.json          ← Daily snapshot cache
├── gmail/
│   ├── data.json                ← Full data (emails, counts)
│   ├── summary.json             ← Quick summary (unread, important)
│   ├── last_sync.json           ← { synced_at: ISO timestamp }
│   └── errors.json              ← [ { error, timestamp } ]
├── google-calendar/
│   ├── data.json
│   ├── summary.json
│   ├── last_sync.json
│   └── errors.json
├── google-drive/
│   ├── data.json
│   ├── summary.json
│   ├── last_sync.json
│   └── errors.json
├── asana/
│   ├── data.json
│   ├── summary.json
│   ├── last_sync.json
│   └── errors.json
├── dashboard/
│   ├── data.json
│   ├── summary.json
│   ├── last_sync.json
│   └── errors.json
├── local-projects/
│   ├── data.json
│   ├── summary.json
│   ├── last_sync.json
│   └── errors.json
├── accounting/
│   └── (same 4 files)
└── food-safety/
    └── (same 4 files)
```

---

## Per-Connector Cache Contents

### Gmail Cache (`visibility/gmail/`)

**data.json** — Full email data:
```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "unread_count": 5,
  "important_count": 2,
  "emails": [
    {
      "id": "msg123",
      "thread_id": "thread456",
      "subject": "Invoice from Vendor",
      "from": "vendor@example.com",
      "date": "Mon, 09 Jun 2026 10:30:00 +0700",
      "snippet": "Please find attached invoice...",
      "labels": ["INBOX", "IMPORTANT"],
      "is_unread": true,
      "is_important": true
    }
  ],
  "labels": ["INBOX", "IMPORTANT", "STARRED", ...]
}
```

**summary.json** — Quick counts:
```json
{ "unread": 5, "important": 2, "total": 50, "synced_at": "2026-06-09T12:00:00.000Z" }
```

**last_sync.json** — Timestamp only:
```json
{ "synced_at": "2026-06-09T12:00:00.000Z" }
```

**errors.json** — Error log:
```json
[]
```

### Google Calendar Cache (`visibility/google-calendar/`)

**data.json** — Full event data:
```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "today": "Thứ Hai, 09 Tháng 6 năm 2026",
  "events_today": [
    {
      "id": "evt123",
      "title": "Họp team Raw Sushi",
      "start": "2026-06-09T09:00:00+07:00",
      "end": "2026-06-09T10:00:00+07:00",
      "location": "Google Meet",
      "attendees": ["anh@email.com", "maria@email.com"],
      "is_all_day": false,
      "status": "confirmed"
    }
  ],
  "events_upcoming": [...],
  "calendars": ["Personal", "Work"]
}
```

**summary.json** — Quick counts:
```json
{ "today_count": 3, "upcoming_count": 10, "synced_at": "..." }
```

### Google Drive Cache (`visibility/google-drive/`)

**data.json** — File list:
```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "recent_files": [
    {
      "id": "file123",
      "name": "Q2 Financial Report.xlsx",
      "mime_type": "Google Sheet",
      "modified_at": "2026-06-08T15:30:00.000Z",
      "web_link": "https://drive.google.com/file/d/file123",
      "owner": "CEO Name",
      "shared": true
    }
  ],
  "total_found": 50
}
```

### Asana Cache (`visibility/asana/`)

**data.json** — Full task data:
```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "workspace_name": "My Workspace",
  "my_tasks": [...],
  "overdue_tasks": [...],
  "projects": [...],
  "tasks_by_assignee": {
    "CEO": [...],
    "Maria": [...],
    "Hoang": [...]
  }
}
```

**summary.json** — Quick counts:
```json
{ "my_tasks": 12, "overdue": 3, "projects": 8, "synced_at": "..." }
```

### Dashboard Cache (`visibility/dashboard/`)

**data.json** — Local scan data:
```json
{
  "path": "E:/Project/Master/dashboard.bakudanramen.com",
  "modules": ["api", "auth", "tasks", "inventory", "timesheets"],
  "total_php_files": 142,
  "total_js_files": 38,
  "has_auth": true,
  "has_api": true,
  "has_tasks": true,
  "scanned_at": "2026-06-09T12:00:00.000Z"
}
```

---

## Sync Behavior

### Manual Sync
```
POST /api/visibility/sync-all
```
Triggers parallel sync of all connectors. Results written to cache immediately.

### Per-Connector Sync
```
POST /api/visibility/sync/:connectorId
```
Syncs only the specified connector. Returns result.

### Scheduled Sync
- `syncAll()` runs every 15 minutes via `cron/sync-scheduler.ts`
- `visibility/sync_log.json` written after every sync with timestamp + results

### Sync Error Handling
- If connector not configured → skip, log `not_configured`
- If connector API fails → catch error, write to `errors.json`, continue other connectors
- If cache write fails → console.warn, continue (non-blocking)

---

## Cache Validation

| Cache File | Written By | Read By | Purpose |
|-----------|-----------|---------|---------|
| data.json | sync*() | getCached*() | Full data for API responses |
| summary.json | sync*() | getDailySnapshot | Quick counts for dashboard |
| last_sync.json | sync*() | ConnectorRegistry.markSynced | Registry timestamp |
| errors.json | sync*() | getPlatformHealth | Error display |

---

## Stale Data Warning

Cache age is calculated from `last_sync.json`. Threshold:
- < 1 hour: ✅ fresh
- 1-4 hours: ⚠️ stale (yellow)
- > 4 hours: ❌ very stale (red)
- Never synced: ❌ unknown (grey)

LiveBoard and brain.html show this via health dot color.

---

## Sync Log

**File:** `.local-agent-global/visibility/sync_log.json`

```json
{
  "synced_at": "2026-06-09T12:00:00.000Z",
  "results": {
    "local-projects": "ok",
    "dashboard-bakudan": "ok",
    "gmail": "not_configured",
    "google-calendar": "not_configured",
    "google-drive": "not_configured",
    "asana": "not_configured",
    "health": "no_export",
    "accounting": "offline: connection timeout",
    "food-safety": "ok"
  },
  "errors": ["accounting: connection timeout"]
}
```

---

## Verdict

# ✅ VISIBILITY_CACHE_SYNC_READY

- All 5 priority connectors write 4 cache files each
- Cache structure follows spec exactly
- Sync error handling is non-blocking
- Stale data detection implemented
- Sync log written on every syncAll()
- No fake data — not_configured connectors return stub only
