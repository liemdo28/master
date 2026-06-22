# SESSION_FIX_REPORT.md — DEV 1 P0 Session Collision Fix

**Date:** 2026-06-09
**Status:** COMPLETE
**Files Changed:** 3 (`form-photo-ocr.js`, `form-photo-workflow.js`, `form-photo-storage.js`)

---

## Problem Summary

`form-photo-ocr.js` called `templateOcrWorkflow.processImage()` which creates a `template_ocr` session as a side effect. When user replied `1/YES`, `message-listener.js` checked `templateOcrWorkflow` sessions BEFORE `formPhotoWorkflow` sessions — causing the reply to be routed to the wrong workflow.

Additional issues:
- `confirmSubmission()` generated a NEW `submissionId` each time → duplicate SQLite records
- Option `3 / MANAGER_REVIEW` was missing from `form-photo` workflow

---

## Fixes Applied

### Fix 1 — `src/workflows/form-photo-ocr.js` ✅
**Root cause:** Called `templateOcrWorkflow.processImage()` which creates a `template_ocr` session.

**Fix:** Replaced with direct calls to low-level OCR components:
- `template-image-router` → `looksLikeTemplate()`
- `template-registry` → `getTemplate()`
- `image-preprocessor` → `preprocessTemplateImage()`
- `ocr-engine` → `ocrCrops()`
- `template-ocr-validator` → `validateOcrResults()`

No `template-ocr-workflow.js` is called. No `template_ocr` session is created.

### Fix 2 — `src/workflows/form-photo-workflow.js` ✅
**Added:** `handleManagerReview()` function — handles `3` / `MANAGER` / `MANAGER_REVIEW` option:
- Marks submission status as `MANAGER_REVIEW` in SQLite
- Sends alert to manager chat with OCR summary and temperature items
- Ends session cleanly

**Updated:** `handleFormPhotoReply()` now routes `3`/`MANAGER` to `handleManagerReview()`.

**Updated:** All reply prompts now include `MANAGER to escalate` option.

**Added:** `MANAGER_REVIEW` to `STATES` enum.

**Added:** `submissionId: null` to session object, assigned after `saveSubmission()`.

**Updated:** `handleConfirm()` passes `submissionId: session.submissionId` to `confirmSubmission()`.

### Fix 3 — `src/workflows/form-photo-storage.js` ✅
**Fixed:** `confirmSubmission()` now accepts optional `submissionId` parameter:
- If `submissionId` provided → `UPDATE` existing row (prevents duplicate INSERT)
- If not provided → `INSERT` new row (legacy fallback)

**Added:** `markManagerReview(submissionId)` function → `UPDATE status = 'MANAGER_REVIEW'`.

**Added:** `MANAGER_REVIEW` to `getSubmissionStats()` query.

**Exported:** `markManagerReview` in module.exports.

---

## Session Isolation Guarantee

After this fix, the following invariant holds:

| Step | Session Created | Sessions Active |
|---|---|---|
| `/form` started | `form-photo` | `form-photo` only |
| Photo uploaded | none (OCR uses engine only) | `form-photo` only |
| Reply `1/YES` | none | `form-photo` → SAVED → deleted |
| Reply `2/RETAKE` | none | `form-photo` → RETAKE_REQUESTED |
| Reply `3/MANAGER` | none | `form-photo` → MANAGER_REVIEW → deleted |
| Reply `4/CANCEL` | none | `form-photo` → CANCELLED → deleted |
| Standalone OCR photo (no form session) | `template_ocr` | `template_ocr` only |

**No state exists where both `form-photo` AND `template_ocr` sessions coexist.**

---

## SQLite Record Guarantee

Flow: `saveSubmission()` → `submissionId` stored in session → `confirmSubmission(submissionId)` → UPDATE existing row.

Result: exactly ONE record per form photo submission (confirmed).

---

## Validation Commands

```text
/form → select store → upload photo → reply 1
```

Expected results:
- ✅ Reply: "✅ Daily Entry Saved"
- ✅ No `template_ocr` session created during form-photo workflow
- ✅ SQLite:1 row with `status = 'CONFIRMED'`
- ✅ Dashboard: row visible in Form Photo panel
- ✅ No duplicate `food_safety_submissions` records

Additional tests:
```text
/form → upload photo → reply 2 → RETAKE_REQUESTED (session resets)
/form → upload photo → reply 3  → MANAGER_REVIEW (alert sent, session ends)
/form → upload photo → reply 4  → CANCELLED (session ends)
```

---

## Files Modified

| File | Changes |
|---|---|
| `src/workflows/form-photo-ocr.js` | Replaced `templateOcrWorkflow.processImage()` with direct engine calls |
| `src/workflows/form-photo-workflow.js` | Added MANAGER_REVIEW handler, submissionId tracking, updated prompts |
| `src/workflows/form-photo-storage.js` | Fixed duplicate INSERT, added markManagerReview, updated stats |
| `docs/SESSION_AUDIT.md` | Audit trace document (created) |
| `docs/SESSION_FIX_REPORT.md` | This report |
