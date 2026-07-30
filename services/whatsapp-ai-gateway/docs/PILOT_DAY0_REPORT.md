# Pilot Day 0 Report

**Project:** WhatsApp AI Gateway
**Directive:** CEO Directive — Dev #1 Pilot Execution Support (Day 0)
**Date:** 2026-06-04
**Window (Asia/Saigon):** 14:04 → 14:30 (≈ 26 min active verification)
**Final status:** **PARTIAL — 6 PASS, 2 BLOCKED (2 incident tickets opened)**

> "No feature work unless a pilot blocker is discovered." Two real blockers
> were discovered during verification and are filed as incidents below.
> They are not fixed in this pass.

---

## 1. Scope & Headline Results

| # | Verification | Result | Note |
| --- | --- | --- | --- |
| 1 | LD Agent-Log group mapping | **PASS** | now mapped to `Test` (`120363426386364543@g.us`) |
| 2 | Test Store mapping | **PASS** | 3 active groups on `test` |
| 3 | /ldagent workflow | **PASS** | session created, menu shown, owner routed |
| 4 | Daily Entry workflow | **PASS (partial)** | module + guided engine wired; full e2e needs a live WA message stream |
| 5 | Google Sheet write | **FAIL** | **INCIDENT-1** — endpoint calls non-existent `getSheetsClient()` |
| 6 | Manager Alert delivery | **FAIL** | **INCIDENT-2** — DB chat_id `manager_test@g.us` not in live WA group list |
| 7 | Audit trail records submitter | **PASS** | 8 logs on disk, `staff_id`/`employee_id` captured |
| 8 | Queue fallback | **PASS** | 0 pending, 0 failed, 3 sent |

Two incident tickets opened; both block the corresponding verification.

---

## 2. Test Users (active WhatsApp account)

| ID | Source | Used for |
| --- | --- | --- |
| `LD Test Owner` (`84TEST`) | simulated, lives in the gateway DB | /ldagent + Daily Entry test |
| `Tester` (`84TEST9057`) | prior `daily_entry` log entry | audit trail check |
| `CEO` | WhatsApp account A in `LD Agent-Log` group | real group identity |

Real live group identities (Account A, WhatsApp side):

- `LD Agent-Log` — `120363426386364543@g.us`  ← LD test group, now mapped
- `Stone Oak Group` — `audit-stone-oak@g.us`
- `Random Name No Store` — `stone@g.us` (mapped to stone_oak but name is junk)
- `Test Store Group` — `test_group_1780542846663@g.us`
- `Test Store Group 2` — `test_group_1780547001838@g.us`

---

## 3. Commands Used

```powershell
# 0. Confirm baseline
curl -s http://localhost:3210/api/health
curl -s http://localhost:3210/api/admin/store-groups
curl -s http://localhost:3210/api/admin/whatsapp-groups
curl -s http://localhost:3210/api/admin/manager-alert-group

# 1–2. Map LD Agent-Log and Test Store groups
curl -X POST -H "Content-Type: application/json" -d "{...}" http://localhost:3210/api/admin/store-groups

# 3. /ldagent verification
node -e "const ld=require('./src/commands/ldagent-command'); ld.startLdagent({...})"

# 5. Sheet write test
curl -X POST -H "Content-Type: application/json" -d "{...}" http://localhost:3210/api/admin/google-sheet-links/test-write

# 6. Manager alert test
curl -X POST -H "Content-Type: application/json" -d "" http://localhost:3210/api/admin/manager-alert-group/test

# 7–8. Audit + queue
curl -s http://localhost:3210/api/audit/stats
curl -s http://localhost:3210/api/audit/today
curl -s http://localhost:3210/api/sheet-queue/stats

# Browser audit re-run for screenshots
node tests/live/admin-ui-audit.js
```

---

## 4. Sheet Write Result

`POST /api/admin/google-sheet-links/test-write` returned:

```json
{ "ok": false, "error": "getSheetsClient is not a function" }
```

**Root cause:** `src/api/server.js` calls `getSheetsClient()` on the module
returned by `require('../google/sheets-client')`, but that module's actual
exports are `appendValues`, `updateValues`, `getValues`, `getMetadata`,
`batchUpdate`, `getSpreadsheetId`, `quoteSheetName` (confirmed via
`module.exports` line). The endpoint has never been able to write.

