# Phase 2A Template OCR Runtime Report

Generated: 2026-06-04 08:45 Asia/Saigon

## Status

Runtime readiness: PASS

Phase 2A CEO success definition: NOT FINAL PASS YET

Reason: the local OCR runtime, tests, sheet write, and package all pass, but a real printed template photo has not been sent through the live WhatsApp test group in this Codex session. That real-world WhatsApp/photo step is still required before declaring Phase 2A fully passed.

## Dependency Check

Command: `node scripts/check-ocr-deps.js`

Result: PASS

```json
{
  "ok": true,
  "tesseract": {
    "ok": true,
    "command": "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    "version": "tesseract v5.4.0.20240606"
  },
  "opencv": {
    "ok": true,
    "module": "python cv2",
    "version": "4.13.0"
  },
  "sharp": {
    "ok": true,
    "module": "sharp"
  }
}
```

Installed/verified:

- Tesseract OCR: installed and resolved from `C:\Program Files\Tesseract-OCR\tesseract.exe`.
- `sharp`: installed through npm.
- Python OpenCV: installed as `opencv-python-headless`, used for optional perspective alignment.

## Template Generation

Command: `node scripts/generate-daily-entry-template.js`

Result: PASS

- PDF: `docs/templates/daily-entry-template.pdf`
- JSON: `data/templates/daily-entry-template-v1.json`
- Template ID: `daily-entry-v1`
- Item count: 5
- Source sheet version: `550cc6333379`
- Items: Walk-in Cooler, Walk-in Freezer, Prep Area, Fryer, Pork Broth

## OCR Runtime

Implemented local-only OCR path:

- Template detection from caption/form ID/title OCR.
- OpenCV marker alignment when Python `cv2` is available.
- Sharp crop/preprocess fallback.
- Tesseract OCR per reading box.
- Validation against template min/max.
- Summary before `CONFIRM`.
- `EDIT`, `RETAKE`, `CANCEL`, `CONFIRM`.
- Safe queueing when Google Sheets is unavailable.
- Missing dependency fallback to `NEEDS_REVIEW` instead of crashing.

No Gemini/OpenAI Vision is used for Template OCR.

## Local OCR Smoke Test

Input: `data/template-ocr-smoke/synthetic-daily-entry.png`

Result: handled by Template OCR.

Alignment:

```json
{
  "status": "ALIGNED_OPENCV",
  "note": "Perspective alignment completed with Python OpenCV."
}
```

Extracted values before edit:

| Item | OCR Value | Confidence | Status |
|---|---:|---:|---|
| Walk-in Cooler | 38 | 0.90 | PASS |
| Walk-in Freezer | -2 | 0.90 | PASS |
| Prep Area Cooler | -40 | 0.90 | FAIL_LOW |

Control flow:

- Summary shown before confirm: PASS
- `EDIT 1 39`: PASS
- `CONFIRM`: PASS
- Sheet unavailable mode queues safely: PASS

Known OCR issue from smoke: one synthetic value intended as `40` was read as `-40`. The runtime correctly surfaced the failure and allowed `EDIT`; real printed-photo calibration is still required.

## Dashboard Verification

Dashboard/API support present:

- OCR dependency status: `/api/template-ocr/status`
- Last template OCR run: `/api/template-ocr/status`
- OCR status, average confidence, unclear count, fail count: dashboard Template OCR panel
- Sheet write status: dashboard Template OCR panel
- PDF template link: `/api/template-ocr/template.pdf`
- Last uploaded image/aligned image links: `/api/template-ocr/image?path=...`
- Aligned image/crop paths are stored in `template_ocr_runs.payload_json`

Screenshots not captured in this session because no real WhatsApp template image run was available in the browser dashboard state.

## Test Results

Final command chain result: PASS

Commands run:

```powershell
node scripts/check-ocr-deps.js
node scripts/generate-daily-entry-template.js
npm test
node tests/live/live-validator.js --no-telegram
node tests/live/sheet-write-test.js
.\pack.ps1
```

Results:

- OCR deps: PASS
- Template generation: PASS
- `npm test`: PASS
- Live validator: 85 passed, 0 failed
- Sheet write test: SENT, 1 row
- Package: `whatsapp-ai-gateway-v1.0.0.zip`
- Package verification: no secrets, session, or `node_modules` in zip

Notes:

- `npm test` still emits `MaxListenersExceededWarning` from existing test bootstrap behavior, but exits 0 and all suites pass.
- Live tests now use unique SQLite DB files and close SQLite connections before exit.
- `sheet-write-test` accepts `SENT` or safe `QUEUED`; final run returned `SENT`.

## Real Printed WhatsApp Photo Test

Status: NOT EXECUTED IN THIS SESSION

Required remaining steps:

1. Print `docs/templates/daily-entry-template.pdf`.
2. Fill 5 test values.
3. Take a phone photo with all four markers visible.
4. Send the photo to the WhatsApp test group with `daily-entry-v1` in the caption if title detection is unreliable.
5. Verify:
   - Template detected.
   - Image aligned with OpenCV.
   - Crops produced.
   - OCR numeric extraction shown in summary.
   - `EDIT` works for wrong/unclear values.
   - `CONFIRM` writes to Google Sheet or queues safely.
6. Capture evidence screenshots:
   - WhatsApp summary.
   - Google Sheet row.
   - Dashboard Template OCR panel.

## Known Issues

- Real printed-photo OCR has not been validated yet, so Phase 2A cannot be marked final PASS.
- Synthetic smoke showed one numeric misread (`40` to `-40`), making field-level OCR calibration necessary during printed-photo testing.
- Warnings from MaxListeners remain in test output; they are not failing tests.
