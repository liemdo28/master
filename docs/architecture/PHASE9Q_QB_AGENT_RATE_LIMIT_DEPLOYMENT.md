# Phase 9Q — QB-Agent Rate-Limit Bypass Deployment

**Status: DEPLOYED AND VERIFIED.** Deploys the reviewed, merged rate-limit bypass fix ([#152](https://github.com/liemdo28/master/pull/152)) to the running `mi-core` production process via a single controlled restart, and confirms the fix resolves the real 429 storm affecting the laptop1 QB agent.

## A. Background

During Phase 9P's real laptop1 E2E follow-up, Dev1 confirmed the agent successfully reaches `POST /api/qb-agent/ingest` (the Phase 9O fix), but reported that `register`, `heartbeat`, `ingest`, and command polling were now hitting `429 Too many requests` instead of the earlier `409`/`404`. Investigation of `reports/evidence/knowledge-rate-limit/runtime-429-audit.jsonl` found **565,147 throttled requests over 14 days** (2026-08-13 onward, predating Phase 9O entirely), 95% on `/qb-agent/heartbeat`, all from the laptop1 agent's Tailscale IP. Root cause: the global rate limiter's internal-key bypass (`isInternalJarvisCall()`) was scoped only to `/api/jarvis` and `/api/mi` — `/api/qb-agent` was never included, so an authenticated agent shared the same 120-req/60s bucket as any unauthenticated caller on its IP.

Two separate tracks were authorized: (1) report the excessive retry volume to Dev1 for an agent-side backoff fix (root cause, tracked separately), and (2) extend the server-side bypass so a well-behaved authenticated call is never throttled in the first place (this deployment).

## B. Pre-deploy state

| Item | Value |
|---|---|
| `origin/master` | `aa8760d87ccfa8a8d59731a3704ed3e3b0e67d21` (confirmed fresh) |
| Working tree | clean |
| Deployed SHA before this phase | `32024dc5a032d17e11a23b128fc6ed6613bcb694` (Phase 9O) |
| `mi-core` PID / restart_time before | `20452` / `0` (post-host-reboot baseline) |
| Health | `HEALTHY` |
| DB integrity | all 4 canonical DBs `ok`, 0 FK violations |

## C. Exact deployment delta

`git log 32024dc5..aa8760d8` — exactly 2 commits (`f137ec7e` + its merge), touching exactly one file: `server/src/middleware/rate-limit.ts` (+17/-3). No unrelated commit exists in this range.

## D. Pre-deploy validation

Validated in an isolated scratch copy (deployed `node_modules` + reviewed worktree source, robocopied to a temp directory — production was never touched during this validation pass, after an earlier mistake in this same session where a validation copy was briefly applied directly to the live deployed tree and immediately reverted before any restart occurred):

| Gate | Result |
|---|---|
| `npx tsc` | Clean |
| `authority:manifest:check` | PASS, counts identical to Phase 9O (`total=1073`, `unknownMutations=0`, `unresolvedLegacyMutations=0`) — expected, rate-limiting is a separate layer from authority classification |
| `phase8a-security.test.ts` | PASS — `financialExecutionReachable: 0` |
| `selfheal-rate-limit-regression.test.ts` | PASS — 3/3 |
| `self-healing-probe.test.ts` | PASS |
| `self-healing-restart-authority.test.ts` | PASS — 14 invariants |
| Secret scan | no matches |

## E. Deploy procedure

Same established convention as Phase 9P: predeploy backup (`mi-core-production-backups/phase9q-ratelimit-predeploy-20260827-060252/`), new immutable source snapshot built via `build-snapshot-cli.ts --sha=aa8760d8... ` (833 files, checksum `78fc5969f55caccf7853fd493617924945238b44bbace2b41c7d36c98429860e`), source copied into `F:/Projects/mi-core/server/src`, `dist/` rebuilt via `npx tsc`, `.env` `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` updated, then `pm2 restart mi-core` only.

## F. Restart evidence

| | Before | After |
|---|---|---|
| PID | `20452` | `12360` |
| `restart_time` | `0` | `1` (exactly +1) |

All other PM2 processes (`pm2-logrotate`, `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`, `ollama`) retained `restart_time=0`, unchanged.

## G. Post-deploy verification

- Health: `HEALTHY` immediately after restart and after the burst test below.
- DB integrity: unchanged, clean.
- Quarantine boundary unaffected: `POST /api/qb-agent/event` still returns `409 LEGACY_AUTHORITY_QUARANTINED` — confirms the rate-limit fix did not touch the separate authority boundary.
- **Fix confirmed working:** fired 150 rapid authenticated `POST /api/qb-agent/heartbeat` calls (well beyond the 120/60s limit) via a single Node process (avoiding per-call shell fork overhead) using safe validation telemetry (`machine_id: "phase9q-ratelimit-probe"`). Result: **150/150 returned `200`** — zero `429`s. Before this fix, the same burst would have started returning `429` after the 120th request.

## H. Rollback status

**Not needed.** No rollback criterion was met. Artifact preserved at `mi-core-production-backups/phase9q-ratelimit-predeploy-20260827-060252/` if ever needed: restore its `dist/`, `rate-limit.ts`, and `.env` lines, then `pm2 restart mi-core` only.

## I. Remaining track (unchanged from Phase 9P)

The agent-side retry/backoff root cause has **not** been fixed by this deployment — this phase only removes the case where a *correctly-behaved* authenticated call gets throttled. Dev1 is separately addressing why the agent was retrying `heartbeat` far beyond any reasonable cadence for 14 days. If that root cause isn't fixed, the agent could still generate very high request volume — it will now succeed instead of being rejected, but excessive polling remains an efficiency/robustness concern on the agent side, not a server-side authority or rate-limit gap anymore.

## Final classification

```
PHASE9Q_STATUS:            DEPLOYED_AND_VERIFIED
PRE_DEPLOYED_SHA:          32024dc5a032d17e11a23b128fc6ed6613bcb694
DEPLOYED_SHA:              aa8760d87ccfa8a8d59731a3704ed3e3b0e67d21
MI_CORE_RESTART_DELTA:     +1 (0 -> 1), PID 20452 -> 12360
OTHER_PM2_RESTART_DELTA:   0
BURST_TEST:                150/150 authenticated heartbeat calls returned 200 (previously would 429 past 120)
QUARANTINE_BOUNDARY:       unaffected — /api/qb-agent/event still 409
AUTHORITY_COUNTS:          unchanged from Phase 9O (total=1073, unknownMutations=0, unresolvedLegacyMutations=0)
DB_INTEGRITY:              clean, unchanged
ROLLBACK_STATUS:           NOT NEEDED — artifact preserved
PRODUCTION_STATUS:         DEPLOYED, HEALTHY, STABLE
```

## Recommendation

No further action needed server-side for this specific 429 issue. Awaiting Dev1's agent-side retry/backoff fix as the remaining, separately-tracked item.
