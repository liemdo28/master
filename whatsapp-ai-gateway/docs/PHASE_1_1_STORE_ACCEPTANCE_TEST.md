# Phase 1.1 — Store Acceptance Test

**Project:** WhatsApp AI Gateway — Human-Friendly Operations Assistant
**Date:** 2026-06-04
**Status:** PENDING — Awaiting real store pilot

---

## Objective

Verify that each of the 3 stores can independently complete a daily entry workflow
without training, manual, or manager assistance.

Minimum: 3 complete submissions per store (PASS + FAIL cases).

---

## Test Plan

### Stores Under Test

| Store       | WhatsApp Group Name       | Group Chat ID    | Locked |
|-------------|---------------------------|------------------|--------|
| Stone Oak   | Bakudan Stone Oak Team    | [pending]        | [ ]    |
| Bandera     | Bakudan Bandera Team      | [pending]        | [ ]    |
| Rim         | Bakudan Rim Team           | [pending]        | [ ]    |

---

## Test Case A — Valid Submission (PASS)

**Goal:** Verify clean end-to-end flow with no errors.

### Steps

1. Join store WhatsApp group
2. Type `/ldagent`
3. Bot responds with menu in detected language
4. Select "1. Daily Entry Log"
5. Bot shows first item one at a time
6. Enter a valid value for each item (e.g. 38)
7. Bot asks next item
8. After last item → summary shown with ✅ PASS
9. Type `CONFIRM`
10. Verify: Google Sheet row written with PASS status

**Expected:**
- Bot guides each step, no large form shown
- Language detected automatically
- CONFIRM → sheet write succeeds
- User sees: "✅ Daily Entry Logged. 📊 Recorded to Google Sheet."

### Data to Collect

- Staff tester name
- Staff language (EN / ES / VI)
- Store
- Group chat ID
- Submission timestamp
- Google Sheet row reference/link
- Sheet write status

---

## Test Case B — Out-of-Range Warning (FAIL)

**Goal:** Verify error prevention layer and manager alert.

### Steps

1. Start `/ldagent` → "Daily Entry Log"
2. Enter out-of-range value when prompted (e.g. `50` for Walk-in Cooler, target 33-41)
3. Bot shows: "⚠️ Value outside expected range. Walk-in Cooler: 50 Target: 33–41. Confirm? 1. Correct / 2. Re-enter"
4. Type `1` to confirm the value is correct
5. Complete remaining items
6. Type `CONFIRM`
7. Verify manager alert sent to Bakudan Management Team
8. Verify Google Sheet row written with FAIL/WARNING status

**Expected:**
- Out-of-range triggers "1. Correct / 2. Re-enter" immediately
- Manager alert includes: store, staff, time, item, range, actual value
- Sheet row shows FAIL status

### Data to Collect

- Staff tester name
- Staff language (EN / ES / VI)
- Store
- Out-of-range item and value
- Manager alert message received
- Manager alert screenshot
- Google Sheet row with FAIL status

---

## Test Case C — Edit Before Confirm

**Goal:** Verify edit history is saved in audit trail.

### Steps

1. Start `/ldagent` → "Daily Entry Log"
2. Enter values for first 2 items
3. Type `EDIT 1 0` (change first item)
4. Bot shows updated summary
5. Type `CONFIRM`
6. Verify audit trail shows original value, edit, and final value

**Expected:**
- EDIT changes reflected in summary
- Audit log shows: original_inputs_json, edits_json, final_payload_json

---

## Acceptance Criteria

| Store     | PASS Case | FAIL Case | Edit Case | Manager Alert | Sheet Written |
|-----------|-----------|------------|-----------|----------------|----------------|
| Stone Oak | [ ]       | [ ]        | [ ]       | [ ]            | [ ]            |
| Bandera   | [ ]       | [ ]        | [ ]       | [ ]            | [ ]            |
| Rim       | [ ]       | [ ]        | [ ]       | [ ]            | [ ]            |

**Minimum:** 3 complete PASS + 3 complete FAIL = 6 rows per store = 18 total rows across all stores.

---

## Results Summary

### Stone Oak

| Test | Staff | Language | Result | Notes |
|------|-------|----------|--------|-------|
| A    |       |          | [ ]    |      |
| B    |       |          | [ ]    |      |
| C    |       |          | [ ]    |      |

### Bandera

| Test | Staff | Language | Result | Notes |
|------|-------|----------|--------|-------|
| A    |       |          | [ ]    |      |
| B    |       |          | [ ]    |      |
| C    |       |          | [ ]    |      |

### Rim

| Test | Staff | Language | Result | Notes |
|------|-------|----------|--------|-------|
| A    |       |          | [ ]    |      |
| B    |       |          | [ ]    |      |
| C    |       |          | [ ]    |      |

---

## Sign-off

| Role   | Name | Date | Signature |
|--------|------|------|-----------|
| CEO    |      |      |           |
| Store  |      |      |           |
| Tech   |      |      |           |

---

*This test must pass before Phase 1.2 (Vision/OCR) begins.*