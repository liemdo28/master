# Phase 9P — Controlled QB-Agent Production Deployment + Laptop1 E2E

**Status: DEPLOYED AND SERVER-SIDE VERIFIED. Real laptop1 agent E2E is pending Dev1's own action, not yet observed.** This phase deployed the already-reviewed, already-merged Phase 9O code (`master` `32024dc5a032d17e11a23b128fc6ed6613bcb694`) to the running `mi-core` production process via a single controlled restart, and verified the three approved QB-agent surfaces work end-to-end from the server side, with every frozen authority/financial-safety invariant intact.

## A. Pre-deploy state (frozen starting point)

| Item | Value |
|---|---|
| `origin/master` | `32024dc5a032d17e11a23b128fc6ed6613bcb694` (confirmed fresh, unmoved) |
| Working tree | clean |
| Deployed SHA before this phase | `2bd6752ef132bca37318f37fe73ddad26e91fac5` |
| `mi-core` PID / restart_time before | `26484` / `10` |
| Health | `HEALTHY` (`server:ok`, `python_ai_service:ok`, `ollama:ok`) |
| Schema | `v10` |
| Authority manifest (against then-current deployed code) | `authority:manifest:check` PASS |
| DB integrity | `personal-os.db`/`tasks.db`/`projects.db`/`knowledge.db` — all `ok`, 0 FK violations |
| Disk free space | 506 GB on `F:` |

## B. Exact deployment delta

`git log 2bd6752e..32024dc5` enumerates 22 commits: 21 are docs-only (Phase 9G through 9N discovery/closure documents) and exactly **one** functional commit, `f18c1e50` (the reviewed Phase 9O change), touching only:

- `server/src/authority-control-plane/registry.ts` (+23)
- `server/src/routes/qb-agent.ts` (+38/-5)
- `server/src/routes/qb-financial.ts` (+5)

No unrelated, unreviewed functional commit exists in this range. This worktree's tree hash was confirmed byte-identical to `origin/master`'s tree hash before proceeding.

## C. Pre-deploy validation (against the exact artifact deployed)

All gates run against the deployed-tree copy of the exact reviewed code (validated twice — once pre-merge, once here against the true merged artifact):

| Gate | Result |
|---|---|
| `npx tsc` (full build, not `--noEmit`) | Clean, zero errors |
| `npm run authority:manifest` + `--check` | PASS |
| `authority-control-plane.test.ts` | PASS |
| `legacy-authority-adapters.test.ts` | PASS — owner `QB Agent Machine Registry`: 3 surfaces |
| `self-healing-restart-authority.test.ts` (Phase 9A governance regression) | PASS — 14 invariants |
| `phase7c-legacy-mutation-scan.test.ts` | PASS — 40/40 |
| `phase7g-legacy-authority-scan.test.ts` | PASS — 50/50 |
| `phase7c-legacy-containment.test.ts` | PASS — 4/4 |
| `phase8b-legacy-retirement.test.ts` | PASS |
| `phase8a-security.test.ts` | PASS — `financialExecutionReachable: 0` |
| `qb-online-watcher-idempotency.test.ts` | PASS — 12 invariants |
| Secret scan (3 changed files) | no matches |
| `ActionType` count | 7 (unchanged) |
| DB integrity | unchanged, clean |

Required invariants confirmed: `unknownMutations=0`, `unresolvedLegacyMutations=0`, `financialExecutionReachable=0`, `schema=v10`, `ActionType=7`.

## D. Deploy procedure (this repo's established convention)

