# Manager Alert Real Warning Report

**Phase:** D — Manager Alert Real Warning Test
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Verify the full warning chain: store workflow → manager alert → Google Sheet row → audit trail.

## Pre-conditions

- Phase A: Test store mapping complete
- Phase B: Test store workflow PASS (out-of-range flow works)
- Phase C: Manager Alert group configured and test alert received

## Test Sequence

In WhatsApp group `LD Agent-Log`, send:
```
/ldagent
```

Choose: `1 — Daily Entry Log`

When bot asks **Walk-in Cooler** (target 30–40°F), enter:
```
44
```

Reply `1` to confirm actual reading.

Complete the rest of the workflow with normal values, then send:
```
CONFIRM
```

## Expected Outcomes (4 channels)

### 1. Store group receives warning

In `LD Agent-Log` group, after CONFIRM a warning message appears:
```
⚠️ FOOD SAFETY WARNING
Store: Test
Item: Walk-in Cooler
Reading: 44°F (FAIL_HIGH)
Target: 30°F–40°F
Time: <ISO>
```

### 2. Manager Alert group receives alert

In `Bakudan Manager Alerts` group:
```
🚨 MANAGER ALERT
Store: Test — Walk-in Cooler reading 44°F (FAIL_HIGH)
Confirmed by employee
Time: <ISO>
```

### 3. Google Sheet records warning

Open the configured Google Sheet:
- A new row appears in `WhatsApp_AI_Daily_Log` (or `Test` tab for this store)
- Status column shows `WARNING` or `FAIL`
- Walk-in Cooler value is `44`
- Warning-sent flag is `YES`

### 4. Audit trail records submission

In dashboard → **Audit Trail**:
- New entry: `daily_entry_confirm`
- Includes: employee, store, value, status
- Timestamp matches CONFIRM time

---

## Deliverable

This report at: `docs/MANAGER_ALERT_REAL_WARNING_REPORT.md`

## Screenshots Required

- `screenshots/store-warning-message.png` — store group warning
- `screenshots/manager-alert-real-warning.png` — manager group alert
- `screenshots/sheet-warning-row.png` — Google Sheet WARNING row

---

## Verification Checklist

| Channel | Expected | ✓/✗ |
|---|---|---|
| Store group warning | Food safety warning shown | |
| Manager group alert | Alert received in `Bakudan Manager Alerts` | |
| Google Sheet row | New WARNING row written | |
| Audit trail | Submission recorded with full details | |
| Debounce | Second identical alert within window NOT sent | |
| Wrong store | No alert sent to wrong-store group | |

---

## Failure Modes

- Manager alert not sent → check dashboard `Manager Alert Group` config + group active flag
- Sheet row missing → check queue dashboard
- Audit trail missing → check `audit_log` table writes
- Wrong store alert → check store mapping is locked

Log all failures to `docs/PILOT_FIX_LOG.md`.