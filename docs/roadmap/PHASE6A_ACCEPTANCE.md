# Phase 6A Acceptance

Phase 6A is complete when the repository has:

- A generated authority manifest covering HTTP routes, CLI commands, and background workers.
- A startup assertion that blocks unknown mutations and external write bypasses.
- Read-only Command Center visibility into the authority inventory.
- Quarantine guards for legacy external/process-control routes.
- Security checks proving no new Gmail SEND, financial action, voice output expansion, desktop control, autonomous approval, or autonomous deployment path was introduced.
- A 200-case synthetic evaluation with 100 percent classification correctness and zero bypasses.

Required evidence commands:

```powershell
npm --prefix server run authority:manifest:check
npm run test:authority-control-plane
npm run test:authority-control-plane-security
npm run phase6a:acceptance
npm --prefix server run authority-control-plane:evaluation
```

Phase 6B must not start until Phase 6A is merged and frozen.
