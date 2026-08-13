# Phase 6F — Runbook

Date: 2026-08-13

## What changed operationally

- New module `server/src/personal-os/automation-simulation/`: `types.ts`,
  `fake-providers.ts`, `service.ts` (`AutomationSimulationService`), `router.ts`
  (`POST /simulation/run`, `GET /simulation/:id`, `POST /simulation/compare`),
  `simulation-scenarios.ts` + `simulation-evaluation.ts` (513-case evaluation),
  `phase6f-acceptance.ts` (20-point acceptance).
- `server/src/index.ts`: 3-line addition — one import, and the simulation router
  mounted under both `/api/command-center` (session auth) and bare `/api`
  (task-runtime auth), matching every other Controlled-Action-adjacent route's
  middleware chain exactly.
- `command-center/src/lib/types.ts`: additive `SimulationRun`/`SimulationStepInput`/
  etc. types.
- `command-center/src/routes/SimulationPage.tsx` (new) + `App.tsx`/`Layout.tsx`
  wiring: a new `/simulation` Command Center page with a permanent
  "SIMULATION — NO LIVE SIDE EFFECTS" banner and no execute/approve/send/create/
  deploy button anywhere on it.
- New test/eval/acceptance scripts (all against disposable fixtures or an
  independent real-but-unrelated governance store, never production data):
  `test:automation-simulation`, `test:automation-simulation-security`,
  `test:automation-simulation-parity`, `automation-simulation:evaluation`,
  `phase6f:acceptance`.

## What did NOT change

No database schema migration — `personal-os.db` remains schema v10. No new
mutation route beyond the three simulation-local ones listed above (all three
mutate only an in-process, bounded, ephemeral result cache — never a database
table, never production authority). No new external action type. No change to
Phase 5F/5G/5H/5I execution/approval/budget/delegation semantics. No change to
Phase 6A/6B/6C/6D/6E. Gmail SEND remains absent. Financial actions remain absent.

## Deployment

Standard dist-file-copy deploy, same pattern as every prior phase:

1. Build from the exact reviewed worktree: `npm run build` (root — builds
   `server/dist` and `command-center/dist`).
2. Predeploy backup per the established convention: online `better-sqlite3`
   backups of `personal-os.db`/`projects.db`/`tasks.db`, current `.env`/deployed-
   source markers, current `authority-manifest.json`, current `server/dist`/
   `command-center/dist`, checksum manifest, `ROLLBACK.md`.
3. Copy `server/dist` and `command-center/dist` from the reviewed worktree into
   production.
4. Rebuild the deploy-owned source snapshot for the new functional SHA
   (`npm run authority:build-snapshot -- --sha=<sha>`) and update
   `MI_DEPLOYED_SOURCE_SHA`/`MI_DEPLOYED_SOURCE_ROOT` — the permanent invariant from
   the Phase 6D hotfix continues to apply unchanged:
   `MI_DEPLOYED_SOURCE_SHA = deploy-owned source snapshot SHA = runtime scanned
   source SHA = authority manifest SHA = server/dist reviewed SHA`.
5. Regenerate `authority-manifest.json` (`npm run authority:manifest`) to reflect
   the two new simulation routes and commit it — required, since new routes were
   added.
6. Restart only `mi-core`. No other PM2 process is touched.
7. Verify: `/api/health` 200; `/api/authority/status` counts match the reviewed
   manifest; a representative `POST /api/simulation/run` call (authenticated)
   returns 200 with `overallOutcome` populated; before/after DB row counts for
   `action_proposals`/`action_executions`/`action_budgets`/`kill_switches` are
   identical across that call (§51 live acceptance — no Gmail draft, no Calendar
   event, no Gmail SEND, ever).

## Rollback

Same pattern as every prior phase:

1. Stop only `mi-core`.
2. Restore `server/dist` and `command-center/dist` from the predeploy backup.
3. Restore `.env` deployed-source markers and `authority-manifest.json` to the
   pre-Phase-6F values if reverting past the deploy-owned-snapshot rebuild in step
   4 above.
4. Restore DB files only if a verified DB integrity issue is found (unlikely — this
   phase never migrates schema and its only DB-shaped state is the disposable,
   per-run ephemeral temp-file store it deletes after every call).
5. Start `mi-core`.
6. Re-run `/api/health`, `/api/authority/status`, DB integrity checks.

Do not touch the unrelated production Git checkout during rollback, per the
Phase 6D hotfix's own standing rule.

## Known limitations (recorded, not hidden)

- **Simulation results are ephemeral.** They live only in an in-process, bounded
  (200-entry) cache and do not survive a process restart — by design (§7: prefer no
  new schema). A Command Center user comparing runs must do so within the same
  server process lifetime.
- **Delegation what-ifs are entirely synthetic.** The simulator never reads or
  writes a real `DelegatedAuthority` row; every delegation scenario in a
  simulation run is a hand-constructed in-memory object fed to the real, pure
  `evaluateDelegationEligibility()`. This is correct for what-if analysis but means
  simulation cannot currently rehearse against one specific *existing* production
  delegation record by id — only against a named scenario shape.
- **`payloadHash` is not byte-identical to what a live proposal would produce**
  for the same conceptual input, because the simulator hashes the raw
  `actionPayload` directly rather than routing it through
  `ControlledActionService.normalizePayload()` first. Documented and proven
  non-governance-relevant in `automation-simulation-parity.test.ts` — under the
  current default policy set, no rule keys off payload content or hash bytes, so
  this never changes a `policyDecision`/`approvalRequirement`/`riskClass` outcome.