1. **Predeploy backup** — `F:/Projects/D-root-mi-snapshots/mi-core-production-backups/phase9o-predeploy-20260826-070050/` — captured the pre-deploy `dist/`, the 3 pre-Phase-9O source files, `authority-manifest.json`, and the `.env` deploy-tracking lines (`MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT`).
2. **Built a new immutable deploy-owned source snapshot** via `server/src/authority-control-plane/build-snapshot-cli.ts`, run from this reviewed worktree (never the messy production checkout, per the tool's own contract): `--sha=32024dc5a032d17e11a23b128fc6ed6613bcb694 --dest-base=F:\Projects\D-root-mi-snapshots\mi-core-deployed-source`. Result: 833 files, `treeChecksum=05426cea585cbc3cfcb344ae1151df0fac97ad8c95a460a15f4fdc813bf0160c`.
3. Copied the 3 reviewed source files into `F:/Projects/mi-core/server/src/...`, restored `tsconfig.json` (needed for the documented `npx tsc` rebuild step; its absence in the deployed tree appears to be prior drift, not a deliberate omission).
4. Rebuilt `dist/` in place via `npx tsc` (clean, zero errors); confirmed the built `dist/routes/qb-agent.js` and `dist/authority-control-plane/registry.js` contain the new code.
5. Updated `F:/Projects/mi-core/.env`: `MI_DEPLOYED_SOURCE_SHA` and `MI_DEPLOYED_SOURCE_ROOT` → the new SHA/snapshot path.
6. Simulated the exact boot-time authority resolution (`resolveAuthorityRepoRoot()` against the live `.env`) before restarting — confirmed it resolves to the new snapshot, verifies its checksum, and `assertAuthorityManifest` passes with the expected counts.
7. Restarted **`mi-core` only** via `pm2 restart mi-core`.

## E. Restart evidence

| | Before | After |
|---|---|---|
| PID | `26484` | `27264` |
| `restart_time` | `10` | `11` (exactly +1) |

All other PM2 processes retained their exact pre-deploy `restart_time`: `pm2-logrotate=0`, `mi-ai-service=0`, `mi-accounting=4`, `qb-ops-agent=3`, `mi-node-agent=0`, `ollama=0`. No restart loop — `mi-core` uptime grew normally through a ~90-second observation window with `restart_time` unchanged at `11`.

## F. Immediate post-restart verification

- `mi-core` online, health `HEALTHY` (`server:ok`, `python_ai_service:ok`, `ollama:ok`)
- DB integrity: all 4 canonical DBs `ok`, 0 FK violations
- Schema: `v10`, unchanged
- Authority counts (regenerated against the running deployment): `total:1073, mutations:394, adaptedLegacy:10, quarantinedLegacy:165, unknownMutations:0, unresolvedLegacyMutations:0`
- `financialExecutionReachable: 0` (re-run `phase8a-security.test.ts` against the deployed artifact)

## G. QB-agent route verification (approved surfaces)

Tested with safe, clearly-labeled validation telemetry (`machine_id: "phase9p-validation-probe"`) via the existing `X-API-Key` mechanism — no financial data, no external side effects:

| Route | Result | Persisted to |
|---|---|---|
| `POST /api/qb-agent/register` | `200 {"ok":true,...}` | `machines` table, confirmed row |
| `POST /api/qb-agent/heartbeat` | `200 {"ok":true,...}` | `heartbeats` table, confirmed row |
| `POST /api/qb-agent/ingest` | `200 {"ok":true,...}` | `events` table, confirmed row |

None returned `409 LEGACY_AUTHORITY_QUARANTINED`.

## H. Negative authority tests

| Test | Result |
|---|---|
| `POST /api/qb-agent/commands` (inert probe, not a real dispatchable command) | **409 LEGACY_AUTHORITY_QUARANTINED** — still blocked, intercepted before the handler |
| `POST /api/qb-agent/event` | **409 LEGACY_AUTHORITY_QUARANTINED** — still blocked |
| `POST /api/qb/ingest` | **404 Cannot POST** — still unavailable, unchanged from before Phase 9O |
| `GET /api/qb/status` | `503 QB agent unreachable` — the GET-only proxy still functions correctly (attempts the real laptop1 connection and reports its actual unreachable state; this is the pre-existing, unrelated condition of the remote agent, not a routing regression) |

No authority was accidentally widened. `/api/qb` remains GET-only.

## I. Laptop1 E2E — honest status

Read-only query of `qb-agent.db` found **no existing rows for `machine_id='qb-laptop-01'`** — consistent with register/heartbeat having been blocked (409) the entire time before this deploy, so the real agent never got far enough to persist anything. Server-side readiness for the real agent is now fully confirmed (Sections G/H), but the actual triggering of a real request from Dev1's laptop1 device is an action on a separate physical machine that this phase cannot itself produce or observe. **This document does not claim to have observed a real laptop1-initiated request.** That remains Dev1's next action: point the agent at `POST /api/qb-agent/ingest` (not `/api/qb/ingest`) and retry register/heartbeat/ingest/command-polling.

## J. Rollback status

**Not needed.** No rollback criterion was met (`mi-core` started cleanly, health stayed HEALTHY, no restart loop, no authority/financial invariant changed unexpectedly, DB integrity unchanged, approved routes behaved safely). The rollback artifact remains preserved at `F:/Projects/D-root-mi-snapshots/mi-core-production-backups/phase9o-predeploy-20260826-070050/` if ever needed later: restore its `dist/`, 3 source files, and `.env` lines, then `pm2 restart mi-core` only.

## K. Explicit boundaries respected

- No other PM2 process was restarted (`qb-ops-agent`, `mi-accounting`, and all others untouched).
- No PM2 ecosystem configuration changed.
- No Windows audit policy, Security log configuration, or Sysmon change.
- No schema change.
- No env/API key value changed (only the two deploy-tracking pointer lines, `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT`).
- No routing change beyond the exact reviewed Phase 9O diff.
- No additional authority surface unquarantined.
- The validation test data (`phase9p-validation-probe`) is clearly labeled, non-financial, and left in place in `qb-agent.db` as an ordinary telemetry row (not cleaned up, since it is harmless local test data indistinguishable in kind from real agent telemetry, and deleting rows was not authorized by this phase).

## Final classification

```
PHASE9P_STATUS:                       CODE_DEPLOYED_SERVER_VERIFIED
PRE_DEPLOYED_SHA:                     2bd6752ef132bca37318f37fe73ddad26e91fac5
TARGET_MASTER_SHA:                    32024dc5a032d17e11a23b128fc6ed6613bcb694
DEPLOYED_SHA:                         32024dc5a032d17e11a23b128fc6ed6613bcb694
BUILD_VALIDATION:                     PASS (tsc clean, all listed test suites PASS)
AUTHORITY_COUNTS:                     total=1073 mutations=394 adaptedLegacy=10 quarantinedLegacy=165
UNKNOWN_MUTATIONS:                    0
UNRESOLVED_LEGACY_MUTATIONS:          0
FINANCIAL_EXECUTION_REACHABLE:        0
SCHEMA:                               v10
ACTIONTYPE:                           7
MI_CORE_RESTART_DELTA:                +1 (10 -> 11), PID 26484 -> 27264
OTHER_PM2_RESTART_DELTA:              0 (all unchanged)
REGISTER_RESULT:                      200 OK, persisted
HEARTBEAT_RESULT:                     200 OK, persisted
INGEST_RESULT:                        200 OK, persisted
QB_POST_INGEST_NEGATIVE_TEST:         404 (unavailable, confirmed)
QUARANTINED_ROUTE_NEGATIVE_TESTS:     409 for commands + event (confirmed still blocked)
LAPTOP1_E2E:                          SERVER_READY_PENDING_REAL_AGENT_TEST (not yet observed — requires Dev1 to point the real agent at /api/qb-agent/ingest and retry)
DB_INTEGRITY:                         clean, unchanged
ROLLBACK_STATUS:                      NOT NEEDED — artifact preserved
CLOSURE_PR:                           (see PR link once opened)
PRODUCTION_STATUS:                    DEPLOYED, HEALTHY, STABLE
```

Because real laptop1-initiated E2E has not yet been directly observed (Section I), this phase does not claim the full `PHASE9P_CONTROLLED_DEPLOYMENT_VERIFIED` classification. Everything within this system's control — deployment, the three approved routes, all negative authority tests, and every frozen safety invariant — is verified. The remaining step is Dev1 actually exercising the corrected endpoint from laptop1.

## Recommendation

No further authority expansion or QB-agent feature work should start automatically. The next action, if any, is for Dev1 to retry the real agent against `POST /api/qb-agent/ingest` and report back — at which point a short, read-only follow-up check (query `qb-agent.db` for a genuine `qb-laptop-01` row) would close the loop definitively.
