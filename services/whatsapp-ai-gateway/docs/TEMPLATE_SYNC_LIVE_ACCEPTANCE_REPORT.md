# Template Sync Live Acceptance Report

Date: 2026-06-04

## Acceptance Criteria

- Runtime template source is Google Sheet sync or SQLite `template_cache`.
- No production hardcoded item fallback remains.
- `/ldagent` Daily Entry uses dynamic item count and category/range metadata.
- `/broth` batch mode uses the same dynamic item list.
- API exposes current template, validation, and force sync.
- Google Sheet payload JSON includes every active item in validator results.

## Current Verification Status

- Static syntax checks passed for changed runtime files.
- Dynamic template parser unit test added.
- Bot restarted on port `3210` with build `202606041224-e06e26c`, PID `34896`.
- WhatsApp status is `ready`.
- `GET /api/template/current` returns `source: unavailable`, `item_count: 0`.
- `POST /api/admin/google-sheets/sync-template` reaches the new sync path but currently fails with Google Sheets `404: Requested entity was not found.`
- Metadata check showed the service account can access the log spreadsheet `Bakudan - Broth Count Log`, but that spreadsheet does not contain `Daily_Entry_Template`.
- The template URL currently stored in Admin config returns 404 for the same service account.

## Blocker

Live `item_count: 19` cannot be proven until the `Daily_Entry_Template` spreadsheet is shared with the configured Google service account or the Admin template URL is corrected.

## Manual Live Acceptance Steps

1. Restart the bot process.
2. Call `POST /api/admin/google-sheets/sync-template`.
3. Confirm `GET /api/template/current` shows `item_count: 19`.
4. In WhatsApp, send `/version` and verify the build ID changed after restart.
5. Start `/ldagent` -> Daily Entry Log.
6. Confirm first prompt says `Item 1 of 19`.
7. Complete or skip through all items.
8. Confirm the final summary includes 19 items.
