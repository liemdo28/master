# Phase 6A Runbook

## Regenerate Manifest

```powershell
npm --prefix server run authority:manifest
```

## Check Manifest Drift

```powershell
npm --prefix server run authority:manifest:check
```

## Run Authority Gates

```powershell
npm run test:authority-control-plane
npm run test:authority-control-plane-security
npm run phase6a:acceptance
npm --prefix server run authority-control-plane:evaluation
```

## Investigate Startup Failure

If startup fails with an authority error:

- `AUTHORITY_SURFACE_UNREGISTERED`: classify the new mutation in `server/src/authority-control-plane/registry.ts`.
- `AUTHORITY_FORBIDDEN_MOUNTED`: remove the forbidden mount or keep it unmounted.
- `AUTHORITY_EXTERNAL_WRITE_BYPASS`: route the external mutation through ControlledActionService or quarantine it.

Do not bypass the startup assertion for normal operation. `MI_AUTHORITY_STARTUP_ASSERT=false` is only for temporary local diagnostics.
