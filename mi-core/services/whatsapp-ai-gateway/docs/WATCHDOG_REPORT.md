# Watchdog Report

Date: 2026-06-05

## Added

`scripts/windows/watchdog.ps1`

Behavior:

- checks port 3210
- checks `/api/health`
- restarts gateway with `start-gateway-hidden.ps1` if down
- logs to `logs/runtime/watchdog.log`

The watchdog can be registered as a second scheduled task if desired.

## Verification

The watchdog uses the same hidden start script and checks both:

- port 3210 listener
- `/api/health`

Logs are written to `logs/runtime/watchdog.log`.
