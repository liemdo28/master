# Phase 8B — Legacy Retirement / Platform Simplification — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Phase 8B set out to reduce legacy surface area under a strict "prove dead, then delete" mandate. Discovery covered the directive's full 19-keyword-domain sweep (jarvis, legacy, coo, gstack, autonomous, approval, memory, conversation, knowledge, retrieval, planner, orchestrator, health, selfheal, voice, browser, node-agent, workflow, executor, provider), single-threaded after the account's monthly subagent spend limit blocked parallel discovery mid-session — a tooling constraint, not a correctness gap; the same evidence bar (no live HTTP caller, no in-process caller, no PM2/CLI entrypoint, no dynamic import, no test dependency, no startup dependency) was held throughout.

Exactly one component cleared every proof requirement: the legacy 49-route `/api/jarvis` HTTP router. It was retired. Everything else discovered — `execution/` (DEV5), `gstack/`'s own real-execution approval gate, node-agent, the `MI_CORE_ROOT`/E:-data-root split, and the phase21-30 module cluster — was either already unambiguous (no action needed) or explicitly disclosed and deferred, per "the goal is not maximum deletion; the goal is zero ambiguous live ownership."

## What changed

- Deleted `server/src/routes/jarvis.ts` (49 routes) and its mount in `index.ts`. Its 20 backing modules are unchanged and remain live via their real, non-HTTP callers (WhatsApp, voice, GStack, `bootJarvis()` at startup) — confirmed post-deploy: `[Mi] ✓ Jarvis Evolution Phase 30 booted` in the live boot log.
- Closed a pre-existing authority-registry gap: `/api/evidence` had no rule, added `evidence-read`.
- Added 2 new test suites (structural canonical-owner lock, 1310-scenario retirement evaluation), wired into `test:ci`.
- Authority manifest: `total` 1111→1064, `legacyMutations` 190→175 (decrease only — the directive's own invariant), `unknownMutations`/`unresolvedLegacyMutations` held at 0 throughout.
- Fixed 3 unrelated pre-existing test-precision issues in frozen Phase 7A/7F/7G scripts, surfaced only because this phase's regression happened to exercise them (full investigation trail in `docs/architecture/PHASE8B_LEGACY_INVENTORY.md` §11.5) — none required weakening any real invariant, and one (`falseExecutedClaims`, a live-LLM eval) required no code change at all after being confirmed non-reproducible across 3 runs.

## Review and merge

[PR #117](https://github.com/liemdo28/master/pull/117) — self-authored, self-reviewed (subagent spend limit precluded a separate reviewer agent), explicitly authorized for merge by the repo owner in a sole-owner workflow after independent verification of: exact head SHA match, mergeability, green CI on that exact head, no new commits, and `unknownMutations=0`/`unresolvedLegacyMutations=0` immediately before merge. Merged as `25db220c4843a45f1d02bb69f2ba5d734539b73f`.

## Clean-master verification

Fast-forwarded local `master` to the merge commit, rebuilt `server/dist` from clean, re-ran the full gate chain (5A-5I, 6A-6F, 7A-7C, 7G, 8A, 8B, `test:ci`, Agentic Coding). One transient failure: Agentic Coding's 5 fixtures failed with `MODEL_UNAVAILABLE` — confirmed via direct probe that the local Ollama process was not running at that moment (unrelated to this phase's code, which does not touch `coding/`). Started Ollama, re-ran Agentic Coding standalone: 5/5 fixtures passed. No other failures in the clean-master chain.

## Predeploy backup

Written to `F:\Projects\mi-core-predeploy-backups\phase8b-2026-08-19T...\`: `server-dist`, `command-center-dist`, `authority-manifest.json`, `snapshot-manifest.json`, all three production DBs (`personal-os.db`, `tasks.db`, `projects.db` + WAL/SHM sidecars), `pm2-jlist.json`, and `env-keys-present.txt` (key names only, never values).

## Deploy

Deploy-owned source snapshot built via the canonical `authority:build-snapshot` tool (not a manual copy) at `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\25db220c4843a45f1d02bb69f2ba5d734539b73f\` — `fileCount: 822`, `treeChecksum: 6ee924662d235b70d5077e7fb2cf6b04fef71357923bcee9210fd90155433fe2`. `server/dist` and `server/src` deployed to `F:\Projects\mi-core` (previous copies preserved as `dist.old`/`src.old` for instant rollback in addition to the formal predeploy backup). `command-center/` was not redeployed — zero changes in this phase's diff. `.env`'s `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` and `server/authority-manifest.json` updated to match. Only `mi-core` restarted via `pm2 restart mi-core --update-env` — `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent` untouched (confirmed 45m uptime, 0 restarts, unchanged across the deploy).

## Production acceptance

- `GET /api/health` → `{"overall":"HEALTHY"}` post-restart.
- Boot log: full clean startup sequence, `[Mi] ✓ Jarvis Evolution Phase 30 booted` present, zero new exceptions/`TypeError`/`ReferenceError`/`Cannot find module`/uncaught errors in `mi-core-error.log` since restart.
- Retired paths (e.g. `/api/jarvis/proactive/status`) and the canonical Gateway's own routes (e.g. `/api/jarvis/session/current`) both correctly return 401 unauthenticated — this is the canonical Gateway's own auth middleware (mounted at the same `/api/jarvis` prefix) rejecting before Express reaches route-matching, confirmed not an anomaly by probing a wholly unrelated nonexistent path (`/api/totally-made-up-nonexistent-path-xyz`), which returns the identical 401 — i.e. uniform, pre-existing, unchanged global auth behavior, not something this deploy altered. A bogus API key against the retired path still returns 401 (`{"error":"Unauthorized"}`), confirming it was not silently resurrected.
- `server/dist/index.js`: zero references to `routes/jarvis` (grepped directly in the deployed bundle).
- The remaining `[SelfHeal]` alerts in the logs (WhatsApp Gateway, CEO Observer down; MI_PIN/MI_PIN_HASH unset dev-mode auth; MinIO not configured) are the same pre-existing, already-documented gaps carried forward from Phase 7B–7G closures — unrelated to and unchanged by this deploy.

## DB / log / provenance audit

All three production databases (`personal-os.db`, `tasks.db`, `projects.db`): `integrity_check=ok`, 0 FK violations, checked online post-deploy without disrupting the running service. Schema unchanged at v10. Provenance chain verified consistent: `.env`'s `MI_DEPLOYED_SOURCE_SHA` = deploy-owned snapshot's `deployedSha` = production's `server/snapshot-manifest.json` `deployedSha` = the actual PR #117 merge commit = the authority manifest copied into production (`unknownMutations=0`, `unresolvedLegacyMutations=0`).

## Freeze declaration

Phase 8B is declared **COMPLETE AND FROZEN**. No further changes to this phase's scope. Per the governing directive, continuing to **Phase 8C — SelfHeal / Recovery Intelligence** under the existing Phase 8 roadmap, without expanding autonomy.
