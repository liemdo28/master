# Company OS Wiring + Phase 2D+ Hardening — Runtime Proof Report

Generated: 2026-06-28
Scope: Make the already-built Company OS phases reachable through the live server, and
close the Phase 2D+ production-automation gap (Session Vault, MFA Handoff, durable
token persistence).

## Summary

| Workstream | Result |
|---|---|
| Phase 5–9 divisions wired into server (`/api/divisions`) | ✅ 28/28 HTTP runtime tests |
| Phase 12–20 agent-engine exposed in server (`/api/agent-os`) | ✅ 36/36 HTTP runtime tests |
| Phase 2D+ hardening (Vault + MFA + durable persistence) | ✅ 33/33 runtime tests |
| Regression: Phase 5–9 unit runtime tests | ✅ 57/57 |
| Regression: Phase 2D runtime test | ✅ 35/35 |
| Regression: Phase 12–20 agent-engine runtime proofs | ✅ 207/207 |
| Server `tsc --noEmit` | ✅ 0 errors |

**New tests this change: 97. Total verified across touched surface: 396.**

## 1. Phase 5–9 Divisions — Server Wiring

The Phase 5–9 division engines (IT Operations, Creative, Data Platform, Intelligence,
Autonomy) were fully implemented and unit-tested but unreachable — never mounted on the
server. Added `mi-core/server/src/routes/company-divisions.ts` and mounted it at
`/api/divisions` (auth-gated) in `server/src/index.ts`.

Endpoints:
- `GET  /api/divisions` — overview of all 5 divisions (phase, name, status, warning count)
- `GET  /api/divisions/:division` — full dashboard (it | creative | data-platform | intelligence | autonomy)
- `GET  /api/divisions/intelligence/ask?q=…` — Phase 8 cross-division question
- `POST /api/divisions/:division/bootstrap` — registers objective + task + evidence via Executive Coordination

Proof: `tests/divisions-router-runtime-test.mjs` mounts the compiled router on an ephemeral
Express app and exercises every endpoint over real HTTP (28/28).

## 2. Phase 12–20 Agent-Engine — Server Exposure

The Phase 12–20 orchestrators live at repo-root `agent-engine/` as ES modules; the server
is CommonJS. Added `mi-core/server/src/routes/agent-os.ts`, mounted at `/api/agent-os`,
which loads each ESM orchestrator via a real dynamic `import()` (preserved through the
CommonJS transpile with a `new Function('p','return import(p)')` escape hatch), instantiates
it against an isolated temp data dir, and returns a read-only live summary.

Endpoints:
- `GET /api/agent-os` — loads all 9 phases, reports loadability + each orchestrator's public API
- `GET /api/agent-os/:phase` — live summary (12 scorecard · 13 scorecard · 14 pending ·
  16 fleetReport · 17 crossCompanyReport · 18 stats · 20 dashboard)

Proof: `tests/agent-os-router-runtime-test.mjs` (36/36) — all 9 phases load from ESM and
summarize over HTTP, including the capstone Phase 20 CEO dashboard (posture + kill-switch).

## 3. Phase 2D+ Hardening

Phase 2D shipped the decision/audit gate but deferred three items to "2D+". All three are
now implemented in `mi-core/server/src/production-approval/`, leaving the original 2D module
untouched (its 35 tests still pass).

- **Session Vault** (`session-vault.ts`) — credentials encrypted at rest with AES-256-GCM
  (scrypt-derived key from `MI_VAULT_KEY`, per-vault random salt). Only opaque handles are
  exposed; `list()` returns metadata only; plaintext never persisted. Verified: the plaintext
  is absent from the on-disk file, a wrong key fails GCM auth, scope-bound redemption.
- **MFA Handoff** (`mfa-handoff.ts`) — grant requires a 6-digit challenge bound to
  request + approver, single-use, short-lived; only a salted SHA-256 hash of the code is stored.
- **Durable persistence** (`durable-store.ts`) — requests, tokens, MFA challenges, audit log,
  and vault survive process restart (the gap left by 2D's in-memory Maps).
- **Hardened gateway** (`hardened-gateway.ts`) — composes the three while re-proving every 2D
  guarantee: single-use, short-lived, scope-bound, audited tokens. On ALLOW it redeems the
  bound credential and returns a **masked reference** (`vault:HANDLE#fingerprint`), never plaintext.

Proof: `tests/phase2dplus-hardening-runtime-test.mjs` (33/33). No production system is touched.

## Files changed

- `mi-core/server/src/routes/company-divisions.ts` (new)
- `mi-core/server/src/routes/agent-os.ts` (new)
- `mi-core/server/src/production-approval/durable-store.ts` (new)
- `mi-core/server/src/production-approval/session-vault.ts` (new)
- `mi-core/server/src/production-approval/mfa-handoff.ts` (new)
- `mi-core/server/src/production-approval/hardened-gateway.ts` (new)
- `mi-core/server/src/index.ts` (mount `/api/divisions`, `/api/agent-os`)
- `mi-core/server/tsconfig.phase2d.json` (fix invalid `ignoreDeprecations` value)
- `mi-core/tests/divisions-router-runtime-test.mjs` (new)
- `mi-core/tests/agent-os-router-runtime-test.mjs` (new)
- `mi-core/tests/phase2dplus-hardening-runtime-test.mjs` (new)

## How to reproduce

```bash
cd mi-core/server && npx tsc                       # build (0 errors)
cd mi-core
node tests/divisions-router-runtime-test.mjs       # 28/28
node tests/agent-os-router-runtime-test.mjs        # 36/36
node tests/phase2dplus-hardening-runtime-test.mjs  # 33/33
```
