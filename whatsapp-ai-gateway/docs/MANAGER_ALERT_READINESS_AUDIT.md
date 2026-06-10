# Manager Alert Readiness Audit

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 6 — verify manager-alert code paths, configuration surface, and Day-0 readiness.

## Rule

This report does not require a live WhatsApp group to PASS. The live test alert
is marked `pending` until Dev #1 confirms `localhost:3210` runtime stability
and the operator pastes a real chat_id. Code, API, and configuration surfaces
are fully verified.

## Code surface (verified)

- `src/alerts/manager-alert-service.js` — DB-first + .env-fallback config,
  debounce, dedupe, `manager_alerts` table persistence, SENT / QUEUED /
  DISABLED / NO_MANAGER_CHAT / DUPLICATE_SKIPPED statuses.
- `src/api/server.js` — endpoints:
  - `GET  /api/admin/manager-alert-group`
  - `POST /api/admin/manager-alert-group`
  - `POST /api/admin/manager-alert-group/test`  ← live test alert
  - `POST /api/admin/manager-alert-group/disable`
  - `GET  /api/manager-alerts`
- `src/workflows/guided/temperature-workflow.js` — `handleConfirmedDailyEntry`
  pipeline feeds `managerAlertService` after `CONFIRM`.
- `src/dashboard/admin-ui.js` — Manager Alerts panel with Enabled checkbox,
  chat_id input, Save, Test Alert, Disable buttons.

## Configuration paths

- `.env` → `MANAGER_ALERT_GROUP_CHAT_ID`, `MANAGER_ALERTS_ENABLED`,
  `MANAGER_ALERT_LEVELS`, `MANAGER_ALERT_DEBOUNCE_MINUTES`.
- DB → `app_config` table (Admin Control Center write) overrides env on read
  via `getManagerChatIdAsync()` / `isEnabledAsync()`.

## Verifications (no runtime restart required)

| Check | Result | Evidence |
|---|---|---|
| Manager alert code exists | PASS | `src/alerts/manager-alert-service.js` (255 lines) |
| Manager alert group can be saved from DB config | PASS | `POST /api/admin/manager-alert-group` writes `app_config`; read path is `getManagerChatIdAsync()` |
| Test alert endpoint exists | PASS | `POST /api/admin/manager-alert-group/test` calls `replyService.send()` with a confirmation message |
| Out-of-range workflow triggers manager alert | PASS | `handleConfirmedDailyEntry` → `buildIssues(validationResult)` → `managerAlertMessage()` → `replyService.send()` only when `issues.length > 0` |
| Group not configured → NEEDS_ACTION | PASS | `setup-status` endpoint emits `{ id: 'manager_alert_group', status: mag.chat_id && mag.enabled ? 'PASS' : 'NEEDS_ACTION', note: mag.chat_id || 'not set' }` |
| Debounce / dedupe | PASS | `isDuplicate()` window = `MANAGER_ALERT_DEBOUNCE_MINUTES` (default 5 min) |
| Storage | PASS | `manager_alerts` table with `dedupe_key` index; persists SENT/QUEUED/FAILED rows |

## Live test status (pending Dev #1 runtime + operator)

| Item | Status |
|---|---|
| Operator pastes real `chat_id` in Admin Control Center | pending (operator action) |
| Dashboard Test Alert button → message arrives | pending (Dev #1 runtime stable) |
| `/ldagent` CONFIRM with out-of-range → alert message arrives in target group | pending (Dev #1 + physical WhatsApp group) |

## Day-0 readiness conclusion

Operational code: **PASS**
Live end-to-end test: **pending** (Dev #1 runtime + physical group)
Pilot blocker status: **NEEDS_OPERATOR_ACTION** — open Admin Control Center,
paste the manager-alert WhatsApp group `chat_id`, click Save, then click
Test Alert. The dashboard will surface `PASS` on the setup-status row only
when both `chat_id` and `enabled=true` are present.

No runtime code, dashboard render, or `localhost:3210` work was modified.
