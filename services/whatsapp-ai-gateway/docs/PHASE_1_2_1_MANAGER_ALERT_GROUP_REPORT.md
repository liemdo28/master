# Phase 1.2.1 — Manager Alert Group Report

**Date:** 2025-06-04
**Status:** ✅ COMPLETE (Code Verified)

---

## What This Is

The Manager Alert Group is a WhatsApp group chat that receives automated alerts when:
1. A daily entry fails min/max validation
2. A sensor (YoLink) reading is out of range for too long
3. Template OCR confirms with out-of-range values
4. All data sources are unavailable for a monitored item

---

## Architecture

```
Daily Entry / Template OCR / YoLink Poller
    ↓ Validation result (FAIL / FAIL_HIGH / FAIL_LOW)
manager-alert-service.js → handleConfirmedDailyEntry()
    ↓
isEnabled() + getManagerChatId() checks
    ↓
Dedupe check (isDuplicate) — within MANAGER_ALERT_DEBOUNCE_MINUTES
    ↓
replyService.send(client, MANAGER_ALERT_GROUP_CHAT_ID, text)
    ↓
manager_alerts table (SQLite) — persisted with status

Also: sensor-alert-service.js (Phase 1.2F)
    ↓ Sends alerts for YoLink threshold violations
```

---

## Alert Types

### 1. Daily Entry Fail Alert
**Source:** `handleConfirmedDailyEntry()` in `manager-alert-service.js`
**Trigger:** `/ldagent` workflow confirms with items outside min/max
**Message:** `🚨 MANAGER ALERT - OUT OF RANGE`
**Fields:** Store, Staff, Group, Workflow, Time, Issues list, Sheet write status, Session ID

### 2. Sensor Temperature Alert
**Source:** `sensor-alert-service.js` → `sendAlerts()`
**Trigger:** YoLink sensor reading > max or < min for `SENSOR_ALERT_AFTER_MINUTES` (default 5 min)
**Message:** `🚨 MANAGER SENSOR ALERT`
**Fields:** Store, Item, Sensor name, Reading, Target, Duration, Status
**Debounce:** Repeat alert only every `SENSOR_ALERT_REPEAT_MINUTES` (30 min)

### 3. OCR Fail Alert
**Source:** `template-ocr-workflow.js` → `sendManagerAlert()`
**Trigger:** Template OCR CONFIRM with `validation.failCount > 0`
**Message:** `OCR Daily Entry Warning`
**Fields:** Store, Submitted by, Source, Issues list, Image saved for audit

### 4. Missing Human Entry Alert
**Source:** `sensor-safety-rules.js` → `alertMissingHumanEntry()`
**Trigger:** No human entry received but sensor reading exists
**Message:** `⚠️ MISSING HUMAN ENTRY`
**Fields:** Store, Item, Sensor reading available

### 5. All Sources Unavailable Alert
**Source:** `sensor-safety-rules.js` → `alertAllSourcesUnavailable()`
**Trigger:** No human, no sensor, no photo available
**Message:** `🚨 ALL SOURCES UNAVAILABLE`
**Fields:** Store, Item, Immediate action required

---

## Configuration

```env
MANAGER_ALERTS_ENABLED=true
MANAGER_ALERT_GROUP_CHAT_ID=
MANAGER_ALERT_LEVELS=FAIL,DANGER
MANAGER_ALERT_DEBOUNCE_MINUTES=5
```

| Variable | Default | Purpose |
|---|---|---|
| `MANAGER_ALERTS_ENABLED` | `true` | Master on/off for manager alerts |
| `MANAGER_ALERT_GROUP_CHAT_ID` | (empty) | WhatsApp group ID for alerts |
| `MANAGER_ALERT_LEVELS` | `FAIL,DANGER` | Alert levels that trigger notification |
| `MANAGER_ALERT_DEBOUNCE_MINUTES` | `5` | Dedupe window — no repeat alert within N minutes |

---

## Deduplication

All alerts use a dedupe key to prevent spam:

```js
// manager-alert-service.js
dedupeKey({ storeId, workflow, issues }) {
  return issues
    .map(i => `${storeId}:${workflow}:${i.item}:${i.status}`)
    .sort().join('|');
}

// sensor-alert-service.js
// Alert debounced if last alert sent < SENSOR_ALERT_REPEAT_MINUTES ago
```

---

## Persistence

All manager alerts are saved to `manager_alerts` table:

```sql
CREATE TABLE manager_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id TEXT,
  store_name TEXT,
  source_chat_id TEXT,
  source_group_name TEXT,
  manager_chat_id TEXT,
  staff_id TEXT,
  staff_name TEXT,
  workflow TEXT,
  issues_json TEXT,
  sheet_write_status TEXT,
  status TEXT,  -- SENT | DISABLED | NO_MANAGER_CHAT | DUPLICATE_SKIPPED | PENDING_CLIENT | FAILED
  sent_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  dedupe_key TEXT
)
```

Status values:
| Status | Meaning |
|---|---|
| `SENT` | Alert delivered to manager group |
| `DISABLED` | `MANAGER_ALERTS_ENABLED=false` — alert skipped |
| `NO_MANAGER_CHAT` | `MANAGER_ALERT_GROUP_CHAT_ID` not set — alert logged only |
| `DUPLICATE_SKIPPED` | Dedupe hit within debounce window |
| `PENDING_CLIENT` | Client not ready — not yet sent |
| `FAILED` | Send failed |

---

## Fallback Behavior

| Scenario | Behavior |
|---|---|
| `MANAGER_ALERTS_ENABLED=false` | Alert logged with status=DISABLED |
| `MANAGER_ALERT_GROUP_CHAT_ID` empty | Alert logged with status=NO_MANAGER_CHAT |
| Client not available (pre-init) | Status=PENDING_CLIENT, retried later |
| Deduped | Alert logged with status=DUPLICATE_SKIPPED |
| Send failed | Status=FAILED, no crash |

---

## API Endpoint

```http
GET /api/manager/alerts
GET /api/manager/alerts/stats
```

Returns recent alerts and stats from `manager_alerts` table.

---

## Safety Rules Integration

`sensor-safety-rules.js` calls `alertMissingHumanEntry()` and `alertAllSourcesUnavailable()` directly when fallback conditions are met — ensuring the manager always knows when:
1. A sensor is working but no human entry arrived
2. All three sources (human + sensor + photo) are unavailable

---

## No-Crash Guarantee

All alert operations are wrapped in try/catch with fallback. WhatsApp send failure does not crash the workflow. Alert status is always persisted to SQLite for audit trail.