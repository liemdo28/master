# Phase 5F Controlled Actions

Mi may propose and prepare actions, but every external side effect requires an exact, inspectable, expiring approval.

## Model

Risk classes:

- `R0` local read
- `R1` local reversible
- `R2` external reversible
- `R3` external side effect
- `R4` high risk, forbidden in Phase 5F

Implemented action types:

- `GMAIL_CREATE_DRAFT`
- `CALENDAR_EVENT_PROPOSAL`
- `CALENDAR_CREATE_EVENT`

`GMAIL_SEND_DRAFT` is deliberately blocked until draft creation is proven.

## Approval Binding

`ActionApproval` binds:

- proposal ID
- action type
- target system
- target summary
- payload hash
- expiry window
- approved payload snapshot

Any payload change causes a hash mismatch and blocks execution.

## Execution

`ControlledActionService` verifies:

1. proposal status
2. approval exists
3. approval has not expired
4. payload hash matches
5. risk class is allowed
6. provider mode is permitted
7. idempotency key has not executed

No automatic retry is performed. Duplicate execution returns the original execution record.

## Provider Mode

Default mode is `fixture`. Live provider writes are blocked in local acceptance unless a sandbox connector is explicitly configured.
