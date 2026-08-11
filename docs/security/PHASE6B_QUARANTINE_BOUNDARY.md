# Phase 6B Quarantine Boundary

Phase 6B is a containment phase. It does not add provider execution authority.

## Denied Classes

- Gmail send, reply, and forward semantics.
- Financial payment, transfer, purchase, and invoice-payment semantics.
- Shell, PowerShell, command, process, deploy, and merge semantics.
- Browser write and voice output send surfaces.
- Generic workflow triggers without a canonical owner.

## Evidence Gates

The Phase 6B gates assert:

- zero unresolved legacy mutation surfaces;
- zero unknown mutation surfaces;
- zero unsafe adapted surfaces for process, service-control, or irreversible external effects;
- no Gmail SEND adapter target;
- no direct calendar `sendUpdates` bypass;
- no direct legacy executor imports in legacy approval routes;
- 300 deterministic unsafe/safe adapter evaluation cases with zero provider, financial, shell/process, auth-elevation, project-scope, or target-mutation bypasses.

## Runtime Rule

When in doubt, quarantine. A future phase may add a canonical owner, but Phase 6B may not create a second authority path.
