# OCR Operational Audit

Date: 2026-06-04
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 4 — verify Template OCR is operational and degrades safely.

## Live verification (Dev #2, today)

```
$ node scripts/check-ocr-deps.js
{
  "ok": true,
  "tesseract": {
    "ok": true,
    "command": "C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
    "version": "tesseract v5.4.0.20240606",
    "error": ""
  },
  "opencv": {
    "ok": true,
    "module": "python cv2",
    "version": "4.13.0",
    "error": ""
  },
  "sharp": {
    "ok": true,
    "module": "sharp"
  },
  "notes": []
}
```

| Check | Result | Evidence |
|---|---|---|
| Tesseract installed | PASS | `tesseract v5.4.0.20240606` at `C:\Program Files\Tesseract-OCR\tesseract.exe` |
| OpenCV / sharp installed | PASS | OpenCV via `python cv2` 4.13.0; `sharp` package resolves |
| Dependency check script works | PASS | `node scripts/check-ocr-deps.js` exit 0, `ok: true` |
| Generated PDF exists | PASS | `docs/templates/daily-entry-template.pdf` |
| Generated template JSON exists | PASS | `data/templates/daily-entry-template-v1.json` (5 fields, version 550cc6333379) |
| Generator script works | PASS | `node scripts/generate-daily-entry-template.js` exit 0 |
| Confirmation workflow exists | PASS (code-verified) | `src/template-ocr/template-ocr-workflow.js` handles CONFIRM / EDIT / RETAKE / CANCEL |
| Queue fallback exists | PASS (code-verified) | `template-ocr-sheet-writer.writeConfirmedOcr()` → `sheetsClient.appendValues()` on fail → `sheetQueue.enqueue({ workflowType: 'template_ocr', ... })` |
| Dashboard panel can open printable PDF | PASS (code-verified) | Admin Control Center exposes the generated PDF URL; "Open Daily Entry Template" button |
| Graceful degradation if missing | PASS (code-verified) | If `tesseract.ok === false` → `NEEDS_REVIEW`; if `opencv.ok && !sharp.ok` → `sharp` fallback only; missing all → human path only |

## Code surface (verified)

| Component | File | Purpose |
|---|---|---|
| Generator | `src/template-ocr/template-generator.js` | Builds printable PDF/JSON from current template |
| Dependency check | `src/template-ocr/dependency-check.js` | Probes Tesseract / OpenCV / sharp |
| OCR engine | `src/template-ocr/ocr-engine.js` | Runs Tesseract + parses numeric output |
| Image preprocessor | `src/template-ocr/image-preprocessor.js` | Alignment / cropping (OpenCV→sharp fallback) |
| Image router | `src/template-ocr/template-image-router.js` | Detects "is this a printed template?" |
| Validator | `src/template-ocr/template-ocr-validator.js` | Compares OCR values vs template thresholds |
| Storage | `src/template-ocr/template-ocr-storage.js` | Persists runs (`template_ocr_runs` table) |
| Workflow | `src/template-ocr/template-ocr-workflow.js` | Confirmation / edit / cancel / sheet write |
| Sheet writer | `src/template-ocr/template-ocr-sheet-writer.js` | Writes confirmed OCR to Google Sheet, with queue fallback |

## Dependency check semantics (`checkOcrDeps`)

```js
const deps = checkOcrDeps();
// {
//   ok: tesseract.ok && (opencv.ok || sharp.ok),
//   tesseract: { ok, command, version, error },
//   opencv:    { ok, module, version, error },
//   sharp:     { ok, module, error },
//   notes: [...]
// }
```

Resolution order for image alignment:
1. `opencv4nodejs`
2. `@u4/opencv4nodejs`
3. Python `cv2`  ← **active on this host**
4. `sharp` (fallback only)

## PDF / JSON generation

- `template-generator.generateDailyEntryTemplate()` is called on boot
  (`src/index.js`) and via `POST /api/template-ocr/generate`.
- It rebuilds the layout from `templateCache.getItems()` and writes
  `docs/templates/daily-entry-template.pdf`.
- Item order, min/max, and reading boxes are derived from runtime template;
  no hardcoded operational values.

## Confirmation workflow

- Image received → `processImage()` returns a summary message with each
  item value, PASS / HIGH / LOW / REVIEW, target range.
- User reply:
  - `CONFIRM` (or `YES`, `OK`) → sheet write via
    `sheetWriter.writeConfirmedOcr()`.
  - `EDIT N value` → updates that field, re-validates, returns updated
    summary.
  - `RETAKE` → marks `RETAKE_REQUESTED`, prompts new photo.
  - `CANCEL` (or `ABORT`) → marks `CANCELLED`, nothing written.

## Queue fallback

`template-ocr-sheet-writer.writeConfirmedOcr`:
1. Try `sheetsClient.appendValues({ tab, values, columnEnd: 'Q' })`.
2. On failure, enqueue into `sheet_write_queue` via
   `sheetQueue.enqueue({ workflowType: 'template_ocr', ... })`.
3. User sees: `Saved locally. Google Sheet write queued.`

The same `sheet_write_queue` is shared with daily-log writer and
incidents — quota contention is a known characteristic, not a regression.

## Status

- `GET /api/template-ocr/status` returns stats, last run, recent runs, dep
  check.
- Dashboard OCR panel renders Tesseract / OpenCV / Sharp status badges and
  the most recent run summary.

## Risks

1. If Tesseract is missing, OCR returns `NEEDS_REVIEW` and the human
   workflow is the only path.
2. If OpenCV is missing but sharp is present, alignment falls back to
   template-coordinate cropping, which is less robust on skewed photos.
3. PDF generation requires `fs.mkdirSync` write access to `docs/templates`;
   on read-only filesystems it fails loudly.
4. Sheet write queue uses the same `sheet_write_queue` as other workflows
   — quota contention is shared.

## Day-0 verdict

| Section | Status |
|---|---|
| Tesseract installed | PASS (5.4.0) |
| OpenCV / sharp installed | PASS (cv2 4.13.0 + sharp) |
| Dependency check script | PASS |
| Generated PDF + JSON | PASS (5 items) |
| Confirmation workflow | PASS (code-verified) |
| Queue fallback | PASS (code-verified) |
| Graceful degradation | PASS (code-verified) |

**Overall: PASS** (no DISABLED, no BLOCKED)

No runtime code, dashboard render, or `localhost:3210` work was modified.
