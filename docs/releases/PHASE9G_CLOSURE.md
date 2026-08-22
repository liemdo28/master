# Phase 9G — KB Traversal Scope / Deploy-Debris Exclusion Hardening — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Closed the traversal-scope gap Phase 9E/9F discovery surfaced: KB ingest's `MASTER_ROOT` (`F:\Projects` in production) was walked without excluding two evidenced deploy-tooling output directories (`mi-core-deployed-source`, `mi-core-predeploy-backups`, 3 real instances). `EXCLUDE_DIRS` already rejected by exact basename *before* recursion/reads occurred for whatever names it contained — the mechanism's timing was already correct; the fix adds the two evidenced names to that existing set. Full root-cause and evidence detail in `docs/architecture/PHASE9G_KB_TRAVERSAL_SCOPE_AUDIT.md`.

This closure keeps three separate truths distinct, as directed: the implementation result (A), what production acceptance actually observed (B), and pre-existing operational debt surfaced during acceptance that is explicitly **not** attributed to this phase without evidence (C).

## Review and merge

[PR #140](https://github.com/liemdo28/master/pull/140) — head `00219faf55ae09289994bf271e64ac28192734f0`, re-verified immediately before merge: exact head match, `MERGEABLE`/`CLEAN`, no new commits since review, all CI checks green, diff scope confirmed as exactly the 6 reviewed files. Merged via merge commit `2bd6752ef132bca37318f37fe73ddad26e91fac5`.

## A. Phase 9G result — implementation, verified before any deploy action

- **Traversal boundary is fixed at the root cause**: `mi-core-deployed-source` and `mi-core-predeploy-backups` are now rejected in the parent directory's own enumeration loop, *before* `walk()` is ever invoked for them — no `readdirSync` inside them, no file open, no checksum, no SQLite write. This was proven structurally (via the exclusion-check's position in the code, before the recursive call) and directly (a real filesystem fixture with an `onDirectoryEnter` hook proving the excluded paths never appear in the set of directories actually entered).
- **Permanent regression: 18/18 required cases pass** (`kb-traversal-exclusion.test.ts`) — both excluded parents and their nested content never entered; legitimate, nested, similarly-named, and partial-name-overlap siblings still traversed; a file merely named with "backup" still eligible; path-normalization invariance; zero excluded documents reach the DB; Phase 9F coalescing/reusability/yielding intact; zero unhandled rejections.
- **Deterministic evaluation: 602 real cases** (exceeds the 500 target) — 510-case pure-function sweep of the real exported `isExcludedDirName()` across ~85 candidate names × 6 path contexts, plus 92 structural integration cases. **All 7 hard targets exactly 0**: `unexpectedTraversal`, `excludedFileRead`, `excludedDocumentIngested`, `legitimateDocumentLost`, `pathCollisionFalsePositive`, `phase9fYieldRegression`, `authorityExpansion`.
- **No authority or schema change**: `ActionType` unchanged at 7; manifest total moved by exactly +1 (the one new `test:*` surface, classified `INTERNAL_TEST_ONLY`/`READ_ONLY`); `unknownMutations=0`; `unresolvedLegacyMutations=0`; schema unchanged at v10.
- **Phase 9F's non-blocking yielding remains fully intact**: re-verified via the Phase 9F regression suite (unchanged, passing) and via this phase's own regression asserting `onYield` is still wired and `fullIngest()` coalescing is unaffected by the new exclusion check.
- Full relevant regression (Phase 9A 14 invariants + 945/945 evaluation, Phase 9B 9 invariants, Phase 9D 12 invariants + 908/908 evaluation, credential scan, SSRF 506/506, Phase 8A security, `authority:manifest -- --check`, full `test:ci`) all re-run on the merged SHA and pass unchanged.

## B. Production acceptance — exactly what was observed, no more

- **Deployed**: functional SHA `2bd6752ef132bca37318f37fe73ddad26e91fac5`. Predeploy backup taken (server-dist, command-center-dist, manifests, PM2 jlist, env key names, consistent online backups of all 4 canonical DBs). Deploy-owned source snapshot built and verified from the exact merged checkout. Only `mi-core` restarted for the deploy step; all sibling PM2 processes confirmed untouched by the deploy itself.
- **One authorized real production ingest attempt was run** (via the same `POST /api/knowledge/ingest` route the scheduler uses) — not a synthetic proxy.
- **HTTP remained serviceable throughout**: 239 probe cycles over ~51 minutes, 99.2% health success rate, worst latency 9.81s — never a multi-minute, or even multi-request, period of complete unavailability.
- **Unrelated scheduler activity continued running during the ingest**: `[Scheduler] Running visibility sync... / Visibility sync complete` fired and completed (7 seconds) while the ingest was still in progress — direct, repeated confirmation that Phase 9F's fix holds under Phase 9G's code too.
- **Excluded families remained absent from the KB throughout and after**: 0 documents from either `mi-core-deployed-source` or `mi-core-predeploy-backups`, confirmed by direct query before, during (implicitly, via the same mechanism), and after the attempt.
- **No legitimate KB-source loss occurred** — total document count grew from 44,523 to 44,804 (+281) over the course of the partial run, consistent with real, legitimate content being ingested before the interruption, not data loss.
- **The ingest did not complete cleanly.** `mi-core` restarted mid-run (cause investigated separately — see Section C) and the in-flight HTTP request was severed (`HTTP_STATUS:000` after ~41.8 minutes) before a completion log line could be written. **This is not being represented as a clean full-ingest completion.**
- **By design, no second ingest attempt was run.** The already-obtained evidence (traversal exclusion proven live, HTTP serviceability proven, unrelated-scheduler-continuity proven, zero excluded-family contamination, zero data loss) was judged sufficient without retrying, per explicit operator decision: **`PHASE9G_ACCEPTANCE_SUFFICIENT_WITHOUT_RETRY`**.

