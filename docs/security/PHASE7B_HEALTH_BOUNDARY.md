# Phase 7B — Health Boundary

Date: 2026-08-13

Phase 7B adds **health visibility**. It does not add, widen, or imply any new
**recovery authority**. This document states the boundary and how it's
enforced — not just documented — matching the pattern established by
[`PHASE6F_SIMULATION_BOUNDARY.md`](PHASE6F_SIMULATION_BOUNDARY.md).

## The rule

> Do not confuse health visibility with recovery authority.

Everything under `server/src/health-truth/` is **observe-only**: it reads
state and reports it. It never starts, stops, restarts, or kills a process,
never writes to a database, and never mutates any existing store.

## Structural enforcement, not a promise

1. **No mutation-capable import anywhere in the module.** `probes.ts` and
   `aggregate.ts` import zero exec/process-control primitives. Verified by an
   automated source-text scan (`phase7b-health-truth-security.test.ts` group
   1, and re-checked independently by `phase7b-acceptance.ts` point 9) that
   fails the build if `child_process`, `pm2 restart`, `pm2 stop`, `pm2
   start`, or `require('pm2')` ever appears in either file.
2. **Read-only imports from SelfHeal, explicitly.** `probes.ts` imports only
   `getLastScanResults`, `checkPm2Service`, and `MONITORED_SERVICES` from
   `self-healing-monitor.ts` — never `restartPm2Service` or
   `startSelfHealingMonitor`. SelfHeal's own existing narrow recovery
   behavior (already frozen from earlier phases) is untouched; Phase 7B adds
   no new service-start/restart authority to it or to anything else.
3. **No client input reaches the computed state.** Neither router reads
   `req.query`, `req.body`, or `req.params` — a health route that let a
   caller influence the reported state would be a forged-state vector by
   construction. Proven both structurally (source-text scan) and live: a
   request to `/api/health/detail?overall=HEALTHY&dependencies=[]` returns
   the real, unmodified computed state (`test:health-truth-security`).
4. **No mutation UI.** `HealthPage.tsx` contains zero buttons, zero
   `onClick` handlers, zero `api.post`/`patch`/`del` calls. No "Restart All,"
   no "Start Service" — checked by both a unit test and a structural
   acceptance point, not by inspection alone.

## Auth layering

- `GET /api/health` — **public**, unauthenticated. Deliberately cheap: it
  only probes AI-service/Ollama reachability with a bounded 5s timeout each,
  never the full 13-dimension sweep (no authority-manifest scan, no DB read).
- `GET /api/health/detail` and `GET /api/health/dependencies` —
  **authenticated**. Mounted behind `requireRemoteAuth` (Command Center's PIN
  session) at `/api/command-center` and `requireTaskRuntimeAuth` (raw API
  key) at bare `/api` — the same two middlewares, same order, as every other
  gated router in this codebase. No bespoke, weaker auth check was written
  for health.
- Verified live: unauthenticated requests to either detailed route → `401`;
  a wrong API key → `401` (not merely "no key" → the credential is actually
  checked, not just its presence).

## Configuration health: names, never values

`probes.ts` never reads a secret-shaped environment variable
(`MI_CORE_API_KEY`, `GOOGLE_CLIENT_SECRET`, etc.) into a `detail` string —
checked structurally, and live: the detailed-health response body is scanned
for the actual runtime values of `MI_CORE_API_KEY`, `AGENT_CODING_API_KEY`,
`GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `SESSION_SECRET`, for any Windows
absolute path under this project's known drive roots, and for known
secret-token shapes (`sk-…`, `ya29.…`, `AIza…`, `xox[baprs]-…`) across every
string in the response — zero matches required and observed.

## Intentionally-disabled ≠ unhealthy; disconnected connector ≠ system down

Two specific misclassification failure modes are proven, not assumed:

- `probeIntentionallyDisabled()` always reports `INTENTIONALLY_DISABLED`
  regardless of whether the service's runtime code directory happens to
  exist on disk — a missing directory is a separate, pre-existing gap
  (`RUNTIME_NOT_DEPLOYED`), not evidence the disablement itself is a
  failure.
- A `DISCONNECTED` `GOOGLE_CONNECTORS` (Google OAuth is disconnected in this
  environment — confirmed during Phase 6G) can only ever push overall to
  `DEGRADED`, never `UNAVAILABLE`/`BLOCKED` — it is `FEATURE_SCOPED`
  criticality, and only `AUTHORITY`/other `REQUIRED_FOR_CORE` dependencies
  can force those stronger states.

## AUTHORITY's hard rule cannot be softened

`unknownMutations > 0` or `unresolvedLegacyMutations > 0` in the real
authority manifest forces `AUTHORITY` unhealthy, which forces overall
`BLOCKED` — checked **first and separately** in `computeOverall()`, before
any other dependency's state is even considered, so it can never be averaged
away by other dependencies being healthy. A provenance mismatch (deployed SHA
≠ `.env`'s recorded SHA) is folded into the same `AUTHORITY` dimension as
`UNAVAILABLE`/`PROVENANCE_MISMATCH`, never silently degraded to a warning —
this exact path is live in this dev checkout right now (no `.env` here), and
is what the evaluation harness's capability-impact bug (see the Health Truth
Model doc) was caught against.

## The SelfHeal rate-limit false positive — root cause and fix

**Root cause** (confirmed by reading `middleware/rate-limit.ts`):
`isInternalJarvisCall()` only bypasses the global 120-req/60s rate limiter
for `/api/jarvis*` and `/api/mi*` paths. The `evidence-db` and `knowledge-db`
SelfHeal probes used to be `type: 'http'` checks that looped back through
HTTP to mi-core's own `/api/company-os/health` and `/api/personal/integrity`
— routes **not** in that allowlist — so any request burst from anywhere else
competing for the same limiter bucket could starve those self-probes into a
false "DOWN" alert.

**Fix**: both probes are now `type: 'internal'`
(`checkCompanyOsHealthInternal()` / `checkPersonalOsIntegrityInternal()`),
calling the identical underlying logic directly, in-process — no HTTP
request, no rate-limiter interaction, no bucket to exhaust. This is
architecturally stronger than "observed no 429 during a load test": proven
in `test:selfheal-rate-limit-regression` by (1) asserting both entries are
literally `type: 'internal'` with no `health_url`, (2) monkey-patching
`global.fetch` to throw and confirming neither probe ever calls it, and (3)
firing 150 back-to-back calls (exceeding the 120/60s window) and confirming
every one still resolves deterministically.

## SelfHeal action boundary — unchanged

Phase 7B does not add new restart/service-start authority to SelfHeal or
anywhere else. Its existing narrow, already-frozen recovery behavior (from
earlier phases) is untouched. Health-truth's probes read SelfHeal's
observations; they never call its mutation-capable functions.

## Stop conditions this document exists to make checkable

- Health model reporting AUTHORITY healthy while an unknown/unresolved
  mutation exists — structurally impossible per the hard rule above.
- Detailed health becoming unauthenticated — checked live on every test run.
- A health route mutating service state — no mutation-capable import exists
  to do so.
- SelfHeal gaining new broad restart authority — `probes.ts` never imports a
  restart/start function.
