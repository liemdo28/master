# Google Sheet Log Sync Report

Generated: 2026-06-03

## Google Sheet

Target:

```text
https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE/edit?usp=sharing
```

Verified via Google Drive connector:

```text
Title: Bakudan - Broth Count Log
Existing tab observed: Rim
```

Attempted Google Sheet tab/header sync through the connected Google Drive app, but write failed because the app connection does not currently have the required Sheets write scope. Local service-account write also cannot run because this file is missing:

```text
./secrets/google-service-account.json
```

## Excel Source

Local workbook inspected:

```text
C:\Users\liemdo\Downloads\Bakudan_Food_Safety_Line_Check_Dashboard_SYNCED.xlsx
```

Workbook source sheets found:

- `Thresholds_SOP`
- `AI_Rule_Source`
- `WhatsApp_AI_Daily_Log`
- `Photo_Audit_Log`

The repo now includes `scripts/sync-google-sheet-log.js` to create/sync required tabs once the service-account file is present and the target Google Sheet is shared with that service account.

## Required Tabs

To be synced into the Google Sheet:

- `WhatsApp_AI_Daily_Log`
- `Photo_Audit_Log`
- `Needs_Review`
- `Sheet_Write_Queue`
- `AI_Rule_Source`
- `Thresholds_SOP`

## Daily Log Schema

`WhatsApp_AI_Daily_Log` is aligned to the CEO-required 17-column schema:

```text
Timestamp
Store
Chat ID
Sender
Message ID
Source Type
Image Path
Item
Reading
Unit
Target
Status
Confidence
Corrective Action
Warning Sent
Sheet Write Status
Notes
```

## Source Status

WhatsApp receiving real messages:

```text
NOT VERIFIED in this run. Requires phone A/B live test after npm start.
```

Image analysis working:

```text
PARTIAL. Pipeline works. Vision API is not configured, so real OCR is not verified.
Expected no-OCR behavior is NEEDS_REVIEW.
```

Threshold checking working:

```text
PASS. Unit and simulator tests verify threshold FAIL/NEEDS_REVIEW behavior.
```

Google Sheet append working:

```text
NOT VERIFIED. Blocked by missing ./secrets/google-service-account.json and connector write-scope failure.
Writer is implemented and configured for the target spreadsheet ID.
```

Warning working:

```text
PASS in simulated pipeline. Real WhatsApp group warning still requires live phone test.
```

Queue retry working:

```text
PASS in automated tests. Failed writes are saved to food_safety_sheet_queue and retry can resend pending rows when credentials are available.
```

## Current Config

Configured target:

```env
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/google-service-account.json
FOOD_SAFETY_LOG_SHEET_URL=https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE/edit?usp=sharing
FOOD_SAFETY_LOG_SPREADSHEET_ID=1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE
FOOD_SAFETY_WRITE_MODE=test_only
```

## Commands Added

Sync tabs/headers after credentials are available:

```powershell
node scripts/sync-google-sheet-log.js
```

Run one real sheet append test:

```powershell
node tests/live/sheet-write-test.js
```

## Remaining Work

1. Add `./secrets/google-service-account.json`.
2. Share `Bakudan - Broth Count Log` with the service account email.
3. Run `node scripts/sync-google-sheet-log.js`.
4. Run `node tests/live/sheet-write-test.js`.
5. Start gateway, scan WhatsApp QR with account A, and test one separate WhatsApp test group image.
6. Capture actual live evidence after a real row appears in Google Sheets.
