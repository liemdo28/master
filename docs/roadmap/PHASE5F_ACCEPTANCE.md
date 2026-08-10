# Phase 5F Acceptance

Required local gates:

- `npm run test:controlled-actions`
- `npm run test:controlled-actions-security`
- `npm run test:controlled-actions-restart`
- `npm run test:controlled-actions-evaluation`
- `npm run phase5f:acceptance`

Fixture acceptance covers:

- Gmail draft proposal, approval, execution, duplicate prevention.
- Rejection.
- Expiry.
- Payload tampering.
- Calendar local proposal.
- Calendar fixture create.
- Conflict invalidation.
- Restart persistence.
- 50-case evaluation.

Real sandbox acceptance:

- Blocked unless a safe Gmail/Calendar sandbox account and scopes are configured.
- No production recipients may be used.
- No real email send is part of Phase 5F.

Stop condition:

- Open PR only.
- Do not merge.
- Do not deploy.
