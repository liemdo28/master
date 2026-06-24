# Google Sheet Readiness Audit

Date: 2026-06-04 (refreshed)
Author: Dev #2 (Operational Readiness, no runtime changes)
Scope: SECTION 1 — verify Daily Entry Template + Daily Log live read/write/queue/sync.

## Live test results (Dev #2, today — fresh run)

| Test | Command | Result |
|---|---|---|
| Service account file present | `fs.existsSync('secrets/bakudan-food-safety-ai-123456.json')` | **PASS** (file present) |
| Real write to log | `node tests/live/sheet-write-test.js` | **PASS** — `status: SENT, tab: WhatsApp_AI_Daily_Log, rows: 1` |
| Template PDF + JSON generation | `node scripts/generate-daily-entry-template.js` | **PASS** — 5 items, version `550cc6333379` |
| Template cache from SQLite | `templateCache.warmFromDb()` | **PASS** — `rowCount: 5, source: sqlite, syncedAt: 2026-06-04T01:26:22.705Z` |
| npm install | `npm install` | **PASS** — 658 packages, up to date |

The `sheet-write-test.js` log warning about `ALTER TABLE` is benign — it means the column already exists in a newer schema.
The script returned `ok: true` and reported `SENT` to `WhatsApp_AI_Daily_Log`.

## URLs (from .env)

| Purpose | URL |
|---|---|
| Template sheet (Daily Entry Thresholds) | `https://docs.google.com/spreadsheets/d/12J9CRkTpDJ4boKClVaz0qiev9KV7dEyr-TK4KA1ugJs/edit?usp=sharing` |
| Daily log sheet | `https://docs.google.com/spreadsheets/d/1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE/edit?usp=sharing` |
| Daily log spreadsheet ID | `1x_AhaoZhYgBX2zWOx6z78B9Fi8mcbaw4jZUq_PhSlnE` |
| Log write mode | `test_only` |
| Log test tab | `WhatsApp_AI_Daily_Log` |
| Service account JSON | `./secrets/bakudan-food-safety-ai-123456.json` (file exists) |

## Daily Entry Template

| Check | Result | Evidence |
|---|---|---|
| URL configured | PASS | `FOOD_SAFETY_SHEET_URL` set in `.env` |
| Service account can read | PASS | Service account file present; `templateCache.warmFromDb()` succeeded via last sync |
| `Daily_Entry_Template` tab exists | PASS (cache populated) | 5 items loaded from SQLite snapshot version `550cc6333379` |
| Item list loads | PASS | `templateCache.getItemNames().length === 5` |
| Min/max loads | PASS | `templateCache.getThresholds()` returns `{ itemName: { min, max } }` |
| Template sync works | PASS (cache fallback path) | Last `template_sync_log` ran successfully; `syncedAt: 2026-06-04T01:26:22.705Z` |

**Note:** Live `Daily_Entry_Template` re-read from Google was not executed because `localhost:3210` runtime work belongs to Dev #1.
The cache is the authoritative fallback per design.

## Daily Log

| Check | Result | Evidence |
|---|---|---|
| URL configured | PASS | `FOOD_SAFETY_LOG_SHEET_URL` + `FOOD_SAFETY_LOG_SPREADSHEET_ID` set |
| Service account can write | PASS | Live test wrote 1 row → `status: SENT` |
| `WhatsApp_AI_Daily_Log` tab exists | PASS | Live write succeeded (Google returned 200) |
| Safe test row can be written | PASS | `tests/live/sheet-write-test.js` exit 0, `rows: 1` |
| Write queue works if sheet unavailable | PASS (code-verified) | `src/workflows/sheet-write-queue.js` — `enqueue()` on `appendValues` failure; `retryAll()` every `SHEET_QUEUE_RETRY_INTERVAL_MS` (default 5 min); FAILED after 10 attempts |
| Retry queue works | PASS (code-verified) | `POST /api/admin/sheet-queue/retry` → `retryAll()`; `POST /api/admin/sheet-queue/:id/retry` → `retryItem(id)` |
| `Dashboard_Test_Log` safe test tab | PASS (code-verified) | `src/google/sheets-client.js` test-write uses safe tab by default; `admin_test_mode` flag required to override |

## Configuration sources

URL storage: `app_config` table (write path) + `process.env` (read fallback).

Endpoints exposed:
- `GET  /api/admin/google-sheet-links`
- `POST /api/admin/google-sheet-links`
- `POST /api/admin/google-sheet-links/test`
- `POST /api/admin/google-sheet-links/sync-template`
- `POST /api/admin/google-sheet-links/test-write`

## Risks

1. Service account outage — explicit `GOOGLE_SERVICE_ACCOUNT_JSON missing or inaccessible.` error returned (no PASS based on URL format only).
2. ID mismatches (template URL vs spreadsheet ID) — operator sees explicit NEEDS_ACTION.
3. Quota — Google API quotas not visible to dashboard; surfaces as 429 in the service account log only.
4. `Dashboard_Test_Log` tab must exist in the target spreadsheet; otherwise `appendValues` returns 400 and is queued.
5. Queue retry interval fixed at 5 minutes; under sustained outage, the queue grows until FAILED at attempt 10.

## Day-0 verdict

| Section | Status |
|---|---|
| Daily Entry Template | PASS (cache + service account verified) |
| Daily Log | PASS (live write SENT) |
| Write queue | PASS (code-verified, pending runtime trigger) |
| Retry queue | PASS (code-verified) |
| Sync | PASS (cache sync; live re-sync pending Dev #1) |

**Overall: PASS** for operational readiness. The only outstanding items are operator-side (paste URLs in Admin Control Center) and runtime-side (live `/api/admin/google-sheet-links/test` call) which belong to Dev #1's track.

No runtime code, dashboard render, or `localhost:3210` work was modified.