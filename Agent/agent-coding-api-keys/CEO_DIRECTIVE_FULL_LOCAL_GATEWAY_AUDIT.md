# CEO DIRECTIVE — Full Local Gateway Audit & Smooth Cross-Platform Build

Target:
- Local app: http://127.0.0.1:3456/
- Project: Antigravity Universal AI Gateway / API Gateway
- Canonical source: `E:\Project\Master\Agent\agent-coding-api-keys`
- Goal: stable, fast, smooth, no unnecessary quota calls, no duplicate sources/processes, usable on Windows, macOS, and Linux.

Priority:
- P0. Stop quota waste
- P1. Kill duplicate/unused source/processes
- P2. Make app smooth and cross-platform

Hard Rules:
- Do not paste, log, or report raw API keys. Mask keys only.
- Do not run global process-kill commands such as `taskkill /F /IM node.exe`, `killall node`, or broad npm/pnpm/yarn kills.
- Kill only exact PID after confirming port, command line, and project path.
- Do not delete duplicate source folders until backup is created.
- Acceptance means scripts and app run on the CEO machine, not only "looks done".

## 1. Full Source Audit

- Identify entrypoint, server port, frontend, backend, provider router, quota monitor, SSE stream, tool-use bridge.
- Find duplicate folders, old builds, backup files, unused server instances, repeated gateway copies.
- Mark canonical source only.
- Do not delete anything until backup is created.

## 2. Process / Port Cleanup

- Check all running Node/Python/PHP processes related to gateway.
- Check ports:
  - 3456
  - any API/proxy/provider ports
  - old dev server ports
- Kill only duplicate or stale processes.
- Ensure one canonical server owns port 3456.
- Add safe scripts:
  - `npm run ports:check`
  - `npm run ports:kill-stale`
  - `npm run dev:clean`

## 3. Quota Call Optimization

- Audit every place that calls quota/status/provider health.
- Prevent slow repeated quota polling.
- Add cache layer:
  - quota cache TTL: 30-60 seconds
  - provider health cache TTL: 15-30 seconds
  - request logs should not trigger provider quota calls per row
- Never call external quota endpoint on every UI refresh.
- UI may auto-refresh every 30 seconds, but backend must serve cached quota unless forced refresh is requested.

## 4. Provider Failure Logic

- If quota remaining > 0, provider/key must not be marked failed only because requested model is locked or unsupported.
- Distinguish errors:
  - `quota_exhausted`
  - `model_locked`
  - `model_not_allowed`
  - `invalid_key`
  - `timeout`
  - `transport_error`
  - `request_schema_error`
  - `sse_error`
  - `tool_call_error`
- Add clear logs instead of generic `provider: failed`.

## 5. Model Routing Fix

- If requested model is unavailable, downgrade/fallback to supported model.
- Example:
  - `claude-opus-4-7` or `claude-opus-4-8`
  - if locked, resolve to available standard-tier runtime model.
- OpusMax currently requires `gpt-5.4` as the working runtime alias for this key.
- Do not disable whole provider when only one model is locked.

## 6. Smooth UI

- Reduce heavy polling.
- Debounce refresh buttons.
- Add loading state only where needed.
- Do not freeze UI while checking quota.
- Request log table should load fast from local memory/database.
- Provider cards should show:
  - provider status
  - quota cached time
  - last success
  - last failure reason
  - current resolved model

## 7. Cross-Platform Support

- Must run on:
  - Windows
  - macOS
  - Linux
- No hardcoded `/usr/bin`, `/Volumes`, `C:\`, or shell-only commands in core app.
- Use Node `path`, `os`, `process.platform`.
- Provide scripts:
  - `start`
  - `dev`
  - `build`
  - `health`
  - `doctor`
  - `clean`
- Windows scripts must work in PowerShell.
- macOS/Linux scripts must work in bash/zsh.

## 8. Add Doctor Command

Create:

```bash
npm run doctor
```

It must check:
- Node version
- npm version
- required env vars
- port 3456 availability
- duplicate gateway processes
- provider config loaded
- database/file permissions
- quota cache status
- OS compatibility

## 9. Add Health Endpoints

Create or verify:

```txt
GET /health
GET /api/health
GET /api/providers/status
GET /api/providers/diagnostics
GET /api/runtime/ports
GET /api/runtime/processes
```

Diagnostics must show:
- provider
- masked key
- allowed models
- requested model
- resolved model
- quota remaining
- quota cached_at
- last_error_code
- last_error_message
- health status
- next_retry_at

## 10. Build / QA

Run full test:
- Start from clean boot.
- Open http://127.0.0.1:3456/
- Send 20 requests.
- Confirm:
  - no unexpected failed provider
  - quota decreases correctly
  - no quota call on every UI refresh
  - only one server process
  - port 3456 stable
  - SSE streaming works
  - tools mode works
  - fallback works
  - app does not lag

## Deliverables

- `AUDIT_REPORT.md`
- `FIX_REPORT.md`
- `PORT_PROCESS_REPORT.md`
- `QUOTA_OPTIMIZATION_REPORT.md`
- `CROSS_PLATFORM_RUNBOOK.md`
- Updated scripts in `package.json`
- Screenshots of:
  - dashboard
  - diagnostics
  - doctor command
  - successful request logs

## Acceptance Criteria

- Local app runs smoothly at http://127.0.0.1:3456/.
- No duplicate gateway source/process keeps running.
- Quota checks are cached and fast.
- Provider with remaining quota does not fail incorrectly.
- Works on Windows, macOS, Linux.
- Dev can start app with one command:
  - `npm run dev`

