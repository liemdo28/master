# Phase 6B Operations Runbook

## Inspect

- Use `/api/authority/status` for the authority summary.
- Use `/api/authority/legacy-migration` for the legacy migration inventory.
- In Command Center, open Authority to review legacy, adapted, quarantined, and unresolved counts.

Expected Phase 6B source manifest:

- total: 1027
- mutations: 394
- legacy mutations: 190
- adapted legacy: 4
- quarantined legacy: 186
- unresolved legacy mutations: 0
- unknown mutations: 0

## Accept

Run the Phase 6B gate before PR review:

```powershell
npm --prefix server run phase6b:acceptance
```

Run the focused security and adapter gates:

```powershell
npm --prefix server run test:legacy-authority-adapters
npm --prefix server run test:legacy-authority-security
npm --prefix server run legacy-authority:evaluation
```

## Roll Back

Phase 6B is source-only until merged and deployed by a later instruction. If a deployment is ever rolled back, restore the prior runtime SHA and confirm:

- `MI_DEPLOYED_SOURCE_SHA=1979a432717064c189afc761a25263d71feaba18`
- `MI_DEPLOYED_SOURCE_ROOT=D:\Project\Mi-core-system\Master\mi-core`
- live authority unknown mutations remain `0`.
