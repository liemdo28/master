# SESSION_AUDIT.md — DEV 1 P0 Session Collision

**Date:** 2026-06-09
**Status:** COMPLETE (code analysis only — no runtime testing)

---

## 1. Session Creation Locations

### `form-photo` Session
- **File:** `src/workflows/form-photo-workflow.js`
- **Line:** 64
- **Code:** `sessions.set(key, session)` — Map key is `${chatId}:${sender}`
- **States:** `START → STORE_SELECTED → WAITING_FORM_PHOTO → OCR_PROCESSING → OCR_REVIEW_READY/NEEDS_REVIEW → CONFIRMED → SAVED`

### `template_ocr` Session
- **File:** `src/template-ocr/template-ocr-workflow.js`
- **Line:** 78
- **Code:** `sessions.set(sessionKey(chatId, sender), {...})` — Map key is `${chatId}:${sender}` (same format)
- **States:** `WAITING_CONFIRM` only

### ⚠️ Collision Point: `form-photo-ocr.js`
- **File:** `src/workflows/form-photo-ocr.js`
- **Lines:** 29-39
- **Problem:** Calls `templateOcrWorkflow.processImage()` which creates a `template_ocr` session at `template-ocr-workflow.js:78`
- This is done purely to reuse OCR infrastructure, but the session is never used by `form-photo-ocr.js` or `form-photo-workflow.js`
- The `template_ocr` session sits idle until it times out, competing with the `form-photo` session

---

## 2. Message Routing Trace for Reply "1"

### Text message flow in `message-listener.js`:

```
handleTextMessage()
  → templateOcrWorkflow.hasActiveSession(chatId, phone)  ← checked FIRST
  → if TRUE → templateOcrWorkflow.handleReply()          ← called FIRST
  → formPhotoWorkflow.hasActiveSession(chatId, phone)    ← checked SECOND
  → if TRUE → formPhotoWorkflow.handleFormPhotoReply()   ← called SECOND
```

### Image message flow in `message-listener.js`:

```
handleImageMessage()
  → formPhotoWorkflow.hasActiveSession(chatId, sender)   ← checked FIRST
  → if TRUE → formPhotoWorkflow.handleFormPhotoUpload()
  → templateOcrWorkflow.processImage()                  ← called SECOND (standard pipeline)
```

**Conclusion for text reply "1":**
- If `template_ocr` session exists → `templateOcrWorkflow.handleReply()` wins
- If only `form-photo` session exists → `formPhotoWorkflow.handleFormPhotoReply()` wins
- If BOTH exist → `templateOcrWorkflow` wins (first check), `form-photo` never processes "1"

---

## 3. Root Cause

`form-photo-ocr.js` calls `templateOcrWorkflow.processImage()` (line 35) which creates a `template_ocr` session as a side effect (at `template-ocr-workflow.js:78`). This is unnecessary — `form-photo-ocr.js` only needs the OCR engine, validator, and preprocessor — not the conversation session.

---

## 4. Required Fixes

### Fix 1 — `form-photo-ocr.js`: Reuse OCR engine only (no session)
- Replace `templateOcrWorkflow.processImage()` call with direct calls to low-level components
- Components needed: `template-image-router`, `template-registry`, `image-preprocessor`, `ocr-engine`, `template-ocr-validator`
- Do NOT call `template-ocr-workflow.js` at all
- Result: `form-photo` creates ONE session only

### Fix 2 — `form-photo-workflow.js`: Add MANAGER_REVIEW handler
- Missing `3` / `MANAGER_REVIEW` option in `handleFormPhotoReply()`
- Must call `manager-alert-service` with `workflow='form_photo'`
- Must send alert to manager chat with staff info + OCR summary

### Fix 3 — `form-photo-workflow.js`: Use correct submission ID
- `confirmSubmission()` generates a NEW `submissionId` via `makeSubmissionId()` — creates duplicate record
- Fix: pass existing `submissionId` from `saveSubmission()` step, update status instead of INSERT

### Fix 4 — `message-listener.js`: Add form-photo priority for group context
- When both sessions exist, prefer `form-photo` in group context
- Current: `template_ocr` always wins (checked first)

---

## 5. Session Isolation Verification

After fix, the following must hold:

| Scenario | Sessions Active |
|---|---|
| `/form` started | `form-photo` only |
| Photo uploaded | `form-photo` only |
| Reply "1" | `form-photo` only → SAVED |
| Reply "2" | `form-photo` → RETAKE_REQUESTED |
| Reply "3" | `form-photo` → MANAGER_REVIEW (session ends) |
| Reply "4" | `form-photo` → CANCELLED (session ends) |
| Standalone OCR photo (no form session) | `template_ocr` only |

**No state where BOTH `form-photo` AND `template_ocr` sessions exist simultaneously.**
