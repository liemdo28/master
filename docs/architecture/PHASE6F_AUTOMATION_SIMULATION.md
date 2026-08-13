# Phase 6F — Governed Automation Simulation — Architecture

Date: 2026-08-13

## Mission

Let Mi rehearse a Controlled Action or a short plan and answer, truthfully, "what
WOULD happen if this were attempted right now?" — using the exact same governance
rules the live system uses — without ever producing a real external side effect.
Simulation is not a second execution engine; it is a read/what-if layer over the
canonical Phase 5F/5G/5H/5I evaluators.

See `docs/architecture/PHASE6F_COMPONENT_AUDIT.md` for the full reuse-vs-fork
classification of every existing component considered before writing new code.

## The one canonical service

`server/src/personal-os/automation-simulation/service.ts` exports
`AutomationSimulationService`, the single simulator. It never calls
`ControlledActionService.propose()/approve()/execute()/reject()/cancel()`, never
imports a real provider writer, and never mutates any store outside its own
per-run ephemeral one.

### Ephemeral-store reuse pattern

`ActionPolicyEngine.evaluate()` is not pure — it writes `policy_decisions` and
`governance_events` rows. Rather than fork a pure re-implementation of policy
evaluation (which would risk silently drifting from the real rules), the simulator
constructs a fresh, disposable `ControlledActionService` per run:

```
fs.mkdtempSync(os.tmpdir()) → new ControlledActionService(tmpRoot)
```

This bootstraps the exact same Phase 5F/5G schema and seeds the exact same default
policy set (`phase5g-default-v1`) and default budgets a fresh production database
would get — not a copy of production data, a *reproduction by construction*, which
holds as long as production hasn't diverged from the seeded defaults (confirmed
true in every acceptance report since Phase 5G). Only `.policyEngine` is ever read
from this instance. The temp directory is deleted unconditionally in a `finally`
block after every run, whether it succeeded or threw.

This is not a novel pattern for this codebase — `fs.mkdtempSync` isolated stores
are how this project's own test suite has always isolated state; `:memory:` SQLite
is never used anywhere in this repository.

### Pure vs. impure evaluators, and how each is used

| Evaluator | Purity | How simulation uses it |
|---|---|---|
| `RiskEvaluator.assess()` | Pure | Called directly |
| `validateDag()` / `dependencyBlockState()` | Pure | Called directly |
| `evaluateDelegationEligibility()` / `computeDecisionHash()` | Pure | Called directly with a synthetic in-memory `DelegatedAuthority` + `EligibilityContext` |
| `KillSwitchService.state()` | Impure, read-only | Called against the ephemeral store |
| `BudgetManager.state()` | Impure, read-only | Called against the ephemeral store |
| `ActionPolicyEngine.evaluate()` | Impure, writes | Called unmodified against the ephemeral store only |

No governance logic is reimplemented. The unmodified real classes/functions are
called; only the store they read/write against is swapped for a disposable one.

## Simulation input (§4)

`SimulationInput` supports five `kind`s: `EXISTING_PLAN_SNAPSHOT`, `PROPOSED_PLAN`,
`SINGLE_PROPOSAL`, `DELEGATED_CANDIDATE`, `POLICY_WHAT_IF`. Each `SimulationStepInput`
is immutable once passed to `run()` — never mutated by the service — and every run
computes `inputHash = sha256(stableStringify(input))` so the same input always
hashes identically (verified: point 2 of `phase6f-acceptance.ts`).

## Simulation result (§5)

`SimulationRun` / `SimulationStepResult` use outcome states `SIMULATED`,
`WOULD_EXECUTE`, `WOULD_REQUIRE_APPROVAL`, `WOULD_BLOCK`, `WOULD_FAIL`, `UNCERTAIN`,
`INVALID` — `EXECUTED` never appears anywhere in this module; that word is reserved
for the real execution ledger.

### The approval-gate decision, precisely

Under the real default policy set, **all three** canonical action types
(`GMAIL_CREATE_DRAFT`, `CALENDAR_EVENT_PROPOSAL`, `CALENDAR_CREATE_EVENT`) require
at least `STANDARD` approval — there is no rule that ever produces a plain `ALLOW`.
So `simulateStep()` always computes the fake provider's hypothetical effect once
policy doesn't outright `DENY`/`BLOCK_*` (reported in `expectedProviderEffect`,
regardless of whether approval is required), and the **primary** `result` becomes
`WOULD_EXECUTE`/`WOULD_FAIL`/`UNCERTAIN` only when a delegation what-if makes the
step eligible to bypass the human-approval gate
(`delegationDecision.eligible === true`); otherwise `result` stays
`WOULD_REQUIRE_APPROVAL`, with the hypothetical provider outcome still visible
alongside it ("If approved, the provider WOULD then respond: …").

## Fake provider layer (§8/§9/§10)

`fake-providers.ts` is the only place that produces a hypothetical provider
response. It is pure and synchronous — no network, no OAuth, no filesystem, no
timers — and deterministic: `runFakeProvider(token, actionType, payloadHash,
scenario)` seeds its simulated object id from a SHA-256 hash of its own inputs, so
identical input always produces an identical `sim-gmail-draft-…` /
`sim-calendar-event-…` id. Supported scenarios: `SUCCESS`, `VALIDATION_ERROR`,
`TIMEOUT`, `RATE_LIMIT`, `UNAVAILABLE`, `AMBIGUOUS_RESULT` (§21 — flagged
`reconciliationRequired`, never collapsed into a plain failure),
`PARTIAL_FAILURE`.

A `SimulationCapabilityToken` (`{ readonly __simulationOnly: true }`) is minted only
inside `fake-providers.ts` and required as the first argument to
`runFakeProvider()` — a type-level proof, not just a runtime flag, that the fake
provider path cannot be satisfied by anything outside this module (§33).

## Persistence (§7/§43)

No new schema. Simulation results are ephemeral: an in-process, bounded
(`MAX_CACHE=200`) `Map` in `router.ts`, cleared on process restart, never written to
any database table. Schema remains v10.

## Authority integration (§25)

Every `CONTROLLED_ACTION` step looks up the real, current authority manifest
(`generateAuthorityManifest(resolveAuthorityRepoRoot(...))`, read-only) for the one
real execute surface (`http:POST:/api/actions/:id/execute`). If that surface isn't
found in the manifest, the step fails safely (`INVALID`,
`"UNKNOWN_MUTATION: no canonical authority surface found…"`) rather than inventing
one.

## Evidence semantics (§26)

Simulation predictions are never presented as historical fact. Reasons are always
phrased as "WOULD" ("Calendar event WOULD be created under this scenario."),
never past tense ("was created"). `evidenceRefs` only ever carry `GOVERNANCE:` or
`SIMULATION:` prefixes, never a bare id that could be mistaken for a real
execution record.

## Concurrency what-if (§20)

`concurrentCandidateCount > 1` downgrades an otherwise-`WOULD_EXECUTE` result to
`UNCERTAIN` when it would exceed the remaining budget slots reported by the real
`BudgetManager.state()` — modeling the canonical budget/idempotency evaluator's
real behavior without ever actually reserving anything.
