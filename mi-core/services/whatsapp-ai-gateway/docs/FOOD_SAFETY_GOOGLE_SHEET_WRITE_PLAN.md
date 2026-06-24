# Food Safety Google Sheet Write Plan

## Scope

Add a Google Sheet daily-log writer after the existing WhatsApp image, analyzer, threshold, warning, and SQLite pipeline.

The system stays in test mode until a separate WhatsApp test group passes. The real operations group must not be enabled yet.

## Configuration

Required environment values:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/google-service-account.json
FOOD_SAFETY_DAILY_LOG_SHEET_URL=
FOOD_SAFETY_DAILY_LOG_SPREADSHEET_ID=
FOOD_SAFETY_WRITE_MODE=test_only
FOOD_SAFETY_TEST_TAB=Test_Log
FOOD_SAFETY_STORE_TABS=Rim,Stone Oak,Bandera
FOOD_SAFETY_ALLOWED_CHAT_IDS=<test_group_id>
```

Vision must also be configured before claiming OCR works:

```env
VISION_API_URL=
VISION_API_KEY=
```

If either vision value is missing, images are marked `NEEDS_REVIEW` with this visible status:

```text
Vision API not configured — image will be marked NEEDS_REVIEW.
```

## Flow

1. WhatsApp account A receives an image.
2. Test-mode gate checks `FOOD_SAFETY_ALLOWED_CHAT_IDS`.
3. Image is downloaded and saved under `data/uploads/food-safety`.
4. Analyzer extracts store, date, time, readings, unclear fields, and review items.
5. Threshold engine returns `PASS`, `FAIL`, or `NEEDS_REVIEW`.
6. SQLite saves the check, readings, warning, and incident if needed.
7. Daily-log writer builds rows and appends them to Google Sheets.
8. If append fails, payload is stored in `food_safety_sheet_queue`.
9. `FAIL` and `NEEDS_REVIEW` results send a warning back to the WhatsApp test group.

## Daily Log Columns

Rows are written with these columns:

```text
Timestamp
WhatsApp Chat ID
Sender
Store
Date
Time
Item
Reading
Unit
Target
Status
Corrective Action
Confidence
Image Path
Message ID
AI Result
Warning Sent
Notes
```

## Store Mapping

Known stores:

- `Rim`
- `Stone Oak`
- `Bandera`
- `Medical Center`

Current configured write tabs:

- `Rim`
- `Stone Oak`
- `Bandera`

Unknown stores are routed to `Needs_Review` and the warning asks the group to confirm the store.

## Retry Queue

SQLite table:

```text
food_safety_sheet_queue
```

Fields:

```text
id
check_id
payload_json
status
attempt_count
last_error
created_at
sent_at
```

Statuses:

- `PENDING`
- `SENT`
- `FAILED`

Pending and failed queue items are retried by `daily-log-writer.retryPending()`.

## Dashboard Status

The dashboard now surfaces:

- Last image received.
- Last sheet write status.
- Pending sheet queue count.
- Last warning sent.
- Store detected.
- `PASS` / `FAIL` / `NEEDS_REVIEW`.
- Vision status.
- Sheet last synced.
- Daily log last written.

## Go-Live Gate

Keep `FOOD_SAFETY_TEST_MODE=true`.

Only set:

```env
FOOD_SAFETY_ALLOWED_CHAT_IDS=<separate_test_group_id>
```

Do not add the real Bakudan operations group until the test group passes with a real image and a real Google Sheet append.
