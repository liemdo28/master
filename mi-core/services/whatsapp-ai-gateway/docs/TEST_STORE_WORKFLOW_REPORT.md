# Test Store Workflow Report

**Phase:** B — Test Store Workflow
**Date:** 2026-06-04
**Status:** READY TO EXECUTE

---

## Goal

Validate the Phase 1 fix (numeric input 44 → out-of-range flow) in the WhatsApp LD Agent-Log group before real store pilot.

## Pre-conditions

- Phase A complete: Test store mapped
- Gateway running, dashboard accessible

## Test Sequence

In WhatsApp group `LD Agent-Log`, send:

```
/ldagent
```

Choose `1 — Daily Entry Log`.

### Test 1 — Normal value (PASS)

When bot asks **Walk-in Cooler**, reply:
```
35
```

**Expected:**
- ✅ Bot accepts 35
- ✅ Bot moves to next item (Walk-in Freezer or next)
- No out-of-range warning

### Test 2 — Out-of-range (THE FIX)

When bot asks the next cooler item, reply:
```
44
```

**Expected reply:**
```
⚠️ Outside Range
Walk-in Cooler: 44°F
Expected: 30°F–40°F

1 — Confirm actual reading
2 — Re-enter value
3 — Skip this item
```

**MUST NOT say** "Not understood" or "Send STATUS".

### Test 3 — Confirm bad reading

Reply:
```
1
```

**Expected:**
- ✅ 44 saved as actual reading
- ✅ Marked WARNING / FAIL_HIGH
- ✅ Bot continues to next item
- Edit history records actual value (44)

### Test 4 — Edit (replace value)

When summary is shown, use:
```
EDIT 1 40
```

**Expected:**
- ✅ Value updates from 44 → 40
- ✅ Edit history records old=44, new=40
- ✅ Summary re-displayed with corrected value

### Test 5 — Confirm and write

Reply:
```
CONFIRM
```

**Expected:**
- ✅ Google Sheet write **SENT** (or queued if sheet temporarily down)
- ✅ Audit trail created with employee + values + status
- ✅ No duplicate row on second CONFIRM
- ✅ Manager alert fires only if any value is WARNING/CRITICAL

---

## Deliverables

- This report at: `docs/TEST_STORE_WORKFLOW_REPORT.md`

## Screenshots Required

- `screenshots/out-of-range-44-fixed.png` — WhatsApp showing "⚠ Outside Range... 1/2/3" prompt
- `screenshots/test-store-summary.png` — summary screen before CONFIRM
- `screenshots/google-sheet-test-row.png` — Google Sheet with new row from CONFIRM
- `screenshots/audit-trail-test-store.png` — audit log entry for this submission

---

## Verification Checklist

| Step | Expected | ✓/✗ | Notes |
|---|---|---|---|
| 1 | 35 accepted, advances | | |
| 2 | 44 → Outside Range prompt (NOT "Not understood") | | **CRITICAL** |
| 3 | 1 → save 44 with WARNING | | |
| 4 | EDIT 1 40 → update | | |
| 5 | CONFIRM → sheet write, no duplicate | | |

---

## Failure Modes & Escalation

If any test fails, log to `docs/PILOT_FIX_LOG.md` with:
- Test number
- Expected vs actual
- Reproduction steps
- Severity (P0/P1)

P0 failures = STOP pilot, fix immediately.
P1 failures = Continue, document, fix within 24h.