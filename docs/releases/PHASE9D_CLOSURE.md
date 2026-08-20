# Phase 9D — QB Online Watcher Idempotency / Command De-dup Hardening — Closure

**Status: COMPLETE AND FROZEN.**

## Summary

Closed the idempotency gap Phase 9C found in `qb-online-watcher.ts`: `insertSyncCommand()` had no existing-row check before inserting a `TRIGGER_SYNC` command that a physically separate machine executes unattended, so any flapping offline/online transition could queue duplicate remote-machine commands. `insertSyncCommand()` now performs an atomic (single-transaction), DB-backed check for an existing active (`pending`/`acked`, non-stale) command for the fixed `(machine_id, command_type)` pair before inserting. Full details in `docs/architecture/PHASE9D_QB_WATCHER_IDEMPOTENCY_AUDIT.md`.

## Review and merge

[PR #135](https://github.com/liemdo28/master/pull/135) — self-authored, self-reviewed, explicitly authorized for merge by the repo owner (scoped specifically to PR #135), after re-verifying immediately before merge: exact reviewed head SHA match (`8e5935416ff8dfce98ae9673b6e1c36413c2cb82`), `MERGEABLE`/`CLEAN` state, no new commits since review, all required CI checks green on that exact head (Server build and tests, Repository scans, GitGuardian — `External integration tests` correctly `skipping`, the same conditional-skip pattern observed on prior docs/backend-only PRs), final diff still limited to the 6 expected Phase 9D files, `ActionType` enum unchanged at exactly 7 values, `unknownMutations=0`/`unresolvedLegacyMutations=0` on the manifest at that head, no migration/schema file in the diff. Merged via merge commit `9588186cea05adf12e51064c451c2cd964473610`.

## Clean-master verification

Fast-forwarded local `master` to `9588186cea05adf12e51064c451c2cd964473610`, working tree clean. Re-ran the Phase 9D targeted gates and full relevant regression against this exact merged head (not the pre-merge branch) before any deploy step.

## Phase 9D targeted gates (post-merge, on `9588186c`)

- `npx tsc --noEmit` — zero errors.
- `phase9d:acceptance` (own 12-assertion test + 908-case evaluation + manifest check) — clean.
- `phase9a:acceptance` (945 cases, all 6 hard targets 0) — clean, no regression.
- `phase9b:acceptance` (9 assertions) — clean, no regression.
- `test:tracked-credential-scan`, `test:ssrf-policy` (506/506), `test:phase8a-security` — all clean.
- Full `test:ci` — zero real failures, ending with the new Phase 9D test.
- `authority:manifest -- --check` — PASS.

## 908-case deterministic evaluation — result

```
totalCases: 908, failures: 0
duplicateActiveCommand: 0
arbitraryTargetReachability: 0
authorityExpansion: 0
financialExecutionExpansion: 0
shellEscalation: 0
unknownMutations: 0
unresolvedLegacyMutations: 0
```

All 7 required hard targets exactly 0.

## Exact de-dup semantics

Idempotency scope is `(machine_id, command_type)` — the one fixed target (`qb-laptop-01`) and one fixed command type (`TRIGGER_SYNC`) this watcher ever issues; no caller input, no dynamic dispatch. A pre-existing command in status `pending` or `acked` (i.e. not yet `completed`/`failed`) for this exact pair, and not older than the staleness threshold, blocks a new insert — `insertSyncCommand()` returns `null` and no row is written. Any other state (no active row, or an active row that is stale/completed/failed) allows a fresh insert. The existing-row check and the insert are wrapped in a single `better-sqlite3` transaction, so the check-then-insert is atomic against a concurrent `poll()` invocation — proven directly by 20-way and 100-way concurrent-call scenarios (exactly one insert ever succeeds).

## Stale-row threshold semantics

`STALE_COMMAND_MS = 30 minutes`. A `pending`/`acked` row older than this no longer counts as active and does not block a fresh insert — generous relative to both the 60s poll interval and the remote agent's own heartbeat cadence, but bounded so one lost/dropped command (remote agent offline, crashed, or simply never polling again) cannot permanently disable the recovery feature. The check reads the durable `commands` table, not any in-memory state, so it is correct across process restarts.

## Authority counts

Deployed `authority-manifest.json`: `total=1070`, `readOnly=677`, `internalTest=105`, **`unknownMutations=0`, `unresolvedLegacyMutations=0`** (unchanged from pre-Phase-9D, both required targets held throughout). `ActionType` enum unchanged at exactly 7 values. `background:qb-online-watcher`'s classification unchanged (`LEGACY_QUARANTINED`/`QUARANTINED`/`QUARANTINE_ONLY`) — see "Remaining quarantine status" below. The only manifest delta versus pre-Phase-9D is the one new `test:*` script this phase adds, per the established pattern.

## Schema

No migration or schema file appears in this PR's diff. `personal-os.db`'s `schema_migrations` table confirms `MAX(version) = 10`, unchanged. `projects.db` and `tasks.db` do not use the same central `schema_migrations` mechanism (each tracks its own domain-specific tables); neither was touched by this PR, so their schemas are likewise unchanged. The `commands`/`heartbeats` tables in `qb-agent.db` were not altered — this fix reads and writes only their existing columns.

## Predeploy backup

`F:\Projects\mi-core-predeploy-backups\phase9d-2026-08-20T11-36-55.795Z\`: `server-dist`, `command-center-dist`, `authority-manifest.json`, `snapshot-manifest.json`, all 3 canonical production DBs (`personal-os.db`, `projects.db`, `tasks.db`, online `better-sqlite3` backups) plus `qb-agent.db` (the DB this phase's change directly touches), `pm2-jlist.json`, `env-keys-present.txt`.

## Deploy

Deploy-owned source snapshot built via `authority:build-snapshot --sha=9588186cea05adf12e51064c451c2cd964473610` at `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\9588186cea05adf12e51064c451c2cd964473610\` (`fileCount: 830`, `treeChecksum: 8c6629ceebe74f25138211493c0688d96016c2c1b9fd6933a55b8978e0ef020d`). `server/dist` (rebuilt clean from the merged source), `server/src`, `server/package.json`, `server/authority-manifest.json` deployed to `F:\Projects\mi-core` (previous copies preserved as `.old`). `.env` provenance markers (`MI_DEPLOYED_SOURCE_SHA`, `MI_DEPLOYED_SOURCE_ROOT`) and `server/snapshot-manifest.json` updated together in the same step (an intermediate slip where a Node string-escaping issue briefly mangled `MI_DEPLOYED_SOURCE_ROOT`'s backslashes was caught and corrected immediately, before any restart or acceptance check — recorded here transparently). Only `mi-core` restarted (PM2 restart counter 3→4); `mi-ai-service`, `mi-accounting`, `qb-ops-agent`, `mi-node-agent`, `pm2-logrotate` untouched (confirmed 0 restarts each, unchanged ~4h uptime, across the deploy).

**Functional deployed SHA: `9588186cea05adf12e51064c451c2cd964473610`.**

## Production acceptance

- `GET /api/health` → `200 OK`, `{"server":"ok","python_ai_service":"ok","ollama":"down","overall":"DEGRADED"}` (Ollama remains down, pre-existing and untouched by this phase, health truth correctly not silently upgraded).
- Boot log clean: `[QB-WATCHER] Started — no heartbeat found for qb-laptop-01` present, confirming the new code is genuinely live; `[Mi] ✓ Authority Control Plane validated (1070 surfaces, ...)` matches the deployed manifest's `total` exactly; zero new error classes since restart (only the pre-existing, known WhatsApp Gateway / CEO Observer / Ollama-down alerts continue, unrelated to this change).
- **Live production `qb-agent.db` inspected read-only**: `commands` and `heartbeats` tables are both currently empty (the QB Desktop agent has not sent any heartbeat in this environment) — there is no live command history to exercise the specific de-dup scenarios against, and per explicit instruction no real duplicate command was created to manufacture one.
- **Production-safe acceptance for the 6 required scenarios, run against the actual deployed compiled bundle (`dist/jarvis/qb-online-watcher.js`), not just the TS source, using an isolated in-memory-scoped copy of the just-taken production `qb-agent.db` backup (production-derived schema and state, zero live mutation, live file re-confirmed still empty afterward)**:
  - Existing active `pending` command → suppresses duplicate ✓
  - Existing active `acked` command → suppresses duplicate ✓
  - Stale (>30min) pending command → does not suppress a fresh insert ✓
  - Completed prior command → does not suppress a fresh insert ✓
  - Failed prior command → does not suppress a fresh insert ✓
  - 20 concurrent insert attempts → exactly 1 succeeds ✓
- **Target remains exactly the fixed QB machine**: deployed bundle's `MACHINE_ID` constant confirmed still the literal `'qb-laptop-01'`; boot log confirms the watcher references only that machine.
- **No arbitrary target path exists**: `grep` of the deployed bundle for `req.body`/`req.query`/`req.params` → 0 matches (no HTTP entrypoint at all).
- **No new shell/process path exists**: `grep` of the deployed bundle for `child_process`/`execSync`/`exec(`/`spawn(`/`shell: true` → 0 matches.
- **Notification occurs only for a genuine insert**: confirmed structurally in the merged diff — the CEO WhatsApp send is now gated on `insertSyncCommand()` returning a non-null `commandId`, correcting a latent pre-existing bug where a failed/skipped insert previously still reported success.
- Authority counts re-checked against the deployed `authority-manifest.json` directly (not just the repo copy): `unknownMutations=0`, `unresolvedLegacyMutations=0`.

## DB / log / provenance audit

All 3 canonical production databases: `integrity_check=ok`, 0 FK violations (`personal-os.db`, `projects.db`, `tasks.db`). `personal-os.db` schema `schema_migrations` MAX(version) = 10, unchanged. `qb-agent.db` (the DB this phase touches) also `integrity_check=ok`, 0 FK violations, schema unchanged (no migration in this diff). Deployed provenance confirmed consistent: `.env`'s `MI_DEPLOYED_SOURCE_SHA` / `MI_DEPLOYED_SOURCE_ROOT` and `server/snapshot-manifest.json`'s `deployedSha` / `sourceSnapshotRoot` all agree on `9588186cea05adf12e51064c451c2cd964473610`. No new error classes in `mi-core-error.log` since restart.

## Remaining quarantine status — preserved, not resolved

**Phase 9D hardens idempotency/reliability only.** `background:qb-online-watcher` remains classified `authorityClass: LEGACY_QUARANTINED`, `status: QUARANTINED`, `phase6bDisposition: QUARANTINE_ONLY` in the authority manifest — unchanged by this phase, still honestly flagged as unresolved legacy debt (tracked in `quarantinedLegacy`, not silently closed). This PR does **not** promote `qb-online-watcher` into a canonical, governed autonomous capability: it still runs unattended, with no `ActionPolicyEngine`/`KillSwitchService`/`ControlledActionService` involvement, no approval gate, and no `ActionType`. What changed is narrower and more defensive: the same fixed, already-existing, already-unattended mutation can no longer fire more than once per genuine recovery event. The deeper question of whether this capability should ever be routed through governed Controlled Actions remains open, tracked follow-up work — exactly as the Phase 9C roadmap scoped it, and exactly matching the precedent this program set in Phase 9A for the sibling background workers.

## Explicit statement

**NO NEW AUTHORITY.** No `ActionType` added (still exactly 7). No new remote command type (`TRIGGER_SYNC` remains the only one this watcher has ever issued). No auto-approval added or removed. No new target machine. No financial execution capability touched. No shell/process execution introduced. No PM2/process authority expansion. No production DB schema changed. No service other than `mi-core` was restarted, and `mi-core` was restarted only as the normal, separately-authorized deploy step for a backend source change — not as part of proving any behavior.

## Freeze declaration

Phase 9D is declared **COMPLETE AND FROZEN**. `qb-online-watcher`'s `TRIGGER_SYNC` idempotency gap is closed and code-verified, deployed, and production-accepted without creating any real duplicate command or touching live data beyond a read-only inspection. Its legacy-quarantine classification remains open, tracked follow-up work — not claimed as resolved. Continuing to **Phase 9E** only once separately authorized; not started automatically.
