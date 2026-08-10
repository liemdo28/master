# Phase 5G Action Governance

Phase 5G adds a deterministic governance layer to the Phase 5F Controlled Actions path.

Canonical path:

`proposal -> policy evaluation -> explicit approval -> execution revalidation -> budget reservation -> provider -> governance audit`

The only provider execution boundary remains `ControlledActionService.execute`.

## Decisions

`ActionPolicyEngine` returns immutable `PolicyDecision` records with:

- risk class and deterministic factors
- decision and required approval level
- matched and denied policies
- budget state
- kill-switch state
- contextual constraints
- policy version and content hash
- input hash and decision hash

Execution fails closed when the policy system cannot evaluate, policy is missing, context is stale, budget is exhausted, or kill switch is enabled.

## Approval Levels

- `NONE`
- `STANDARD`
- `STRONG`
- `DUAL_CONFIRMATION`

Initial rules use:

- Gmail draft: `R2`, `STANDARD`
- Calendar proposal: `R1`, `STANDARD`
- Calendar create: `R3`, `STRONG`
- R4, Gmail send, financial/legal/credential/merge/deploy: denied

## Strong Approval

Strong approval requires typed deliberate confirmation:

`CONFIRM:<proposalId> <decisionHashShort>`

Command Center shows target, side effects, expiry, payload hash, policy version, and budget state before approval.

## No New Capability

No new external action type is introduced. Gmail SEND remains absent from the provider path.
