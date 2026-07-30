# P0 Runtime Fix Report

Date: 2026-06-05

## Runtime

- PID: `27212`
- Build ID: `202606050108-e06e26c`
- WhatsApp: READY
- Template count: 19
- Template version: `ca54a1553c17`

## Fixed

1. Dashboard Google Sheet links now store canonical Google Sheets URLs and reject placeholders.
2. Vietnamese language persists into `/ldagent` via `session.language`.
3. Template loader reads `Daily_Entry_Template!B11:D35`.
4. Production Daily Entry item list comes from Google Sheet or SQLite template cache.
5. `/version` includes build, commit, template count/version/source, and language engine.

## Verification

- `node tests/template/dynamic-template-sync-tests.js`: PASS 18/18
- `POST /api/admin/google-sheet-links/test`: PASS template + log
- `POST /api/admin/google-sheets/sync-template`: SUCCESS, 19 items
- `GET /api/template/current`: 19 items
- `GET /api/health`: template cache ready, 19 items, WhatsApp ready

## Screenshots

- `docs/screenshots/dashboard-sheet-open-success.png`
- `docs/screenshots/whatsapp-vietnamese-workflow.png`
- `docs/screenshots/template-count-19.png`
- `docs/screenshots/template-sync-after-add-item.png`