## C. Separate operational debt — surfaced during acceptance, explicitly not attributed to Phase 9G

A dedicated, read-only investigation was performed after two correlated restart events were observed (`docs/architecture/PHASE9G_KB_TRAVERSAL_SCOPE_AUDIT.md` covers the implementation; this section and the investigation transcript cover the acceptance-time findings). Conclusions, preserved precisely:

- **One restart is conclusively explained and governed**: `mi-accounting` was restarted by `self-healing-monitor.ts`'s own Phase-9A-hardened, allowlisted, evidenced restart path (`self_heal_restart_log` row: `decision:"eligible", outcome:"command_issued"`, matching app-log line `"[SelfHeal] Restart command issued for Accounting Engine"`). This is self-healing-monitor working exactly as designed — it monitors `mi-accounting` and `qb-ops-agent`, not only `mi-core`.
- **The recurring `mi-core` restarts remain unexplained.** Across this session, `mi-core` restarted outside of deliberate deploy actions on at least 4 occasions (`2026-08-21 23:34:37`, `00:23:19`, `2026-08-22 05:03:12`, `09:15:17`). For every one of these: no matching `self_heal_restart_log` row exists, no `max-memory-restart` line appears in PM2's daemon log, the PM2 daemon process itself did not restart (continuous uptime since `2026-08-21 07:55:07`, confirmed via direct PID/StartTime query), no Windows Scheduled Task ran at a matching time, no Windows System-log power/kernel event occurred (ruling out sleep/wake/reboot), and no startup script is currently active (the one relevant autostart `.vbs` was deliberately disabled on 2026-08-17; a second one found in an unrelated project directory references a stale, non-current path).
- **No currently-reachable uncontrolled PM2 mutation path was found.** The full repo/deployed-dist was searched for every code path capable of `pm2 restart/reload/stop/start/delete`. One genuinely ungoverned capability was found (`auto-task-engine/index.ts`'s `restartService()`, hardcoded to `mi-core`, no allowlist/kill-switch/evidence-logging) — but it is confirmed **dead code**: zero `require()` of that module exists anywhere in the deployed runtime. The two other capable-but-gated paths (`skill-registry.js`'s `pm2_restart` skill, `release-agent.js`'s `executeRestart`) both require an explicit, approval-gated invocation, and no evidence of either firing was found.
- **Therefore causality between these recurring `mi-core` restarts and Phase 9G is not established**, and the issue is kept explicitly open as operational debt — not silently absorbed into this closure, not claimed as resolved, and not attributed to the traversal-exclusion change, which touches no PM2/process-control code at all.
- **`qb-ops-agent` has its own, separate, pre-existing bug**: a chronic `ENOENT ...settings-cache.json` heartbeat/workflow failure, observed continuing both before and after its own restart — confirming the restart did not (and could not) fix it. Unrelated to KB ingest or Phase 9G.
- **The PM2 768MB `max-memory-restart` ceiling remains unresolved**, separately, as it has been since Phase 9F. This acceptance run's memory behavior (peaked ~665MB, recovered to ~339MB via GC without hitting the ceiling) is a single data point and is not being claimed as evidence the memory issue is solved.
- **The ~40 additional historical `mi-core-<phase/hotfix/build>-*` directories discovered under `D-root-mi-snapshots` during the Phase 9G audit remain explicitly out of scope** — no shared stable basename exists across them, and excluding them would need the same per-family evidence this phase provided for its two targets.

## DB / log / provenance audit (this closure)

- All 4 databases (`personal-os.db`, `projects.db`, `tasks.db`, `knowledge.db`): `integrity_check=ok`, 0 FK violations.
- Schema `schema_migrations` MAX(version) = **10**, unchanged.
- Provenance confirmed consistent: `.env`'s `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` match `2bd6752ef132bca37318f37fe73ddad26e91fac5` exactly.
- Authority manifest re-read live: `unknownMutations=0`, `unresolvedLegacyMutations=0`, `total=1072` — matches the pre-deploy generation exactly.
- Zero unhandled promise rejection warnings anywhere in the error log across the acceptance window.
- Production stable at time of closure: `mi-core` online and serving (`GET /api/health` → 200, ~2.8s), no active restart storm (all sibling processes show unchanged restart counts and PIDs since the investigation concluded).

## Explicit statement

**NO NEW AUTHORITY.** This phase changed only which directory names the KB walker enters. No `ActionType`, route, schema, policy, kill-switch, approval, or delegation semantic was touched.

## Freeze declaration

Phase 9G is declared **COMPLETE AND FROZEN**. The specific, well-evidenced defect it targeted — deploy-tooling debris directories being walked unnecessarily — is closed and verified both by deterministic testing (602 cases, all hard targets 0) and by live production behavior (0 documents from either excluded family, confirmed before and after a real ingest attempt). Production acceptance is accepted as sufficient without a retry, per explicit operator decision, with the partial-completion nature of that one attempt stated plainly rather than represented as a clean run. The recurring unexplained `mi-core` restart pattern, the pre-existing `qb-ops-agent` bug, and the PM2 memory ceiling are all preserved as distinct, open, unresolved operational items — none is claimed as solved, and none is attributed to Phase 9G without evidence. Continuing to any further phase only once separately authorized; not started automatically.
