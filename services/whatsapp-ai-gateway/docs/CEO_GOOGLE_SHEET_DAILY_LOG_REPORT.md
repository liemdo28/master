# CEO Google Sheet Daily Log Report

## Status

The missing Google Sheet daily log writer has been added.

The current image path is:

```text
WhatsApp image
-> download image
-> analyze image or mark NEEDS_REVIEW if vision is not configured
-> threshold check
-> save SQLite
-> append Google Sheet daily-log rows or queue on failure
-> send WhatsApp warning for FAIL / NEEDS_REVIEW
-> show status on dashboard
```

## New Files

- `src/google/google-auth.js`
- `src/google/sheets-client.js`
- `src/google/daily-log-writer.js`
- `src/google/sheet-mapper.js`

## SQLite Addition

Added:

```text
food_safety_sheet_queue
```

The queue stores failed or disabled Google Sheet writes so daily-log data is not lost.

## Warning Behavior

`PASS`:

- Appends a daily-log row.
- No group warning by default.

`FAIL`:

- Appends a daily-log row or queues it.
- Sends a WhatsApp group warning.
- Includes corrective action and confirms the reading was recorded to the daily log.

`NEEDS_REVIEW`:

- Appends a daily-log row or queues it.
- Sends a WhatsApp group review warning.
- Unknown stores route to `Needs_Review`.

## Test Mode

The system remains test-gated.

Only chats listed in:

```env
FOOD_SAFETY_ALLOWED_CHAT_IDS=<test_group_id>
```

are processed while:

```env
FOOD_SAFETY_TEST_MODE=true
```

All other groups are ignored.

## Vision Status

If `VISION_API_URL` or `VISION_API_KEY` is missing, the analyzer returns `NEEDS_REVIEW` and the dashboard/API show:

```text
Vision API not configured — image will be marked NEEDS_REVIEW.
```

OCR should not be considered verified until a real image test passes against the configured vision API.

## Packaging Security

Packaging scripts were hardened so the zip excludes:

- `.env`
- `node_modules/`
- `data/session/`
- `.wwebjs_cache/`
- `.wwebjs_auth/`
- `data/*.db`
- `data/*.db-wal`
- `data/*.db-shm`
- `logs/`
- nested `*.zip`

## Verification

Completed:

```text
npm test
node tests/live/live-validator.js --no-telegram
```

Both passed.

Still required before real operations:

1. Add Google service-account JSON under `./secrets`.
2. Configure the daily log spreadsheet ID or URL.
3. Configure the separate WhatsApp test group ID.
4. Configure and verify the vision API with a real image.
5. Send one real food-safety image into the test group.
6. Confirm the Google Sheet row, WhatsApp warning if applicable, and dashboard status.
