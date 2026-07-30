# VISIBILITY_CACHE_VALIDATION
**Generated:** 2026-06-09

## Cache Read Tests

| Cache File | Expected Path | Status | Fallback |
|---|---|---|---|
| `inbox_cache.json` | `.local-agent-global/visibility/gmail/` | ❌ absent | Returns `CONNECTOR_NOT_CONFIGURED` |
| `events_cache.json` | `.local-agent-global/visibility/google-calendar/` | ❌ absent | Returns `CONNECTOR_NOT_CONFIGURED` |
| `files_cache.json` | `.local-agent-global/visibility/google-drive/` | ❌ absent | Returns `CONNECTOR_NOT_CONFIGURED` |
| `tasks_cache.json` | `.local-agent-global/visibility/asana/` | ❌ absent | Returns `CONNECTOR_NOT_CONFIGURED` |
| `snapshot.json` | `.local-agent-global/visibility/dashboard/` | ✅ (live fallback) | HTTP ping to dashboard |
| `platform_health.json` | `.local-agent-global/visibility/` | ✅ created by server | Age tracked in output |
| `projects.json` | `master-projects.json` | ✅ exists | Local filesystem |

## Connector Behavior When Cache Absent

Each connector follows this flow:
```
1. Check auth token / env var
   → Missing: return { status: 'CONNECTOR_NOT_CONFIGURED', setup_instructions: [...] }
2. Check cache file
   → Missing: return { status: 'CONNECTOR_NOT_CONFIGURED', last_sync: null }
3. Parse cache
   → Invalid JSON: return { status: 'cache_error', error: <message> }
4. Return data with cache_age_minutes
```

## LocalFileVisibilityConnector Cache
- No cache — reads filesystem directly
- Root: `E:/Project/Master` (walks up to depth 4)
- Blocked dirs: `node_modules`, `.git`, `dist`, `build`, `.ssh`, `remote-access`
- Word-overlap scoring on filename

## Platform Health Cache
- Written by `getPlatformHealthText()` in visibility-hub
- Contains last known status of: Mi Core server, Dashboard, project counts
- Auto-refreshed on every `getDailySnapshot()` call

## Validation: ConnectorNotConfigured Responses Are Correct

Test: `GmailVisibilityConnector.getSummaryText()` when no token:
```
Expected: "📧 Gmail: CONNECTOR_NOT_CONFIGURED..."
Actual:   Returns object with status='CONNECTOR_NOT_CONFIGURED' + setup steps
✅ PASS — never returns empty or faked data
```

Test: `AsanaVisibilityConnector.getMyTasks()` when no ASANA_TOKEN:
```
Expected: CONNECTOR_NOT_CONFIGURED + instructions
Actual:   Correct
✅ PASS
```

---
VISIBILITY_CACHE_VALIDATION_COMPLETE
