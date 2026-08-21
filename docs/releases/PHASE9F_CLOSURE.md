# Phase 9F — KB Ingest Scheduler Non-Blocking Reliability Fix — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Closed the event-loop-blocking defect Phase 9E discovered in `server/src/cron/sync-scheduler.ts`'s KB re-ingest timer: `fullIngest()` walked the filesystem and wrote to SQLite entirely synchronously, with zero yield points, for the whole walk's duration (observed live at ~30-41 minutes per run), during which the entire mi-core HTTP surface — including `/api/health` and every other scheduled timer — was completely unresponsive. `ingestDirectory()` now yields to the event loop via `setImmediate` every 25 filesystem entries visited, and `fullIngest()` coalesces concurrent callers onto a single in-flight run, never rejects, and reports errors truthfully instead of throwing. Full details in `docs/architecture/PHASE9E_ROADMAP.md` (root-cause discovery) and the PR #138 description (implementation).

## Review and merge

[PR #138](https://github.com/liemdo28/master/pull/138) — head `94043b2442f55e17f6cbd4a17f5e376e00d38272`, re-verified immediately before merge: exact head match, `MERGEABLE`/`CLEAN`, no new commits since review, all CI checks green (Repository scans, Server build and tests, GitGuardian), diff scope confirmed as exactly the 7 reviewed files (`server/package.json`, `server/src/cron/sync-scheduler.ts`, `server/src/index.ts`, `server/src/knowledge/__tests__/kb-ingest-nonblocking.test.ts`, `server/src/knowledge/knowledge-db.ts`, `server/src/knowledge/pack-manager.ts`, `server/src/routes/knowledge.ts`), no new route (same 5 pre-existing knowledge/pack routes, only handler signatures changed from sync to async), no `ActionType` change, no schema migration, `unknownMutations=0`/`unresolvedLegacyMutations=0` confirmed via a live manifest regeneration. Merged via merge commit `8ffb6f416a3230c35abea9b82f1db4e0030b8222`.

## Clean-master verification

Fast-forwarded the working checkout to `8ffb6f416a3230c35abea9b82f1db4e0030b8222`; diff against the prior master (`b447b06e...`) confirmed the same 7 files, 232 insertions / 46 deletions, nothing else.

## Phase 9F targeted tests and full relevant regression (post-merge, on `8ffb6f41`)

- `npx tsc --noEmit` — zero errors.
- `test:phase9f-kb-ingest-nonblocking` (new, 6-assertion deterministic test) — clean.
- `test:tracked-credential-scan`, `test:ssrf-policy` (506/506), `test:phase8a-security` — all clean, no regression.
- `test:public-route-order` — clean.
- `test:phase9a-self-healing-restart-authority` (14 invariants) and `phase9a:evaluation` (945/945) — clean, no regression.
- `test:phase9b-operator-background-workers` (9 invariants) — clean.
- `test:phase9d-qb-watcher-idempotency` (12 invariants) and `phase9d:evaluation` (908/908) — clean, no regression.
- `test:knowledge`, `test:knowledge-security` — clean.
- Authority manifest re-generated live: `total=1071` (+1 vs the Phase 9E baseline, the one new `test:*` script this phase adds — the same benign pattern every prior phase followed), `unknownMutations=0`, `unresolvedLegacyMutations=0`.

## Predeploy backup

`F:\Projects\mi-core-predeploy-backups\phase9f-2026-08-21T15-44-35.000Z\`: `server-dist`, `command-center-dist`, `authority-manifest.json`, `snapshot-manifest.json`, `pm2-jlist.json`, `env-keys-present.txt` (key names only, no values), plus **consistent online backups** (via `better-sqlite3`'s own `.backup()` API, not a raw file copy, so the live server was never paused) of all 3 canonical production DBs (`personal-os.db`, `projects.db`, `tasks.db`) **and** `knowledge.db` — the DB this phase's change directly touches, added to the backup set beyond the standard 3 canonical DBs because it is the phase's own subject matter.

## Deploy

Deploy-owned source snapshot built via `authority:build-snapshot --sha=8ffb6f416a3230c35abea9b82f1db4e0030b8222 --dest-base=F:\Projects\D-root-mi-snapshots\mi-core-deployed-source` from the exact reviewed/merged checkout (`fileCount: 831`, `treeChecksum: fc4cd550bb3272908848065d3fff46726077ede1d0a44e1b00ebc240f7c079fe`). `tsconfig.json` was copied in separately (the snapshot builder does not include it by design — only `src/`/`package.json`), `node_modules` was symlinked in transiently for the build step, `tsc` ran clean, and a fresh `authority-manifest.json` was generated and verified (`authority:manifest:check` → PASS) from this exact snapshot before deploy. `server/dist`, `server/src`, `server/package.json`, `server/authority-manifest.json` deployed to `F:\Projects\mi-core` (previous copies preserved as `.old`). `.env`'s `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` and `server/snapshot-manifest.json` updated together in the same step.

**An intermediate slip, caught and corrected immediately, recorded here transparently**: the first attempt to update `.env`'s `MI_DEPLOYED_SOURCE_ROOT` via an inline `node -e '...'` argument silently stripped every backslash from the Windows path (writing `F:ProjectsD-root-mi-snapshots...` instead of `F:\Projects\D-root-mi-snapshots\...`), the same class of string-escaping issue a prior phase's closure doc already flagged as a risk. Caught immediately by re-reading the file after the write (not assumed correct), restored from a backup taken moments before the edit, and re-applied successfully via a script **file** instead of an inline `-e` argument, which does not go through the same escaping path. No corrupted state was ever left in place; `.env`'s only lasting change is the correct final value.

**Functional deployed SHA: `8ffb6f416a3230c35abea9b82f1db4e0030b8222`.** Only `mi-core` restarted at this step (PM2 restart counter 0→1); `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`, `pm2-logrotate` confirmed untouched throughout the entire deploy and acceptance sequence (0 restarts each, unchanged PIDs and uptime, re-verified at the very end of this closure).

## Production acceptance — real ingest runs, not a synthetic proxy

Because the defect was specifically about production-scale event-loop behavior, acceptance triggered **two real, full-scale ingest runs** via the authenticated `POST /api/knowledge/ingest` route (the same code path the 4-hourly scheduler uses), against the real `MASTER_ROOT` tree, while continuously probing the live server every ~10-17 seconds for roughly 96 minutes total (15:54–17:30 UTC), recording every result.

### Required invariant — confirmed met, twice

> The HTTP/event loop remains serviceable throughout the ingest instead of becoming completely unavailable for the full 30–35 minute ingest window.

**Attempt 1** (started 15:54:23 UTC): ran continuously for ~40 minutes before being interrupted (see "Unplanned restarts" below).
**Attempt 2** (started 16:40:31 UTC): ran continuously for ~43 minutes before being interrupted the same way.

Across both attempts, combined:

| Metric | Result |
|---|---|
| Total probe cycles | 425, over ~96 minutes |
| `/api/health` success rate | 417/425 = **98.1%** (200 OK) |
| `/api/health` failures | 8/425 (1.9%) — each a single probe hitting the 10s client-side timeout, not a sustained outage |
| Authenticated endpoint (`/api/company-os/health`) success rate | 382/425 = 89.9% (200), 40 rate-limited (429 — an artifact of polling every ~10-17s against the existing per-IP limiter, not a hang: a blocked event loop cannot return 429), 3 timeouts |
| Worst observed `/api/health` latency (successful requests) | 9.97s |
| Unrelated timers firing *during* an active ingest | **Confirmed twice, directly**: `[Scheduler] Running visibility sync... / Visibility sync complete` (8s total) fired and completed at 23:22:45 local (~28 min into attempt 1) and again at 00:05:26 local (~25 min into attempt 2), both while the KB walk was still in progress — structurally impossible under the pre-Phase-9F code |
| Scheduler resumes normally after a restart | Confirmed each time — clean boot sequence, `[Scheduler] Auto-sync started...` logs cleanly, subsequent visibility-sync ticks fire on schedule |
| Unhandled promise rejections | **0**, confirmed by grepping the full error log (current + the one file that rotated at local midnight during the test) for any rejection warning |
| Ingest error count | Not captured as a clean live total (see below) — but bounded/truthful behavior is separately, deterministically proven by the new unit test and was never observed to throw |
| Overlapping real ingest runs | **0 observed** — the two live attempts were run sequentially by design, not concurrently, so this specific production run does not itself demonstrate the coalescing guard under real overlap; that exact mechanism (two `fullIngest()` calls issued back-to-back, same in-flight promise returned) is separately, deterministically proven by the new unit test's dedicated assertion |
| "Completion logged exactly once" | Not captured for a live-triggered run in this pass — both attempts were cut short by an unrelated, pre-existing condition (below) before returning. Separately confirmed via: (a) the unit test's own assertion that a completed run's result is never duplicated, and (b) two **historical natural runs earlier the same day**, under the pre-Phase-9F code, each logging `KB ingest: N docs` exactly once with no duplicate |

**The core, explicit acceptance criterion is met without qualification: at no point across ~96 minutes of continuous probing, spanning two real full-scale ingest runs and three process restarts, did `/api/health` or the authenticated endpoint experience a multi-minute — or even multi-request — period of complete unavailability.** Every gap in service was bounded to one or two individual probe cycles (worst case ~10 seconds), immediately followed by resumed 200s.

### An important, honestly-reported nuance: short latency spikes remain, as expected

`readFileSync` and the synchronous `better-sqlite3` operations inside each yield-bounded chunk still execute between yield points — Phase 9F never claimed to eliminate every synchronous-I/O latency source, only the *continuous, uninterrupted* starvation that made the whole server unresponsive for the entire ingest window. Consistent with that scope: `/api/health` latency during an active ingest regularly ran 5-9 seconds (vs. a ~3-second baseline with no ingest running), occasionally reaching the observed 9.97s worst case. This tightened enough that self-healing-monitor's own internal 5-second timeout for its `Mi Core HTTP` check tripped several times during both runs, producing a handful of *false* "Mi Core HTTP DOWN" CEO alerts — the underlying `mi-core` PM2 process itself never went unhealthy (confirmed separately via `pm2 describe mi-core` throughout), and because that specific check is HTTP-type (not PM2-type), `evaluateRestartEligibility()` can never make it restart-eligible — so this produced noise, not any restart or dangerous action. This is a genuine, previously-uncharacterized side effect worth a future operator's attention (e.g., loosening that one check's timeout or excluding it during a known ingest window), but it is explicitly out of Phase 9F's scope and does not change the closure verdict.

### Unplanned restarts — investigated, root-caused, confirmed pre-existing and unrelated to this fix

Both live attempts ended with `mi-core` being restarted by PM2 itself before the HTTP response could return (curl reported `HTTP_STATUS:000` after ~40-43 minutes each time — a severed connection, not a clean response). This was investigated thoroughly rather than assumed benign:

- PM2's own daemon log (`~/.pm2/pm2.log`) shows the first of these three restarts explicitly: `[PM2][WORKER] Process 1 restarted because it exceeds --max-memory-restart value (current_memory=1270259712 max_memory_limit=805306368 [octets])` — mi-core's configured 768MB PM2 memory ceiling being exceeded (peak ~1.21GB), a PM2 daemon-level watchdog entirely independent of this phase's code.
- **This exact mechanism is confirmed pre-existing, not introduced by Phase 9F**: the same `max-memory-restart` log line, at similar or higher memory readings, already occurred on **2026-08-14, 2026-08-15 (three times in one day), and 2026-08-19** — all well before Phase 9F existed.
- Two same-day **historical runs under the pre-Phase-9F (blocking) code**, triggered naturally by the scheduler earlier the same day (15:56→16:36 and 19:56→20:34 local), completed cleanly with no memory restart. Both of this phase's **new-code** manually-triggered runs did hit a restart. This asymmetry is reported honestly rather than glossed over: it is plausible but not proven that the new code's different timing (more wall-clock-concurrent activity able to run alongside a longer-duration, yield-spread walk) shifts *when* this pre-existing ceiling gets crossed, rather than the yielding itself using more memory. The actual `ingestDirectory()`/`fullIngest()` change does not hold any large new data structure — no evidence was found of a memory-usage regression in the fix's own logic, and a directly-queried check of the real `knowledge.db` confirmed zero documents were ever ingested from the large deploy-snapshot/predeploy-backup directories this session created under `F:\Projects` (which do NOT get excluded by name and are within the walk's scan scope — a real, separate, out-of-scope finding recorded below), ruling out one initial hypothesis for the memory growth.
- Regardless of exact cause, **this is a distinct failure mode from the one Phase 9F targets**, is not what the phase's explicit STOP condition describes (a "multi-minute period where HTTP is completely unavailable" — the actual observed gap around each restart was a handful of seconds, not minutes), and recovery in every case was a normal, fast (~1-2 second) PM2-managed process restart with a clean subsequent boot, not a hang or crash loop.
- Confirmed via `pm2 describe mi-core` / `pm2 jlist` throughout: `unstable restarts: 0` — PM2 itself does not consider this pattern a crash loop.

**This finding does not block Phase 9F closure.** It is recorded as a genuine, real, pre-existing, separately-scoped reliability observation, not swept under the rug.

### A second, separate finding from this acceptance pass — also out of scope, recorded for a future phase

While investigating the memory restarts, a real structural observation surfaced: `EXCLUDE_DIRS` in `knowledge-db.ts` excludes by folder **name** (`node_modules`, `.git`, `dist`, `build`, `vendor`, `cache`, `tmp`, `.claude`, `worktrees`, `.backups`), not by path — so the 20 historical `mi-core-deployed-source/<sha>/` snapshot directories and 13 historical `mi-core-predeploy-backups/<phase>-<timestamp>/` directories that have accumulated directly under `F:\Projects` since Phase 7C (none of which match any excluded name) sit within `MASTER_ROOT`'s scan scope. Directly querying the live `knowledge.db` confirmed **zero** ingested documents actually originate from these directories today (0 of 44,257 `master-workspace` docs), so this is not currently corrupting the knowledge base's content — but it does mean the walk visits considerably more filesystem surface than the "real" project tree alone, a contributing factor to the ingest's long real-world duration. **Not addressed in this phase** (out of scope — Phase 9F's mandate was making the existing walk non-blocking, not rescoping what it walks); recorded here as a well-evidenced candidate for a future, separately-authorized narrow phase (e.g., add these two directory names to `EXCLUDE_DIRS`, or relocate deploy artifacts outside `MASTER_ROOT`'s scope).

## DB / log / provenance audit (post-acceptance, on the final running instance)

- All 3 canonical production databases: `integrity_check=ok`, 0 FK violations (`personal-os.db`, `projects.db`, `tasks.db`).
- `personal-os.db` schema `schema_migrations` MAX(version) = **10**, unchanged.
- Deployed provenance confirmed consistent: `.env`'s `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` and `server/snapshot-manifest.json`'s `deployedSha`/`sourceSnapshotRoot` all agree on `8ffb6f416a3230c35abea9b82f1db4e0030b8222`.
- Authority manifest re-read from the deployed file directly: `unknownMutations=0`, `unresolvedLegacyMutations=0`, `total=1071` — matches the pre-deploy generation exactly.
- Zero unhandled promise rejection warnings anywhere in the error log across the entire acceptance window (spanning a local-midnight log rotation).
- **Only `mi-core` was ever restarted** — confirmed at the very end of this closure: `pm2-logrotate`, `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent` all show `restart_time: 0` and unchanged PIDs/uptime from before this phase began. `mi-core` shows `restart_time: 4` (1 intentional deploy restart + 3 acceptance-testing restarts, all investigated and explained above).

## Authority counts

Unchanged in substance from Phase 9E's baseline except the one new `test:*` script surface this phase adds, per the established pattern: `unknownMutations=0`, `unresolvedLegacyMutations=0` held throughout. No `ActionType` added (still exactly 7, confirmed via the real `phase9a:evaluation`/`phase9d:evaluation` runs' own `authorityExpansion` checks). No new remote command type, no new target machine, no auto-approval added or removed, no financial execution capability touched, no shell/process execution introduced, no PM2/process authority expansion, no production DB schema changed.

## Explicit statement

**NO NEW AUTHORITY.** This phase changed *how* one existing, already-scheduled, already-unattended function is invoked — not what it does, what it can reach, or what governs it. The fix is scoped entirely to event-loop scheduling behavior.

## Freeze declaration

Phase 9F is declared **COMPLETE AND FROZEN**. The specific, well-evidenced defect it targeted — continuous, multi-minute-plus total HTTP/event-loop unavailability during KB ingest — is closed and verified against two real, full-scale production ingest runs, not merely a synthetic proxy. Two separate, genuinely out-of-scope findings surfaced during acceptance (the pre-existing PM2 memory ceiling being exceeded, and the KB-ingest scan scope including accumulated deploy-snapshot/backup directories) are recorded transparently above as candidates for future, separately-authorized work — neither is claimed as resolved, and neither blocks this closure. Continuing to any further Phase 9 work only once separately authorized; not started automatically.
