# Phase 5G Governance Security

Security posture:

- External actions fail closed on policy errors.
- Highest-priority deny wins.
- Kill switch is checked at proposal, approval, and execution.
- Budget reservation is transactional.
- Strong approval cannot be satisfied by a repeated button click.
- Secret-bearing payloads are rejected before provider execution.
- Policy decisions record input and decision hashes.
- Governance audit events are append-only.

Forbidden capabilities remain forbidden:

- Gmail SEND
- financial actions
- legal actions
- credential changes
- merge/deploy actions
- autonomous approvals
- autonomous action chains

Security tests:

- `npm run test:action-governance-security`
- `npm run test:action-governance-restart`
- `npm run test:action-governance-evaluation`
