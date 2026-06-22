# WhatsApp Pairing Fix Report

Date: 2026-06-10

## Root Cause

The gateway had weak WhatsApp pairing diagnostics and session recovery controls. QR events were visible, but there was no durable event trail showing whether the client reached `authenticated`, `ready`, `auth_failure`, `change_state`, or `loading_screen`.

The previous runtime also used default LocalAuth behavior without a stable explicit client ID and did not expose dashboard/API controls to reset a bad WhatsApp Web session.

Follow-up live debug found two additional blockers:

- Local `.env` still had `STARTUP_MODE=safe`, so the dashboard and health endpoint started but WhatsApp initialization was skipped entirely.
- Local `.env` still pointed `SESSION_DIR` at `./data/session`, while the hardened installer/code path expects persistent `.wwebjs_auth`; this created inconsistent session reset/update behavior.
- The local WhatsApp Web cache could serve stale HTML, causing QR loops on some machines.

## Fix

- Forced `LocalAuth` with `clientId: bakudan-food-safety`.
- Moved WhatsApp session storage to persistent `.wwebjs_auth`.
- Preserved `.wwebjs_auth` and `.wwebjs_cache` during installer updates.
- Installer now writes `STARTUP_MODE=normal`, `SESSION_DIR`, and `WWEBJS_CACHE_DIR` into the installed ProgramData config.
- Installer migrates old app-folder `.wwebjs_auth`, `.wwebjs_cache`, and `data/session` before overwriting the app folder.
- Added remote WhatsApp Web cache fallback and a stable Windows Chrome user agent.
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
- `.env.example`
- `package.json`
- `package-lock.json`

## Test Result

- `npm test`: PASS
- `node --check src/whatsapp/session-manager.js`: PASS
- `installer/install.ps1` PowerShell parse: PASS
- `node --check src/api/server.js`: PASS
- `node --check src/dashboard/admin-ui.js`: PASS
- `/api/health`: HTTP 200, `whatsapp_status: qr`
- `/api/whatsapp/status`: HTTP 200, `state: QR`, `last_qr_at: 2026-06-10T09:18:12.756Z`
- `whatsapp-ai-gateway-windows-installer.zip`: rebuilt
- Installer zip scan: PASS
- Nested production source zip scan: PASS

## Evidence

Expected diagnostics log lines after phone pairing:

- `{"event":"qr",...}`
- `{"event":"authenticated",...}`
- `{"event":"ready",...}`

Local session reset performed:

- `.wwebjs_cache` backed up and removed
- `data/session` backed up and removed
- Backup folder: `data/backup/whatsapp-session-manual-reset-20260610-161505`

Observed after restart in normal mode:

- `BOOT_STEP_1_CONFIG {"startupMode":"normal"}`
- `BOOT_STEP_4_WHATSAPP_INIT`
- `{"event":"initializing","sessionDir":"E:\\Project\\Master\\whatsapp-ai-gateway\\.wwebjs_auth",...}`
- `{"event":"qr","state":"QR"}`

Package scan confirmed no forbidden `.env`, secrets, logs, session/cache, DB, browser profile files, or stale Google test/log URLs in the outer installer zip or nested production source zip.

## Final Verdict

CODE READY / PHONE PAIRING REQUIRED.

P0 is not finally accepted until a clean laptop scan produces `QR -> AUTHENTICATED -> READY` and survives gateway restart without re-scanning.