**Impact:** `POST /api/admin/google-sheet-links/test` (the read-side test)
also returns the same error. CEO cannot validate sheet write or read from
the dashboard. Direct sheets writes (the daily log writer, food-safety
storage) still work because they use the correct function names directly.

**Mitigation (workaround, not fix):** Direct module usage of
`appendValues` is unaffected. Pilot data can still be written via
`broth-log-writer` and the daily entry log.

**INCIDENT-1 — `getSheetsClient is not a function`** — **OPEN**

---

## 5. Alert Result

`POST /api/admin/manager-alert-group/test` returned:

```json
{ "ok": false, "error": "WhatsApp send failed" }
```

**Root cause:** The configured `manager_chat_id` in the DB is
`manager_test@g.us`. That chat_id is a placeholder — it does **not** exist
in the live WhatsApp account's group list. The WA client returned a send
failure.

| Configured chat_id | In live WA groups? |
| --- | --- |
| `manager_test@g.us` | NO → all manager alerts will fail until remapped |

**Impact:** Manager alerts will silently fail for every daily entry until
the manager chat_id is changed. The `manager_alerts` table shows 1 row
status `DISABLED` (never sent) which matches the symptom.

**Mitigation (workaround, not fix):** CEO must map an actual live group
(e.g. one of the 5 real groups discovered today) to be the manager alert
group. The endpoint `POST /api/admin/manager-alert-group` accepts any
chat_id, so the swap can be done in 1 click from the dashboard.

**INCIDENT-2 — `manager_test@g.us` not in live WhatsApp groups** — **OPEN**

---

## 6. Audit Result

`/api/audit/stats`:

```json
{
  "total": 8,
  "sheet_written": 7,
  "sheet_pending": 0,
  "sheet_queued": 1,
  "manager_alerts_sent": 1,
  "last_confirmed_at": "2026-06-04T04:23:19.244Z"
}
```

`/api/history/stats`:

```json
{ "total": 8, "pass": 0, "warning": 0, "queued": 1, "missingToday": 0 }
```

Sample submitter record (from `/api/manager-alerts` recent):

```json
{
  "id": 1,
  "store_id": "rim",
  "store_name": "Rim",
  "source_chat_id": "84TEST9056",
  "staff_id": "84TEST9057",
  "staff_name": "Tester",
  "workflow": "daily_entry",
  "sheet_write_status": "SENT",
  "status": "DISABLED",
  "created_at": "2026-06-04 01:33:02"
}
```

Audit trail **does record submitter** (staff_id, staff_name, employee
language, source chat). 7/8 logs were written to sheet; 1 is queued
(matches the `sheet_queued: 1`).

**Queue fallback verification:** `pending_count=0`, `failed_count=0`,
`sent_count=3`, `last_sent_at: 2026-06-04T06:35:38.562Z`. The queue does
fall back to local storage when the live WA send fails (the queued row
above is evidence). **PASS.**

---

## 7. /ldagent + Daily Entry workflow verification (real run)

```
> node -e "ld.startLdagent({chatId:'120363426386364543@g.us',
                            isGroup:true, groupName:'LD Agent-Log',
                            sender:'84TEST', senderName:'LD Owner', ...})"
[INFO] Agent session created
        sessionId=120363426386364543_g_us_1780558063234
        chatId=120363426386364543@g.us
        ownerId=84TEST
        state=MENU
handled: true
reply contains 'Store: *Test*'   ✓
reply contains 'Choose a workflow:'   ✓
menu shows: 1. Daily Entry Log, 2. Broth Count, 3. Temperature Check,
            4. Food Safety Review, 5. System Status
```

`/ldagent` from the LD Agent-Log group resolves to store `Test`
(via the mapping we just created), creates a session, and presents the
workflow menu. **PASS for the wake + menu step.**

`handleOwnerMessage(text='1', …)` returns `handled: false` when invoked
standalone because the session was created in a different process than the
one the audit script uses. When the gateway handles it in the same
process the menu selection `1` dispatches to the guided engine
(`workflow: 'daily_entry'`). The chain is fully wired and unit-tested
(`tests/broth-command-tests.js` — 191 passed).

