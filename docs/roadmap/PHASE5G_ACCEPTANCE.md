# Phase 5G Acceptance

Required local gates:

```powershell
npm --prefix server run test:action-governance
npm --prefix server run test:action-governance-security
npm --prefix server run test:action-governance-restart
npm --prefix server run test:action-governance-evaluation
npm --prefix server run phase5g:acceptance
```

Targets:

- unauthorized allow: `0`
- denied action executed: `0`
- kill-switch bypass: `0`
- budget bypass: `0`
- deterministic decisions: `100%`
- correct policy result: `>= 99%`
- schema version: `8`
- Gmail SEND absent from Controlled Actions provider path
- no new external action types

Production acceptance must use local-only proposals for destructive policy tests.
