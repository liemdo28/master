# Phase 5H Approval Boundaries

**Plan approval is not external-action approval.** Validating, starting, pausing,
resuming, or advancing a plan is a structural operation over plan/step state. It never
authorizes an external side effect.

## The Only Approval Surface

`GovernedOrchestrationService` has no `approve()` method for Controlled Action steps —
not a restricted one, not an internal one. It does not exist. The only way a Controlled
Action proposal created by orchestration becomes approved is the pre-existing
`ControlledActionService.approve()` surface (API, CLI, or Command Center Actions page),
exactly as it was before Phase 5H. `advance()` only ever *observes* a proposal's status
and reacts; it never calls `approve()`.

This makes the approval boundary structurally impossible to cross, not merely
policy-forbidden.

## Binding

Every approval binds to one exact proposal: proposal ID, action type, target, expiry,
and a payload hash taken at proposal time. At execution:

- a different proposal ID — rejected (`missing approval`)
- a mutated payload — rejected (`payload hash mismatch`)
- an expired approval — rejected (`approval expired`)

**An approval for Step A never authorizes Step B.** Two Controlled Action steps in the
same plan get two independent proposals; approving one leaves the other
`WAITING_APPROVAL`.

## Plan Versions Do Not Carry Approvals

`createNewVersion()` starts every step's `proposalId` at `null`. A prior version's
approved-but-unexecuted proposals are rejected, not silently discarded and not
transferred. The new version must be independently validated, started, and re-approved
step by step.

## Phase 5H Cannot Loosen Phase 5G

**Phase 5H cannot authorize an action that Phase 5G would deny.** Every Controlled
Action step still passes through `ActionPolicyEngine.evaluate()`, the kill switch, and
budget checks exactly as it would if the same proposal had been created outside
orchestration. Orchestration adds no bypass path and reuses the same policy version and
policy hash Phase 5G already computes.

**Phase 5H introduces no new external action type.** See
[`PHASE5H_GOVERNED_ORCHESTRATION.md`](PHASE5H_GOVERNED_ORCHESTRATION.md).
