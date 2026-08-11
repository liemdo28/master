# Phase 5I Delegated Authority

Phase 5I adds `DelegationService`, a pre-authorization layer over the existing
Phase 5F/5G/5H governed action stack. It lets a human grant a narrow, time-limited,
strongly-approved authority for Mi to execute a bounded class of already-existing
Controlled Actions **without a fresh human approval for each one** — but only within
limits the human explicitly set in advance, and only after the human's own strong
approval of the delegation itself.

**Delegation is not plan approval and not a single action approval.** These are three
strictly separate concepts:

| Concept | What it authorizes |
|---|---|
| Plan approval (Phase 5H) | Workflow *structure* only — never an external action. |
| Action approval (Phase 5F) | Exactly one Controlled Action proposal, exactly once. |
| Delegation (Phase 5I) | A tightly bounded *class* of future actions, pre-authorized once. |

## Canonical Path

```
Governed Orchestration
        v
Controlled Action Proposal
        v
ActionPolicyEngine (Phase 5G — unmodified, always authoritative)
        v
Delegation eligibility check (18-point, deterministic, Phase 5I)
        v
Risk / budget / kill-switch / context checks (Phase 5G — same as any other approval)
        v
Eligible delegated execution -> ControlledActionService.approve() -> execute()
```

`DelegationService` never calls a provider. It only ever calls the pre-existing
`ControlledActionService.approve()` — exactly the same surface a human uses — with
`approver: "delegation:<id>"` recorded in the audit trail. Execution still flows
through the unmodified `ControlledActionService.execute()`, which independently
re-validates payload hash, risk, budget, and policy at dispatch time regardless of how
approval was granted.

## Contract

`DelegatedAuthority` (`server/src/personal-os/delegation/types.ts`): project-scoped,
action-type-scoped, target-scoped, time-windowed, execution- and target-quota-capped,
with an explicit `riskCeiling` and `approvalLevelCeiling`. Status machine:
`DRAFT -> WAITING_APPROVAL -> ACTIVE -> {PAUSED, PAUSED_POLICY_CHANGED, EXPIRED,
EXHAUSTED, REVOKED, CANCELLED}` — every transition explicit
(`DELEGATION_ALLOWED_TRANSITIONS`), nothing else reachable.

## Immutable Snapshot

Strong approval writes a `delegation_versions` row — an immutable snapshot of the
exact scope, policy version/hash, and payload hash approved — created once, at
`WAITING_APPROVAL -> ACTIVE`, never updated afterward. Any material change (wider
action types, higher risk, more budget, a new target, a later expiry, a different
project, wider target domain, different allowed hours) requires a brand new
`(id, delegationVersion)` pair and a fresh strong approval; the old version's
approval never carries forward.

## Default Deny Unchanged

With no matching `ACTIVE` delegation, Phase 5F's existing per-action approval
requirement applies exactly as before Phase 5I existed. Delegation is an explicit,
narrow exception a human opts into — never a new default.

## Eligible Action Types

Only the 3 pre-existing Phase 5F types: `GMAIL_CREATE_DRAFT`, `CALENDAR_EVENT_PROPOSAL`,
`CALENDAR_CREATE_EVENT` (the last only under a `STRONG`-ceiling delegation with an
explicit calendar/attendee restriction). **Phase 5I introduces no new external action
type. Gmail SEND remains unavailable** — attempting to include `GMAIL_SEND_DRAFT` in
any delegation throws at creation time, before a delegation can even reach `DRAFT`.

Approval-boundary detail lives in
[`PHASE5I_DELEGATION_SECURITY.md`](../security/PHASE5I_DELEGATION_SECURITY.md); reuse
detail lives in [`PHASE5I_COMPONENT_AUDIT.md`](PHASE5I_COMPONENT_AUDIT.md).
