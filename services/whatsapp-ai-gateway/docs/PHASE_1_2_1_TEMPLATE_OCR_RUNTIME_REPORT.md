# Phase 1.2.1 — Template OCR Runtime Report

**Date:** 2025-06-04
**Status:** ✅ COMPLETE (Tests Passed)

---

## What This Is

Template OCR workflow: Employee prints a daily entry template PDF → takes photo of completed form → sends via WhatsApp → bot reads image via OCR → shows parsed values → employee confirms → data written to Google Sheet.

---

## Architecture

```
Printed Template PDF (daily-entry-template-v1.pdf)
    ↓ Employee fills by hand, takes photo
WhatsApp group (store group chat)
    ↓ Employee uploads image
template-ocr-workflow.js → processImage()
    ↓
template-image-router.js → looksLikeTemplate()
    ↓ Caption check ("daily-entry-v1") or visual detection
template-registry.js → getDefaultTemplate()
    ↓
image-preprocessor.js → preprocessTemplateImage()
    ↓ Aligns + crops each field region
ocr-engine.js → ocrCrops()
    ↓ Tesseract / OpenCV per crop
template-ocr-validator.js → validateOcrResults()
    ↓ Validates each value against Daily_Entry_Template min/max
template-ocr-storage.js → saveRun()
    ↓ Persists to SQLite
    ↓ Session created (WAITING_CONFIRM state)
Bot replies with summary + CONFIRM/EDIT/RETAKE/CANCEL
    ↓ Employee replies CONFIRM
template-ocr-sheet-writer.js → writeConfirmedOcr()
    ↓ Google Sheet write
```

---

## Key Components

| Module | Role |
|---|---|
| `template-generator.js` | Generates PDF from template cache (dynamic item list) |
| `template-registry.js` | Loads and provides template definitions |
| `template-image-router.js` | Detects template from caption or visual |
| `image-preprocessor.js` | Aligns + crops each item field region |
| `ocr-engine.js` | Parses text from crops, handles negatives/decimals |
| `template-ocr-validator.js` | Compares against min/max, sets PASS/FAIL/NEEDS_REVIEW |
| `template-ocr-storage.js` | Saves OCR run to SQLite, session management |
| `template-ocr-workflow.js` | Main orchestrator: image → OCR → reply → confirm |
| `template-ocr-sheet-writer.js` | Writes confirmed values to Google Sheet |

---

## Control Flow (Employee Replies)

| Reply | Action |
|---|---|
| `CONFIRM` | Write to Google Sheet, delete session |
| `EDIT 1 40` | Correct item #1 to 40°F, re-validate, show summary |
| `RETAKE` | Discard session, prompt retake |
| `CANCEL` | Discard session, no write |

---

## Validation Rules

- `value > template.max` → `FAIL_HIGH`
- `value < template.min` → `FAIL_LOW`
- `value == null` → `NEEDS_REVIEW`
- `confidence < 0.3` → `NEEDS_REVIEW`
- `unclearCount > floor(items.length / 2)` → prompt retake

---

## Test Results (14 tests, all pass)

```
[ 1. Template generator ]
OK PDF generated
OK Template JSON generated at required path
OK Template has dynamic item list
OK No OCR hardcoded item list needed

[ 2. Registry and router ]
OK Registry loads template
OK Detects template from Form ID text

[ 3. OCR parsing and validation ]
OK Numeric parser extracts negative decimal
OK PASS values pass
OK Out-of-range triggers FAIL
OK Missing values trigger NEEDS_REVIEW
OK Low confidence triggers NEEDS_REVIEW

[ 4. Workflow confirmation controls ]
OK Workflow handles template image
OK Summary shown before confirm
OK EDIT corrects OCR value
OK CONFIRM queues safely when Sheets unavailable
OK Second workflow handles template image
OK CANCEL prevents write

[ 5. Dependency check ]
OK Missing Tesseract/OpenCV does not crash dependency check

All Template OCR tests passed
```

---

## Google Sheet Integration

- `GOOGLE_SHEETS_ENABLED=false` → CONFIRM queues to `sheet_write_queue` (ID 6), writes retry via retry scheduler
- `GOOGLE_SHEETS_ENABLED=true` → CONFIRM writes immediately to configured spreadsheet
- Sheet tab: `WhatsApp_AI_Daily_Log` (or configured test tab)
- Store tabs: `Rim`, `Stone Oak`, `Bandera`
- `Needs_Review` tab receives entries with FAIL or NEEDS_REVIEW status

---

## Manager Alert Integration

When CONFIRM contains out-of-range values:
1. Store group receives warning message with issues list
2. Manager alert group (if `MANAGER_ALERT_GROUP_CHAT_ID` set) receives `🚨 MANAGER ALERT - OUT OF RANGE` with full details
3. Alert deduped by store + item + status within `MANAGER_ALERT_DEBOUNCE_MINUTES` (default 5 min)

---

## SQLITE_BUSY Fix Impact

All Template OCR operations use the same `run`/`all`/`get` wrappers that now include automatic SQLITE_BUSY retry (3 attempts, 150ms delay). This prevents workflow failures when the database is under write pressure from multiple concurrent operations.

---

## Dependencies

| Dependency | Required | Fallback |
|---|---|---|
| Tesseract | No | Returns NEEDS_REVIEW with warning |
| OpenCV (Python) | No | Uses baseline alignment |
| Google Sheets | No | Queues locally |
| Manager Chat ID | No | Logs alert locally |

**All dependencies gracefully degrade.** Missing Tesseract/OpenCV does not crash the system — workflow continues with reduced OCR confidence.