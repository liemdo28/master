# Sheet Queue Failure Test Report

**Phase:** E — Google Sheet Queue Failure Test
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Prove no data loss when Google Sheet is unavailable. Confirm queue system works correctly.

## Safe Test Method (Do NOT delete credentials)

Do NOT delete or revoke Google service account credentials permanently.

Instead, use the **Test Mode Queue Simulate** if available in the dashboard:
- Dashboard → Admin Control Center → Google Sheet Settings
- Look for: `Test Failure Simulation` toggle
- Enable it → all writes will queue (not send)
- Run workflow → verify queued
- Disable it → queue sends

Or use the **Runtime Config Override**:
- Set env var `SHEET_WRITE_ENABLED=false` temporarily
- Restart gateway (or use dashboard toggle if available)
- Run workflow → CONFIRM → verify queued
- Revert env var → retry queue

## Test Sequence

### 1. Block Sheet writes

Activate failure simulation or set override.

### 2. Run workflow

In `LD Agent-Log` group:
```
/ldagent
1
35 (all normal values)
/ldagent item, 44 confirmed
CONFIRM
```

### 3. Verify bot reply

Expected bot reply:
```
✅ Saved. Google Sheet write queued.
Log ID: <uuid>
Retry: automatic on next gateway cycle
```

NOT "Google Sheet write FAILED" — must say queued.

### 4. Verify queue count

Dashboard → Sheet Queue (or status area):
- Queue count increases by 1
- Status shows: `PENDING`

### 5. Restore sheet access

Disable failure simulation or revert override.

### 6. Retry queue

Dashboard → click `Retry Queue` button.

Expected:
- Queue item processes
- Google Sheet receives row
- Queue count returns to 0
- Status: `SENT`

### 7. Verify sheet row

Open Google Sheet → new row with correct values.

---

## Deliverable

This report at: `docs/SHEET_QUEUE_FAILURE_TEST_REPORT.md`

## Screenshots Required

- `screenshots/sheet-queue-pending.png` — dashboard showing queue count = 1, status = PENDING
- `screenshots/sheet-queue-retry-success.png` — after retry, count = 0, status = SENT

---

## Verification Checklist

| Step | Expected | ✓/✗ |
|---|---|---|
| Sheet blocked | Bot says "write queued" not "FAILED" | |
| Queue count | Increases by 1 after CONFIRM | |
| Queue status | PENDING shown in dashboard | |
| Retry | Queue processes successfully | |
| Sheet row | Row written with correct values | |
| Queue clears | Count returns to 0 | |
| No data loss | All values present in sheet row | |

---

## Failure Modes

- Bot says "FAILED" instead of "queued" → queue system not active — P0
- Queue count does not increase → queue not persisting — P0
- Retry fails permanently → check credentials, not just simulation — P0
- Duplicate row on retry → queue dedup logic broken — P0

Log all failures to `docs/PILOT_FIX_LOG.md`.

---

## Notes

- Queue survives gateway restart (SQLite persists)
- Duplicate CONFIRM does not create duplicate queue entries
- Manager alert still fires even when sheet is queued (MA-07 scenario)
- Sheet queue is the primary data loss prevention mechanism — must always work