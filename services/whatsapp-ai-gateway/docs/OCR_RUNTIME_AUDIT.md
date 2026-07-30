# OCR Runtime Audit

Audit date: 2026-06-04

## Result

Status: PASS

The local printed-template OCR runtime dependencies are installed and the workflow passes automated tests.

## Dependency Check

`node scripts/check-ocr-deps.js` returned:

- Tesseract: OK, `tesseract v5.4.0.20240606`
- OpenCV: OK, Python `cv2` version `4.13.0`
- Sharp: OK

## Automated Evidence

Template OCR tests verified:

- Printable PDF generation
- Template JSON generation at `data/templates/daily-entry-template-v1.json`
- Template detection by form ID
- Numeric parsing including negative decimals
- PASS validation
- FAIL validation
- Missing values -> `NEEDS_REVIEW`
- Low confidence -> `NEEDS_REVIEW`
- Summary before confirm
- `EDIT`
- `CONFIRM`
- Queue fallback when Sheets unavailable
- `CANCEL`

## Startup Evidence

Startup log reached: `Template OCR printable template ready`.

## Manual Pilot Step

Before staff pilot, perform one real phone-photo test with the printed template and confirm crop quality in `data/uploads/template-ocr`.
