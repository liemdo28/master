# Phase 6F — Acceptance

Date: 2026-08-13

Status: **implementation and gates complete, not yet merged/deployed.** This
document records local acceptance results from the working branch. Release
provenance (PR number, merge SHA, deployed SHA, predeploy backup path, live
production acceptance) will be filled in below once the PR opens, passes
independent review, merges, and deploys — per the same two-stage doc pattern
Phase 6D/6E used (functional PR doc, then a closure update).

## Release provenance (pending)

- Branch: `codex/phase6f-governed-automation-simulation`.
- Based on: `30ca642b0a22e65256831b474f13337a58b6ac19` (Phase 6E docs-only closure,
  the current repository master).
- PR: not yet opened.
- Merge SHA: pending.
- Deployed SHA: pending (production remains on the Phase 6E functional SHA,
  `e766feb15dab24355ad84b63c8c4f3c7201a0f95`, until this phase deploys).

## §41 — 20-point acceptance (`npm run phase6f:acceptance`)

All 20 points PASS. Live local output:

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

`npx tsc --noEmit` clean in `server/` after every commit on this branch.

## Still pending before merge

- Command Center UI build/type-check verification (`command-center/` — in
  progress).
- `package.json` script wiring for the new test/eval/acceptance commands.
- Authority manifest regeneration to reflect the two new simulation routes.
- Full regression (`npm ci`, root `npm run build`, `npx tsc --noEmit`,
  `npm run test:ci`, Phase 5A–5I, Phase 6A–6F, Agentic Coding, Command Center
  unit/security/E2E).
- Hygiene scans (§46).
- PR open, independent review, merge, deploy, live production acceptance,
  closure docs — none of which proceed without explicit confirmation per this
  program's standing instruction.
