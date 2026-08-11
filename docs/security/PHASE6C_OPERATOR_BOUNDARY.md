# Phase 6C Operator Boundary

Phase 6C adds visibility only. It does not add an approval path, execution path, scheduler, generic mutation API, or bulk operator command.

## Boundary Guarantees

- Operator APIs are GET-only.
- Command Center routes are protected by remote session authentication.
- Raw `/api/operator/*` routes are protected by strict API-key authentication.
- Operator items expose summaries and evidence references, not raw provider payloads.
- Secret-shaped text is redacted before display.
- Effective authority is conservative and requires canonical re-checks.
- Delegation summaries are read from persisted rows; the cockpit does not call delegation authorization methods.

## Forbidden Expansions

- No `GMAIL_SEND_DRAFT`.
- No calendar write outside `CALENDAR_EVENT_PROPOSAL` and `CALENDAR_CREATE_EVENT`.
- No bulk approve.
- No one-click approve.
- No generic mutation endpoint.
- No autonomous deploy or merge authority.
- No new schema version.

## Tests

- `npm run test:operator-control-center-security`
- `npm --prefix command-center run test:command-center-security`
- `npm run operator-control:evaluation`

The 300-case evaluation asserts zero false execution-authority claims, zero missing critical approvals, zero cross-project leaks, zero secret/private payload leaks, and deterministic output.
