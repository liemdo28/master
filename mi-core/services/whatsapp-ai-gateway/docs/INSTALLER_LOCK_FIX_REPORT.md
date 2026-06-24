# Installer Lock Fix Report

Date: 2026-06-05

## Fixed Failure

Clean laptop install failed because `scripts/windows/start-gateway-hidden.ps1` appended startup metadata to `logs/runtime/gateway-out.log` after the gateway process was started with that same file redirected as stdout.

## Runtime Log Split

- Gateway stdout: `logs/runtime/gateway-out.log`
- Gateway stderr: `logs/runtime/gateway-error.log`
- Startup script metadata: `logs/runtime/gateway-start.log`
- Watchdog metadata: `logs/runtime/watchdog.log`

`start-gateway-hidden.ps1` may write only to `gateway-start.log`. It does not call `Add-Content` on `gateway-out.log`.

## Non-Fatal Logging

Startup log writes are wrapped in `Write-StartLog`. If `gateway-start.log` is locked, the launcher attempts a timestamped `gateway-start-YYYYMMDD-HHMMSS.log`. If that also fails, it prints a warning and continues.

If redirected stdout/stderr files are locked before process start, the launcher retries process start using timestamped `gateway-out-YYYYMMDD-HHMMSS.log` and `gateway-error-YYYYMMDD-HHMMSS.log`.

## Startup Criteria

Startup checks now use:

1. PID file written atomically through temp file rename.
2. Process is still running after launch.
3. Port 3210 starts listening.
4. `GET /api/health` returns `ok=true`.

Logging success is not a startup criterion.

## Installer Behavior

- Scheduled task install failures are warnings.
- A Startup folder shortcut fallback is created when scheduled task registration fails.
- Hidden gateway start failures print the exact exit code.
- The installer attempts a visible foreground fallback using bundled Node.
- Health check failures print troubleshooting commands and preserve the install folder.

## Update Lock Handling

Installer copy/delete/overwrite operations now retry five times with one second between attempts. On final failure, the installer reports:

- operation
- full path
- likely owner when detectable
- original Windows error

## Dev Validation

- `npm test`: PASS
- `node tests\windows\runtime-service-tests.js`: PASS
- `node tests\live\runtime-acceptance-test.js`: PASS
- `powershell -File .\scripts\windows\start-gateway-hidden.ps1`: PASS
- `powershell -File .\scripts\windows\status-gateway.ps1`: PASS
- `powershell -File .\scripts\windows\stop-gateway.ps1`: PASS
- `powershell -File .\pack.ps1`: PASS

Clean laptop install and reboot validation remain required before final release approval.
