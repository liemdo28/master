# Phase 6C Runbook

## Local Verification

Run from the repository root:

```powershell
npm run test:operator-control-center
npm run test:operator-control-center-security
npm run operator-control:evaluation
npm run phase6c:acceptance
npm --prefix server run build
npm --prefix command-center run build
npm --prefix command-center run test:command-center
npm --prefix command-center run test:command-center-security
```

## Production Read-Only Check

Use existing authenticated read endpoints only:

- `/api/health`
- `/api/tools`
- `/api/authority/status`
- `/api/operator/overview`
- `/api/operator/pending`
- `/api/operator/authority`
- `/api/operator/blocked`

Do not approve, reject, execute, cancel, submit, resume, deploy, merge, or restart production as part of Phase 6C closure.

## Troubleshooting

- If operator counts differ from existing source pages, compare the source IDs returned by `/api/operator/pending` to the individual Task Runtime, Actions, Delegations, Plans, and Authority pages.
- If a blocked reason is unexpected, inspect the stored governance decision or proposal failure code. Do not add a new policy evaluator in the cockpit.
- If a field risks exposing sensitive data, redact it in `server/src/operator-control/redaction.ts` before it reaches the response body.
