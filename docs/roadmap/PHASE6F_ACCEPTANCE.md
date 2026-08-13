# Phase 6F — Acceptance

Date: 2026-08-13

Status: **implementation and gates complete, independent review done, PR open,
not yet merged/deployed.** This document records local acceptance results from
the working branch. Release provenance (merge SHA, deployed SHA, predeploy
backup path, live production acceptance) will be filled in below once the PR
merges and deploys — per the same two-stage doc pattern Phase 6D/6E used
(functional PR doc, then a closure update).

## Release provenance

- Branch: `codex/phase6f-governed-automation-simulation`.
- Based on: `30ca642b0a22e65256831b474f13337a58b6ac19` (Phase 6E docs-only closure,
  the current repository master).
- PR: [#92](https://github.com/liemdo28/master/pull/92), open, independently
  reviewed (1 non-blocking documentation-wording finding, fixed).
- Merge SHA: pending.
- Deployed SHA: pending (production remains on the Phase 6E functional SHA,
  `e766feb15dab24355ad84b63c8c4f3c7201a0f95`, until this phase deploys).

## §42 — Production-derived acceptance: DEFERRED_TO_§54

Per explicit user decision (2026-08-13): §42 requires read-only copies/snapshots
of *production* state (real Controlled Action proposals, policy, Action Plans,
delegations). No verified production DB backup or snapshot is reachable from
this working environment (the previously-referenced
`D:\mi-core-production-backups\phase6e-predeploy-20260812-101529` no longer
exists after the drive migration), and this environment's relationship to the
actual production machine is not confirmed. Rather than guess at a production
data path or access an unverified backup, §42 is explicitly deferred and
folded into §54 (`LIVE PRODUCTION-SAFE SIMULATION`), which already requires the
same before/after live-store comparison against genuine production state —
done once, on real data, after deploy, instead of twice (once on guessed data
pre-merge, once for real post-deploy). **This is not being counted as PASS**
and is **not treated as a pre-merge blocker** given every other gate below is
green. If production state cannot be verified with confidence at §54 time, that
step must report BLOCKED — not a downgraded/assumed PASS.

## §41 — 22-point acceptance (`npm run phase6f:acceptance`)

All 22 points PASS (20 from the original directive + 2 explicitly named in the
re-issued directive's point list: authority parity, provider timeout — points
6 and 13 already covered these implicitly via risk parity and ambiguous-result
respectively, so they're now also proven as their own standalone points). Live
local output:

| # | Point | Result |
|---|---|---|
| 1 | simulator initializes | `overallOutcome=WOULD_EXECUTE` for a trivial READ_ONLY step |
| 2 | simulation input immutable | input object unchanged after `run()`; `inputHash` stable across repeat calls |
| 3 | fake provider only | 0 forbidden module imports (import-graph scan) |
| 4 | no real provider dispatch | 0 mutations across 20 security-test runs + 513-scenario evaluation, `realSideEffects=0` |
| 5 | policy parity | 100.00% across 513 scenarios (target ≥99.5%) |
| 6 | risk parity | `riskForAction()` matches `step.riskClass` for all 3 canonical action types; 30/30 (100%) in the dedicated parity test |
| 7 | budget what-if | exhausted budget → `WOULD_BLOCK` / `BLOCK_BUDGET` |
| 8 | kill-switch what-if | GLOBAL kill switch → `WOULD_BLOCK` / `BLOCK_KILL_SWITCH` |
| 9 | delegation what-if | EXPIRED → ineligible, VALID → eligible |
| 10 | approval what-if | no delegation → `WOULD_REQUIRE_APPROVAL`; valid delegation → `WOULD_EXECUTE` |
| 11 | DAG simulation | 2-step plan resolves in dependency order |
| 12 | dependency failure | a failed step permanently blocks its dependent |
| 13 | ambiguous provider | `UNCERTAIN` + `reconciliationRequired=true`, never collapsed to a plain failure |
| 14 | forbidden capability | `WOULD_BLOCK`, `authoritySurface=null`, reason includes `FORBIDDEN_CAPABILITY` |
| 15 | legacy quarantine | `WOULD_BLOCK`, reason includes `LEGACY_QUARANTINED` |
| 16 | zero execution-ledger mutation | `realExecutionLedgerMutations=0` across 513 scenarios |
| 17 | zero budget reservation | `realBudgetConsumption=0` across 513 scenarios |
| 18 | zero delegation consumption | `realDelegationQuotaConsumption=0` (simulator never instantiates a real delegation store) |
| 19 | evidence semantics correct | `evidenceRefs` only `GOVERNANCE:`/`SIMULATION:` prefixed; reason text uses "WOULD", never past tense |
| 20 | 500-case evaluation passes | 513 scenarios, `determinismRate=1`, `realSideEffects=0` |
| 21 | authority parity | simulated `authoritySurface`/`canonicalOwner` matches the real, current authority manifest exactly |
| 22 | provider timeout | `UNCERTAIN` + `reconciliationRequired=true`, distinct from ambiguous result (point 13) |

### §43 — performance by plan size

| Plan | p50 | p95 | reps |
|---|---|---|---|
| 1-step | 50ms | 54ms | 10 |
| 10-step | 52ms | 55ms | 10 |
| 50-step | 53ms | 54ms | 10 |
| 100-step | 53ms | 54ms | 10 |
| 500-scenario batch | 51ms | 54ms | 513 |

Latency is flat regardless of plan size — no external network dominates
simulation cost, confirming the ephemeral-store-only design.

## §39 — Parity test (`npx tsx automation-simulation-parity.test.ts`)

30/30 checks matched (100%, target ≥99.5%). Categories: policy decision + risk
classification (3 action types, live-proposal path vs. simulated path), kill-switch
state, budget state, delegation eligibility (5 scenarios × direct pure-function
call vs. simulator), authority-surface classification. One known, intentional,
non-governance divergence is logged and shown not to affect any decision field:
the simulator hashes the raw payload while `ControlledActionService.propose()`
hashes the normalized payload — the default policy set has no rule keyed on
payload content, so this never changes `policyDecision`/`approvalRequirement`/
`riskClass`.

## §40 — 500+ scenario evaluation (`npx tsx simulation-evaluation.ts`)

513 deterministic scenarios across 9 categories:

| Category | Count |
|---|---|
| Action-type × provider-outcome × delegation matrix | 420 |
| Kill switches (GLOBAL/PROJECT/ACTION_TYPE) | 9 |
| Budgets (available/exhausted) | 6 |
| Concurrency what-if | 9 |
| Forbidden capability | 4 |
| Legacy quarantine | 15 |
| Malformed/invalid input (DAG) | 10 |
| Multi-step plans | 30 |
| Local-only steps | 10 |

Results: `policyParity=1`, `determinismRate=1`, `realSideEffects=0`,
`realExecutionLedgerMutations=0`, `realBudgetConsumption=0`,
`realDelegationQuotaConsumption=0`, `policyBypassCount=0`,
`killSwitchBypassCount=0`, `authorityBypassCount=0`, `invalidObjectIdCount=0`.
p50 latency 50ms, p95 54ms — each scenario run twice (determinism check) for a
total of 1,026 simulation runs.

## §38 — Security tests (`npx tsx automation-simulation-security.test.ts`)

3 groups, all passing. See `docs/security/PHASE6F_SIMULATION_BOUNDARY.md` for the
full detail of what each proves.

## §37 — Core tests (`npx tsx automation-simulation.test.ts`)

Simple local step, Controlled Action + provider SUCCESS, approval-required gating,
kill-switch what-if, budget what-if, delegation what-if (expired denies / valid
eligible), provider TIMEOUT/AMBIGUOUS_RESULT, plan DAG, failure propagation,
forbidden capability, legacy quarantine, invalid DAG (unknown dependency + cycle),
reversibility metadata. All passing.

## Build

`npx tsc --noEmit` clean in `server/` and `command-center/` (`tsc -b && vite build`)
after every commit on this branch.

## Command Center

`/simulation` page built and verified: `command-center` production build succeeds,
both existing command-center suites pass unaffected (`test:command-center` 18/18,
`test:command-center-security` 20/20), and the Playwright E2E suite
(`test:command-center-e2e`) now includes a dedicated Phase 6F Simulation flow test
(login → Simulation → run default scenario → inspect policy/approval/expected
side-effect preview → configure kill-switch what-if → inspect `WOULD_BLOCK` →
confirm banner → confirm zero execute/send/approve/deploy controls → confirm
real `/actions` and `/governance/status` state byte-identical before/after,
against the actual compiled server, not a mock). 5/5 tests pass, run twice per
§47, no orphan `LISTENING` process on the E2E port after either run (only
expected TCP `TIME_WAIT` teardown entries).

## Full regression

- `npm ci` (root, server, command-center) — clean.
- Root `npm run build` (server `tsc` + command-center `tsc -b && vite build`) — clean.
- `npx tsc --noEmit` (server) — clean.
- Root `npm run test:ci` (server's full `test:ci`, including the new
  `test:automation-simulation(-security|-parity)`) — clean, exit code 0.
- Phase 5A, 5B, 5C, 5D2, 5D3, 5F, 5G, 5H, 5I, 6A, 6B, 6C, 6D, 6E acceptance scripts
  — all PASS.
- `agentic-coding:acceptance` — the fixture-based checks pass; the Ollama-dependent
  real-world-certification pilot fixtures report `MODEL_UNAVAILABLE` (`ollama
  unreachable at http://127.0.0.1:11434`) — a pre-existing environmental
  dependency (no local Ollama service running on this machine), not a Phase 6F
  regression and not something this phase's scope covers.
- `npm run authority:manifest` / `authority:manifest:check` — clean:
  `unknownMutations=0`, `unresolvedLegacyMutations=0`. New rule added for
  `/api/(command-center/)?simulation/*` (`CANONICAL_LOCAL_MUTATION` /
  `LOCAL_REVERSIBLE`, governance/approval/delegation all `false`).
- §46 hygiene scans on the branch diff — clean: no conflict markers, no new
  hardcoded `D:\`/`E:\` paths, no `.db`/`.sqlite` artifacts added, no `dist/`
  output committed, no `child_process`/`exec`/`spawn` in
  `automation-simulation/`.

### Two pre-existing bugs found and fixed (not introduced by this phase)

Both are the same root cause, surfaced only because this repository now runs from
a filesystem that doesn't record ownership: code that shelled out to plain `git`
with no `safe.directory` override silently failed closed (git refuses to run
at all — "dubious ownership"), which the calling code's try/catch swallowed into
a `null`/`false` result.

1. `server/src/project-registry/service.ts`'s `gitOutput()` — caused
   `registry-guard.test.ts`'s `sourceSha` assertion to fail.
2. `server/src/__tests__/tracked-credential-scan.test.ts`'s `isTracked()` — caused
   the "keys.example.json should remain tracked" assertion to fail.

Fixed identically in both: pass `-c safe.directory=<repoRoot>` as a
per-invocation git argument (never a persistent config change — matches the
project's existing "never touch global git config" discipline).

Also fixed, same drive-migration class of bug but unrelated to git ownership:
`server/src/knowledge/reference-brain-path.ts`'s `getMiCoreRoot()` and
`registry-guard.test.ts`'s own `repoRoot` computation both assumed a
`<root>/server/package.json` nested-monorepo layout; both now detect nested vs.
flattened-deploy-snapshot layouts.

## Independent review

Performed against PR #92's actual pushed diff (not the implementation summary):
re-verified all 22 acceptance points, the import-graph scan, the manifest diff
(purely additive, arithmetically consistent — `+9` surfaces exactly accounts
for the `+5`/`+4`/`+6`/`+3` count deltas), the `AUTHORITY_RULES.find()`
first-match-wins + `CANONICAL_PREFIXES` GET-override logic, and reproduced
`GMAIL_SEND_DRAFT` without `forbiddenCandidate` to confirm it's blocked by the
real R4-risk `DENY` rule rather than relying on the caller remembering to flag
it. One finding: the `SimulationCapabilityToken` comments/docs overstated
TypeScript's structural typing as a hard construction-impossibility guarantee.
Fixed (commit `6a15c233`) — reworded to describe it as an internal
convention/guard, with the real guarantee correctly attributed to
`fake-providers.ts`'s proven absence of any real-provider import plus the
tests proving zero real dispatch. No other findings.

## Still pending before merge/deploy

- Merge, deploy, live production acceptance (§54, now also covering the
  deferred §42), closure docs — none of which proceed without explicit
  confirmation per this program's standing instruction.
