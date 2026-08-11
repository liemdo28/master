# Phase 6C Freeze Policy

Effective with functional production SHA `09644625ea86b3730b3c27c6abae7cff0bccdf80`, Phase 6C Operator Control Center semantics are frozen.

## Frozen Semantics

- `OperatorControlService` is observational.
- Operator APIs are read-only.
- Operator APIs are authenticated.
- Execution truth comes from canonical execution and evidence state.
- Proposal does not equal execution.
- Approval does not equal execution.
- Orchestration intent does not equal execution.
- Delegation does not equal execution.
- UI state does not equal execution truth.
- Quarantine remains visible.
- Unknown state must not be fabricated into known state.

## Forbidden In Phase 6C

Phase 6C grants no mutation authority. The Operator Control Center must not add or expose:

- Approval or rejection.
- Execution.
- Retry or cancel.
- Bulk approval.
- Policy mutation.
- Kill-switch mutation.
- Budget mutation.
- Delegation mutation.
- Orchestration mutation.
- Task or project mutation.
- External writes.
- Gmail SEND.
- New external action types.
- Financial actions.
- Autonomous merge or deploy.
- Voice authority expansion.
- Desktop control.

## Required Evidence For Future Changes

Any future mutation authority added to the Operator Control Center requires a separate explicit phase or change directive and all of the following:

- Authority architecture review.
- Security regression tests.
- Negative execution tests.
- Duplicate side-effect tests where applicable.
- Policy and governance validation.
- Sandbox acceptance where applicable.
- Reviewable PR.

No mutation authority may be inferred from the presence of pending approvals, active delegations, orchestration plans, UI affordances, or operator labels.

## Truth Policy

Operator views must label facts, blocked states, stale states, and unknown states honestly.

Execution may be displayed only when canonical execution/evidence state proves it. The UI and service must never report `Mi can execute`, `executed`, `completed`, or equivalent language from proposal, approval, plan, task, delegation, or display state alone.

## Authority Boundary

The canonical external action boundary remains limited to:

- `GMAIL_CREATE_DRAFT`.
- `CALENDAR_EVENT_PROPOSAL`.
- `CALENDAR_CREATE_EVENT`.

`GMAIL_SEND_DRAFT` remains documented as forbidden/not implemented and must not become delegation-eligible, orchestration-allowed, or executable without a future explicit release.

Calendar execution must continue to suppress provider notifications with `sendUpdates: 'none'`.
