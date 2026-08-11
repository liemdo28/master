# Phase 6B Legacy Authority Adapters

Phase 6B keeps the Phase 5 control plane as the only mutation authority. Legacy mutation surfaces do not gain a new executor path. They are either mapped into an existing canonical Controlled Action proposal or denied by the quarantine handler.

## Contract

- `ADAPT_SAFE`: legacy semantics are read-only or can be represented without expanding authority.
- `ADAPT_WITH_BEHAVIOR_CHANGE`: legacy callers receive a compatible response, but mutation intent is converted to a canonical proposal that remains `WAITING_APPROVAL`.
- `QUARANTINE_ONLY`: legacy mutation intent is denied deterministically.
- `REQUIRES_FUTURE_AUTHORIZATION`: the request is denied until a later phase explicitly creates a canonical authority.
- `DEAD_UNWIRED`: recorded as inactive/dead surface only; no runtime mutation route is allowed.

The runtime startup guard fails closed when any legacy mutation surface lacks a Phase 6B disposition, when an adapted legacy mutation lacks an adapter target, or when a quarantined mutation lacks a quarantine handler.

## Adapter Targets

`LegacyAuthorityAdapter` only maps the following existing canonical action types:

- `GMAIL_CREATE_DRAFT`
- `CALENDAR_EVENT_PROPOSAL`
- `CALENDAR_CREATE_EVENT`

The adapter does not send Gmail messages, execute calendar writes directly, run process commands, deploy code, move money, operate browsers, or perform generic external-provider writes. Adapted requests become `ControlledActionService` proposals and require the existing approval/execution pipeline before any provider effect can happen.

## Quarantine

Legacy process control, browser write, voice output send, generic workflow trigger, COO/autonomy execution, financial execution, and unsupported external action semantics return `LEGACY_AUTHORITY_QUARANTINED`, `LEGACY_AUTHORITY_FORBIDDEN`, or `LEGACY_AUTHORITY_UNSUPPORTED_SEMANTICS`.

The authority manifest records disposition, adapter target, quarantine handler, and canonical replacement fields for every legacy mutation surface.
