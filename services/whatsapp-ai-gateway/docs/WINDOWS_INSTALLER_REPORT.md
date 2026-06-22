# Windows Installer Report

Date: 2026-06-05

## Status

PASS for package construction after final runtime lock hardening.

Do not declare the installer ready until clean laptop install and reboot auto-start validation both pass on the target laptop.

## Deliverable

- `whatsapp-ai-gateway-windows-installer.zip`

Inside:

- `installer/Install WhatsApp AI Gateway.bat`
- `installer/install.ps1`
- `installer/Start Gateway.bat`
- `installer/Stop Gateway.bat`
- `installer/Open Dashboard.bat`
- `installer/Gateway Status.bat`
- `installer/README_INSTALL_EN.md`
- `installer/source/whatsapp-ai-gateway-production-v1.0.0.zip`
- `installer/runtime/node-v24.14.1-win-x64.zip`
- `installer/runtime/chrome-win64/`

## Install Path

Default install path:

`%USERPROFILE%\Bakudan\whatsapp-ai-gateway`

No installer script uses `E:\Project\Master`.

## P0 Offline Install Hardening

The installer no longer depends on live `npm install` or Puppeteer browser download on the store laptop.

Included in the installer:

- Production source package with `node_modules`
- Portable Node.js runtime
- Bundled Chrome runtime for Puppeteer and WhatsApp Web

The installer sets `PUPPETEER_EXECUTABLE_PATH`, `CHROME_PATH`, and `PUPPETEER_SKIP_DOWNLOAD=true` during validation. This prevents `Failed to set up chrome-headless-shell` during deployment.

## P0 Runtime Startup Investigation

The gateway now records explicit boot markers:

- `BOOT_STEP_1_CONFIG`
- `BOOT_STEP_2_DB`
- `BOOT_STEP_3_TEMPLATE`
- `BOOT_STEP_4_WHATSAPP`
- `BOOT_STEP_5_SERVER`
- `SERVER_READY_PORT_3210`

The dashboard server now binds before WhatsApp initialization begins. This keeps `/api/health` reachable even when WhatsApp Web, Chrome startup, or session restore is slow.

`STARTUP_MODE=safe` is available for diagnosis. In safe mode the gateway starts only DB, template cache, and dashboard, and skips WhatsApp/background messaging.

The hidden launcher now waits up to 120 seconds for port 3210 and 120 seconds for `/api/health`. On startup failure it captures `tasklist`, `netstat`, `gateway-out.log`, `gateway-error.log`, and `gateway-start.log`.

## Behavior

The installer:

1. Detects Windows.
2. Detects bundled Node.js and bundled Chrome in the installer.
3. Copies the production source package to the user profile install folder.
4. Extracts bundled Node.js to `runtime\node`.
5. Backs up `.env` and `secrets` before updating an existing install.
6. Copies bundled Chrome to `runtime\chrome-win64`.
7. Verifies bundled `node_modules`.
8. Creates `data`, `logs`, `secrets`, and `data/runtime`.
9. Creates `.env` from `.env.example` when missing.
10. Prompts for `secrets\google-service-account.json`.
11. Runs `npm test` with bundled Node/npm.
12. Creates desktop shortcuts.
13. Installs the `WhatsApp AI Gateway` Windows logon task.
14. Creates a Startup folder shortcut fallback if the scheduled task cannot be installed.
15. Starts the gateway hidden.
16. Attempts a visible foreground fallback if hidden start fails.
17. Verifies `GET http://localhost:3210/api/health`.
18. Opens `http://localhost:3210`.

## Lock Hardening

- Hidden launcher metadata now writes only to `logs/runtime/gateway-start.log`.
- Gateway stdout remains `logs/runtime/gateway-out.log`.
- Gateway stderr remains `logs/runtime/gateway-error.log`.
- The launcher never appends to `gateway-out.log` after handing it to the Node process.
- Log write failures are warnings, not install blockers.
- Update copy/delete operations retry five times and report the full path, operation, and likely owner when detectable.

## Validation Performed

- PowerShell syntax check passed for `installer/install.ps1`.
- PowerShell syntax check passed for runtime Windows scripts.
- Hardcoded path scan passed for `installer`, `scripts/windows`, and `shortcuts`.
- `npm test` passed.
- `node tests\windows\runtime-service-tests.js` passed.
- `node tests\live\runtime-acceptance-test.js` passed against the local gateway.
- `scripts\windows\start-gateway-hidden.ps1` started the local gateway and wrote startup metadata to `gateway-start.log`.
- `scripts\windows\status-gateway.ps1` reported healthy while running and stopped after shutdown.
- `scripts\windows\stop-gateway.ps1` released port 3210 and removed the PID file.
- `pack.ps1` passed and rebuilt `whatsapp-ai-gateway-v1.0.0.zip`.
- Production source package excludes runtime artifacts, backup configs, screenshots, secrets, `.env`, and runtime DB files.
- Production source package includes `node_modules`.
- Installer includes portable Node.js and bundled Chrome.
- Offline smoke test passed with bundled Node.js, bundled Chrome, `sqlite3`, and `puppeteer`.
- Normal runtime smoke passed: port 3210 listening, `/api/health` OK, `Gateway Status` shows `RUNNING`, WhatsApp ready.
- `whatsapp-ai-gateway-windows-installer.zip` rebuilt after final lock hardening.

## Clean Laptop Validation Required

On a clean Windows profile:

1. Unzip `whatsapp-ai-gateway-windows-installer.zip`.
2. Double-click `installer\Install WhatsApp AI Gateway.bat`.
3. Confirm dashboard opens.
4. Confirm desktop shortcuts work.
5. Reboot.
6. Confirm the gateway autostarts.

See `docs/CLEAN_LAPTOP_INSTALL_VALIDATION.md` for the full required matrix.

## Success Definition

A non-dev user can install and start the system by double-clicking one BAT file.
