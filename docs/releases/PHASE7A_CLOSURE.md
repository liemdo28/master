# Phase 7A Closure — Authority Containment + Runtime Reliability — DONE / FROZEN

Date: 2026-08-13

**Phase 7A is merged, deployed, production-verified, and now FROZEN.**

## PR / merge provenance

- Discovery PR: [#97](https://github.com/liemdo28/master/pull/97) (merged `6efff32a`)
- Implementation branch: `codex/phase7a-authority-runtime-reliability`
- Implementation PR: [#99](https://github.com/liemdo28/master/pull/99)
- Reviewed head: `9b925af8f41053054d39823fb692de00e4719977`
- **Merge SHA / functional deployed SHA:** `59e38533c51427ab48972e7cad92818ee5e213a7`
- PR gates: Repository scans PASS, Server build and tests PASS, GitGuardian PASS. One
  transient CI flake hit (the pre-existing `coding-workflow.test.ts` cancel-vs-complete
  race, already diagnosed during Phase 6F closure and independently fixed in the
  unrelated, still-open PR #98) — confirmed transient via a clean CI re-run, not caused
  by this PR.

## Schema

Personal OS schema **v10** — unchanged. No migration performed or required.

## The three closed bypasses

1. **`node-agent.mjs` `POST /exec` — retired.** Ran arbitrary shell via `execSync` on a
   `0.0.0.0`-bound listener with zero authentication and a denylist that never blocked
   e.g. `Remove-Item`. Now returns `410 EXEC_RETIRED` unconditionally. **Verified live in
   production** post-deploy: `POST http://127.0.0.1:4004/exec` → `410`, `/health` still
   `200`. mi-core's own dispatch route (`POST /api/nodes/:id/exec`) was independently
   confirmed already-quarantined (live 409 `LEGACY_AUTHORITY_QUARANTINED` via the Phase
   6B `legacyAuthorityBoundary`, both with and without a valid API key).
2. **`jarvis/autonomous-task-runner.ts` — quarantined.** `runApprovedTask()` executed an
   unvalidated `auto_command` string gated only by a separate jarvis-specific approval
   store (`jarvis/approval-conversation.ts`), entirely bypassing
   `ActionPolicyEngine`/`RiskEvaluator`/kill-switch/budget. `runL1Task()` (zero live
   callers) had the same class of issue behind a narrower allowlist. Both now always
   return `status: 'blocked'` and contain no `child_process` reference at all.
3. **`approval/gate.ts` — documented and verified as status-only.** `approve()` only
   flips a row's status and fires a UI-notification WebSocket event; nothing reacts to
   `'approved'` by dispatching a real mutation. This invariant is now explicit in the
   file header and covered by a structural test so it cannot silently regress.

None of the three were ever triggered or exploited — this closure found and fixed them
before any real-world exercise.

## Runtime preflight validator + recovery CLI (7A.7–7A.9)

`server/src/runtime-preflight/validator.ts`: read-only diagnostics covering runtime
root, `.env` presence/required keys, DB paths/integrity/schema, dist entrypoint,
deploy-snapshot provenance alignment, authority manifest cleanliness, PM2 ecosystem
validation (stale D:\\/E:\\ path detection, duplicate app names, per-app cwd/script
existence — intentionally-stopped services correctly downgraded to `WARN` rather than
`FAIL`), and port reachability. Run live against production post-deploy: `overall: WARN`
(only the 3 intentionally-stopped services' missing code directories — a genuine,
pre-existing, non-blocking gap discovered by building this validator, documented below).

`server/src/runtime-preflight/recovery-cli.ts`: dry-run-by-default bootstrap script
(chosen as the smallest auditable mechanism per the Phase 7 discovery doc's comparison —
no new dependency, no OS-level registration performed by this commit). Refuses to
proceed if preflight reports `FAIL`; never starts `mi-ceo-observer`/
`mi-whatsapp-gateway`/`mi-n8n`; only mutates PM2 state with explicit `--apply`. Not
invoked with `--apply` against production by this closure — a future explicit directive
can wire a Windows Scheduled Task to invoke it at boot.

## New finding from building the validator

`services/mi-ceo-observer/`, `services/whatsapp-ai-gateway/`, and
`services/n8n-execution-bus/` **do not exist at all** in the current
`F:\Projects\mi-core` runtime copy — not just stopped, their code was never copied
during the earlier F-drive production recovery (since they were never started, this
never surfaced before). Not fixed in this closure (no urgency — these services remain
intentionally stopped); flagged for whenever a future directive authorizes revisiting
them.

## Validation results

- **302 deterministic scenarios**: 142 systematically-varied runtime-preflight fixtures
  × 2 (determinism proof — every pair byte-identical except `generatedAt`) + 18
  attempted-shell-payload × containment-surface combinations. **0 determinism failures,
  0 unauthorized shell executions.**
- `phase7a:acceptance`: 8/8 points pass (containment structural checks, authority
  manifest clean, live production preflight clean modulo the 3 intentionally-stopped
  services, no schema v11, no new forbidden action types).
- Full regression, run twice (once pre-merge on the dev branch, once post-merge on a
  clean `npm ci` worktree): build clean, `test:ci` clean, Phase 5A–5I and 6A–6F
  acceptance all PASS, Command Center unit (18/18) + security (20/20) + E2E ×2 (5/5
  each, zero orphan node/chrome processes), Agentic Coding fixtures 5/5 (Ollama honestly
  reported unavailable).
- Authority manifest: `unknownMutations: 0`, `unresolvedLegacyMutations: 0`, total 1076
  → 1079 (the only delta: 3 new internal-test-only CLI surfaces for the new test
  scripts).
- Security/hygiene scans clean: no conflict markers, no credential-shaped literals, no
  stale D:\\/E:\\ paths introduced, no Gmail SEND/financial/new-shell-exec keywords in
  the diff.

## Provenance

`MI_DEPLOYED_SOURCE_SHA` = deploy-owned snapshot SHA = scanner source SHA = authority
manifest provenance SHA = reviewed `server/dist` SHA — all
`59e38533c51427ab48972e7cad92818ee5e213a7`:

- Deploy-owned source snapshot:
  `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\59e38533c51427ab48972e7cad92818ee5e213a7`
  (757 files, `treeChecksum: 506c1649afe19c6452ed66050d77b8edb09970b3562dc8484e6928407a19b876`).
- `generate-manifest.ts --check` PASSes reading directly from the snapshot root and
  against the live deployed `.env` markers.
- Previous (pre-Phase-7A) snapshot at
  `...\mi-core-deployed-source\5660c03900dc1b343e4c11cef97ec4abb4860c54` retained for
  rollback.

## Predeploy backup

`F:\Projects\D-root-mi-snapshots\mi-core-production-backups\phase7a-predeploy-20260813-185401\`
— pre-deploy `server/dist`, `server/src`, `node-agent.mjs`, `authority-manifest.json`,
`snapshot-manifest.json`, `server/package.json`; PM2 `jlist` + `dump.pm2`; online-safe
SQLite backups of `personal-os.db`/`tasks.db`/`projects.db` (`integrity_check=ok`, 0 FK
violations on all 3; `personal-os.db`'s source/backup checksums differ only because of a
concurrent write during the live-DB backup window — normal for the SQLite online-backup
API, confirmed valid via the integrity check). `ROLLBACK_NOTE.md` with the full
procedure. All prior backups retained, none deleted.

## Deployment / restart

Only `server/dist`, `server/src`, `node-agent.mjs`, `authority-manifest.json`, and
`server/package.json` were deployed (file counts verified via `fs.cpSync` + recursive
count comparison — `server/dist` 643/643, `server/src` 756/756). `command-center/dist`
was **not** redeployed — Phase 7A made zero Command Center changes.

Only `mi-core` and `mi-node-agent` were restarted (the only two processes whose running
code changed). Pre-restart: `mi-core` PID 21728, `mi-node-agent` PID 23120, both 0
restarts. Post-restart: `mi-core` PID 24056, `mi-node-agent` PID 21100, both 0 restarts,
stable. `mi-accounting`, `mi-ai-service`, `qb-ops-agent` — untouched, identical
PIDs/uptime/restart-counts throughout. `mi-ceo-observer`, `mi-whatsapp-gateway`,
`mi-n8n` — confirmed still not running.

## Production-safe acceptance

- `GET /api/health`: `{"server":"ok","python_ai_service":"ok","ollama":"down"}` — Ollama
  down honestly reported, unrelated to this phase.
- `GET /api/authority/status` (authenticated): `unknownMutations: 0`,
  `unresolvedLegacyMutations: 0`, matches the deployed manifest exactly.
- `POST http://127.0.0.1:4004/exec` (node-agent, no auth): `410 EXEC_RETIRED` —
  **the actual vulnerability, verified closed live, not just in tests.**
- DB integrity: `integrity_check=ok`, 0 FK violations, schema v10, all 3 DBs. Canonical
  row counts (`goals=2`, `action_proposals=10`, `action_approvals=4`,
  `action_executions=1`, `action_evidence=23`, `policy_sets=1`, `action_plans=3`,
  `delegated_authorities=4`, `tasks=27`, `projects=4`) byte-identical to the pre-deploy
  baseline — zero drift, zero mutation.
- Log audit (deployment window): zero matches for any violation keyword
  (unauthorized-shell, exec-violation, automatic-approval, budget/delegation/plan
  mutation, Gmail SEND, provenance mismatch, authority startup failure, route collision,
  SQLite lock, secret leak, crash loop). `mi-node-agent`'s pre-existing
  `BLOCKED_RUNTIME` symptom (`Registration failed: Unauthorized`) is unchanged —
  correctly untouched, since fixing that separate registration-auth gap was explicitly
  out of scope for this phase.

## Service classifications (unchanged by this closure, except as noted)

| Service | Classification |
|---|---|
| mi-core | RECOVERED / ONLINE (restarted for this deploy; new PID, 0 restarts, health 200) |
| mi-node-agent | BLOCKED_RUNTIME (restarted for this deploy — its own `/exec` vulnerability is now closed; the separate, pre-existing registration-auth gap is unchanged, still out of scope) |
| mi-ai-service, mi-accounting, qb-ops-agent | RECOVERED / ONLINE (not restarted, untouched) |
| mi-ceo-observer, mi-whatsapp-gateway, mi-n8n | INTENTIONALLY_STOPPED (not started; code directories confirmed missing — new finding, not fixed this phase) |

## Freeze

The following are now FROZEN for Phase 7A:

- `node-agent.mjs`'s `/exec` retirement (410 response, no shell dispatch).
- `jarvis/autonomous-task-runner.ts`'s quarantine (both entrypoints always `blocked`).
- `approval/gate.ts`'s status-only invariant.
- The runtime preflight validator's check set and WARN/FAIL classification rules
  (intentionally-stopped services never escalate to FAIL).
- The recovery CLI's dry-run-by-default safety model and its refusal to ever start
  `mi-ceo-observer`/`mi-whatsapp-gateway`/`mi-n8n`.

Any future change weakening these requires an explicit phase directive, per the
governing Phase 7 program rule.

---

**PHASE 7A INTRODUCES NO NEW EXTERNAL AUTHORITY. NO SCHEMA MIGRATION. NO SERVICE
STARTED OR STOPPED BEYOND THE TWO ACTUALLY AFFECTED BY THIS DEPLOY.**

# PHASE 7A — COMPLETE AND FROZEN

Phase 7B may begin.
