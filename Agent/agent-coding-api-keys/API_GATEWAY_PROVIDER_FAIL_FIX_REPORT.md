# API Gateway Provider Fail Fix Report

Generated: 2026-06-02

## Scope

Bug: gateway could fail provider routing for `claude-opus-4-7` even while STANDARD `claude-opus-4.6` quota remained available.

## Root Cause

- OpusMax model mapping could route Opus 4.7/4.8 requests to an unavailable/locked premium model instead of the available STANDARD family model.
- Upstream 401/403 errors were classified as `auth_failed` before model/tier compatibility text was checked.
- Router failure handling could penalize provider/key health for model compatibility errors, causing repeated generic provider failures.

## Changes

- Added detailed provider model resolution with visible reasons:
  - `claude-opus-4-7 -> claude-opus-4.6`
  - `claude-opus-4-8 -> claude-opus-4.6`
  - reason: `standard_tier_downgrade`
- Added allowed-model diagnostics per provider.
- Added upstream error categories:
  - `model_locked`
  - `model_not_allowed`
  - `request_schema_error`
  - `sse_tool_unsupported`
- Changed key/provider health policy:
  - `model_locked` and `model_not_allowed` do not disable the key.
  - `model_locked` and `model_not_allowed` do not trip provider health.
  - `auth_failed`, real quota exhaustion, and transport failures still follow health/cooldown policy.
- Added `GET /api/providers/diagnostics`.
- Added focused policy tests in `tests/provider-fallback-policy.mjs`.

## Verification

- Build:
  - `node .\node_modules\typescript\bin\tsc`
  - Result: PASS
- Policy tests:
  - `node tests\provider-fallback-policy.mjs`
  - Result: PASS
- Smoke test:
  - 20 requests to `/v1/chat/completions`
  - requested model: `claude-opus-4-7`
  - result: `20/20 OK`
  - returned model: `Claude Opus 4.6`
  - unexpected failures: `0`
- Direct OpusMax primary test:
  - forced active provider to `opusmax`
  - OpusMax returned `provider_down` with explicit upstream reason
  - gateway fell back cleanly to `antigravity`
  - final request result: OK, model `Claude Opus 4.6`
  - provider mode restored to `assisted-auto`
- Post-restart smoke:
  - PM2 restarted gateway
  - PID: `33060`
  - request `claude-opus-4-7` returned OK, model `Claude Opus 4.6`

## Diagnostics Evidence

`GET /api/providers/diagnostics?model=claude-opus-4-7` shows:

- `opusmax.allowedModels`: `["claude-opus-4.6", "claude-opus-4"]`
- `opusmax.requestedModel`: `claude-opus-4-7`
- `opusmax.resolvedModel`: `claude-opus-4.6`
- `opusmax.resolutionReason`: `standard_tier_downgrade`
- `opusmax.quotaRemaining`: `800`
- `opusmax.healthStatus`: `ACTIVE`
- `opusmax.circuitBreaker`: `closed`
- `opusmax.nextRetryTime`: `null`

## Known External Status

- Gateway port audit: `agent-coding-api-keys` on port `3456` PASS.
- Full-system port audit still FAILS because `agent-control` on port `3700` is registered active but not listening. That is outside this provider-routing bugfix.