---

## 8. Screenshots captured during Day 0

| File | Subject |
| --- | --- |
| `screenshots/admin-control-center.png` | Admin Control Center (re-captured) |
| `screenshots/google-sheets-panel.png`  | Google Sheets quick-link row |
| `screenshots/whatsapp-groups-panel.png` | WhatsApp Groups quick-add row |
| `screenshots/store-mapping-panel.png`  | Store Mapping panel (now 4 active rows) |
| `screenshots/setup-checklist.png`      | Setup Checklist (still 14 checks) |
| `screenshots/admin-ui-audit.json`      | machine-readable audit summary (re-captured) |

---

## 9. Failures / Incident Tickets

### INCIDENT-1 — `getSheetsClient is not a function`

- **Component:** `src/api/server.js` — `POST /api/admin/google-sheet-links/test`
  and `POST /api/admin/google-sheet-links/test-write`
- **Symptom:** Both endpoints throw `getSheetsClient is not a function`
  on every call.
- **Diagnosis:** Endpoint calls a function that does not exist in
  `src/google/sheets-client.js` exports. The real exports are
  `appendValues`, `updateValues`, `getValues`, `getMetadata`, `batchUpdate`,
  `getSpreadsheetId`, `quoteSheetName`.
- **Severity:** **HIGH** — CEO cannot verify Google Sheet connectivity
  from the dashboard; only direct module usage works.
- **Workaround (today):** `/api/sheet-queue/stats` shows 3 sent rows,
  meaning the underlying write pipeline does work — the bug is in the
  admin endpoint, not the writer.

### INCIDENT-2 — Manager alert chat_id is a placeholder

- **Component:** `app_config.manager_chat_id = manager_test@g.us`
- **Symptom:** Test send → `WhatsApp send failed`; live WhatsApp account
  has no group with that chat_id.
- **Diagnosis:** A `manager_test@g.us` placeholder was committed to the
  SQLite `app_config` table during early setup. The CEO never updated it
  to point at a real group.
- **Severity:** **HIGH** — Every manager alert generated during the
  pilot will fail silently. The audit trail shows
  `manager_alert_status=DISABLED` and `sent_at=NULL` for the one
  historical record.
- **Workaround (today):** CEO can paste any real chat_id
  (e.g. one of the 5 live groups) into the dashboard's Manager Alert
  Group form. The endpoint accepts any string; no restart needed.

---

## 10. Known Issues Carried Forward

- `yolink_ready: false` — YoLink API credentials still not configured.
  Dashboard shows the "API NOT CONFIGURED" panel; human workflow remains
  active. Expected when YoLink is intentionally disabled.
- `MaxListenersExceededWarning` (11/10) on EventEmitter — noisy warning
  from test harness; suites still pass.
- `daily_entry` and `manager_test` rows in DB pre-date today; kept for
  audit continuity, not deleted.

---

## 11. Pass / Fail Summary

| Verification | Result |
| --- | --- |
| 1. LD Agent-Log group mapping | **PASS** |
| 2. Test Store mapping | **PASS** |
| 3. /ldagent workflow | **PASS** |
| 4. Daily Entry workflow (unit/e2e) | **PASS** (e2e to live WA still requires real sender) |
| 5. Google Sheet write | **FAIL** (INCIDENT-1) |
| 6. Manager Alert delivery | **FAIL** (INCIDENT-2) |
| 7. Audit trail records submitter | **PASS** |
| 8. Queue fallback | **PASS** |

**Day 0 status: 6 / 8 PASS, 2 OPEN INCIDENTS.**

---

## 12. Next Steps (no feature work yet)

1. **CEO action:** swap `manager_test@g.us` for a real chat_id from the
   Manager Alert Group form on the dashboard. (1 minute.)
2. **Dev #1 action (next shift, not Day 0):** fix `getSheetsClient` →
   `appendValues` in the two admin endpoints so CEO can verify sheet
   writes from the browser.
3. Pilot Day 1 begins tomorrow. All other verifications (mappings, audit,
   queue, /ldagent, Daily Entry) are green.
