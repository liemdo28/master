# Phase 5H Governed Orchestration

Phase 5H adds a multi-step planning and execution layer on top of the Phase 5F/5G
Controlled Actions and governance stack. It is an orchestration layer, not a second
governance engine.

Canonical service: `GovernedOrchestrationService`
(`server/src/personal-os/orchestration/service.ts`).

## Schema

`personal-os.db` migrates v8 -> v9 (`applyPhase5hMigration`), adding:

`action_plans`, `action_plan_steps`, `action_plan_dependencies`, `action_plan_runs`,
`action_plan_step_attempts`, `action_plan_evidence`.

No existing Phase 5F/5G table is altered. `action_proposals.sourcePlanId` — present
since Phase 5F, unused until now — is populated by the orchestration layer when it
creates a proposal.

## Plan Lifecycle

`DRAFT -> VALIDATED -> READY -> RUNNING -> (WAITING_APPROVAL <-> RUNNING) -> COMPLETED`,
with `PAUSED`, `FAILED`, `CANCELLED` reachable per `PLAN_ALLOWED_TRANSITIONS`. Steps
follow an analogous `STEP_ALLOWED_TRANSITIONS` map. Both are explicit allow-lists;
state-skipping transitions throw.

## Step Types

- `READ_ONLY` — no side effect, always safe.
- `LOCAL_COMPUTE` — local, no external system contact.
- `CONTROLLED_ACTION` — must reference an entry in
  `ORCHESTRATION_ALLOWED_ACTION_TYPES`: exactly `GMAIL_CREATE_DRAFT`,
  `CALENDAR_EVENT_PROPOSAL`, `CALENDAR_CREATE_EVENT`. Any other action type is
  rejected at `createPlan`/`createNewVersion`, before a proposal ever exists.

## Dependency Graph

`dag.ts` validates the step graph with Kahn's algorithm — deterministic, no LLM
involved in dependency correctness. A step is only eligible once every dependency is
`COMPLETED`; a `FAILED` or `CANCELLED` dependency permanently blocks its dependents.

## Execution

`advance()` is the single polling entrypoint. For each eligible step it either runs the
safe local logic inline (`READ_ONLY`/`LOCAL_COMPUTE`) or, for `CONTROLLED_ACTION` steps,
creates a Controlled Action proposal (or observes the existing one) and asks
`ControlledActionService.execute()` to run it once — and only once — that proposal has
been approved through the pre-existing Controlled Actions surface. `advance()` never
approves anything itself.

## No New Capability

No new external action type is introduced. Gmail SEND remains absent from the provider
path — `ORCHESTRATION_ALLOWED_ACTION_TYPES` rejects `GMAIL_SEND_DRAFT` before a plan can
even be created, independent of the pre-existing Phase 5F hard block on that type.

See [`PHASE5H_APPROVAL_BOUNDARIES.md`](PHASE5H_APPROVAL_BOUNDARIES.md) for the approval
model and [`PHASE5H_COMPONENT_AUDIT.md`](PHASE5H_COMPONENT_AUDIT.md) for what was reused
versus built new.
