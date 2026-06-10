# WhatsApp Pairing Fix Report

Date: 2026-06-05

## Root Cause

The gateway had weak WhatsApp pairing diagnostics and session recovery controls. QR events were visible, but there was no durable event trail showing whether the client reached `authenticated`, `ready`, `auth_failure`, `change_state`, or `loading_screen`.

The previous runtime also used default LocalAuth behavior without a stable explicit client ID and did not expose dashboard/API controls to reset a bad WhatsApp Web session.

## Fix

- Forced `LocalAuth` with `clientId: bakudan-food-safety`.
- Moved WhatsApp session storage to persistent `.wwebjs_auth`.
- Preserved `.wwebjs_auth` and `.wwebjs_cache` during installer updates.
- Added restart and reset-session controls.
- Added full event logging to `logs/whatsapp-diagnostics.log`.
- Added runtime status object with state, timestamps, errors, and restart count.
- Upgraded WhatsApp dependencies:
  - `whatsapp-web.js` 1.34.7
  - `puppeteer` 25.1.0
  - `qrcode-terminal` 0.12.0

## Files Changed

- `src/whatsapp/session-manager.js`
- `src/api/server.js`
- `src/dashboard/admin-ui.js`
- `installer/install.ps1`
- `package.json`
- `package-lock.json`

## Test Result

- `npm test`: PASS
- `node --check src/whatsapp/session-manager.js`: PASS
- `node --check src/api/server.js`: PASS
- `node --check src/dashboard/admin-ui.js`: PASS
- `/api/whatsapp/status`: HTTP 200 in Express smoke test

## Evidence

Expected diagnostics log lines after phone pairing:

- `{"event":"qr",...}`
- `{"event":"authenticated",...}`
- `{"event":"ready",...}`

Local session reset performed:

- `.wwebjs_cache` backed up and removed
- `data/session` backed up and removed
- Backup folder: `data/backup/whatsapp-session-reset-20260605-150747`

## Final Verdict

CODE READY / PHONE PAIRING REQUIRED.

P0 is not finally accepted until a clean laptop scan produces `QR -> AUTHENTICATED -> READY` and survives gateway restart without re-scanning.
