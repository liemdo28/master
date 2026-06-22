# Full System Startup Audit

Audit date: 2026-06-04

## Result

Status: PASS WITH WARNINGS

The application can install, start, load the dashboard, and generate a WhatsApp QR code in an isolated startup run.

## Commands Run

- `npm install`
- `node --check src/dashboard/admin-ui.js`
- `node --check src/api/server.js`
- `npm test`
- Isolated startup: `DASHBOARD_PORT=33210 SESSION_DIR=./data/session-audit-smoke node src/index.js`
- HTTP checks:
  - `GET http://localhost:33210/health`
  - `GET http://localhost:33210/`
  - `GET http://localhost:33210/qr`

## Evidence

- `npm install`: completed successfully, dependency tree up to date.
- `npm test`: passed all package test suites.
- Dashboard: `GET /` returned HTTP 200 with HTML content.
- WhatsApp QR: `GET /qr` returned HTTP 200, `image/png`, 4744 bytes.
- Startup log reached: `=== All systems initialised ===`.
- Health endpoint returned WhatsApp status `qr`, which is expected for a clean temporary session waiting to be scanned.

## Fixes Applied During Audit

- Added missing store registry helpers used by runtime workflows:
  - `markLastMessage(chatId, groupName)`
  - `markLastLogWrite(chatId)`
- Replaced corrupted dashboard renderer that caused `SyntaxError: Unexpected identifier 'Refreshed'` on startup.

## Warnings

- `MaxListenersExceededWarning` appears during long test/startup processes for `uncaughtException` and `unhandledRejection` listeners.
- Some migration attempts log `SQLITE_ERROR` when adding columns that already exist. Tests still pass, but migrations should check `PRAGMA table_info` before `ALTER TABLE`.
- Template sync logged: `Unable to parse range: 'Daily_Entry_Template'!B11:D91`. Cached SQLite template data was used successfully.
- `npm audit` reports 16 vulnerabilities: 2 low, 7 moderate, 5 high, 2 critical.

## Startup Gate

Approved for technical startup smoke test. Not approved for 7-Day Pilot until the blockers in `PILOT_READINESS_FINAL.md` are cleared.
