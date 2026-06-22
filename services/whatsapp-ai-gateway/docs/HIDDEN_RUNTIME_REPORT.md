# Hidden Runtime Report

Date: 2026-06-05

## Added

`scripts/windows/start-gateway-hidden.ps1`

Behavior:

- checks port 3210
- refuses duplicate process
- starts `node src/index.js` hidden through bundled `runtime/node/node.exe` when present
- writes PID atomically to `data/runtime/gateway.pid`
- redirects gateway stdout to `logs/runtime/gateway-out.log`
- redirects gateway stderr to `logs/runtime/gateway-error.log`
- writes launcher metadata only to `logs/runtime/gateway-start.log`
- uses timestamped fallback logs when primary redirected logs are locked
- checks `/api/health` after startup
- treats log write failures as warnings instead of startup blockers

Stop/status scripts:

- `scripts/windows/stop-gateway.ps1`
- `scripts/windows/status-gateway.ps1`

Double-click BAT files are under `shortcuts/`.

## Stop Behavior

`scripts/windows/stop-gateway.ps1` now:

1. Reads `data/runtime/gateway.pid`.
2. Stops that process when alive.
3. Stops only bundled/project Chrome processes whose command line contains the project or runtime path.
4. Waits three seconds.
5. Confirms port 3210 is free.
6. Force-stops project Node processes only if the port remains active.
7. Deletes the PID file only after the port is clear.

## Live Status

After restart, `/api/health` reports:

- WhatsApp: `ready`
- Build ID: `202606050136-e06e26c`
- Template Count: `19`
- Dashboard Ready: `true`

This earlier live status predates final lock hardening. Re-run clean laptop install and reboot validation before final release.
