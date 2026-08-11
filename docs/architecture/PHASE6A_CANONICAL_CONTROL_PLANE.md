# Phase 6A Canonical Control Plane

Phase 6A establishes a canonical authority boundary for Mi-Core before Phase 6 expansion work begins. The boundary inventories runtime routes, internal command surfaces, background workers, and legacy integrations, then classifies each surface by owner, effect, authentication requirement, and migration status.

## Canonical Owners

- Task Runtime owns project-scoped local task state and command evidence.
- Project Registry owns project identity, root validation, and repository metadata.
- ControlledActionService owns external actions that can execute only through policy, approval, and audit.
- ActionPolicyEngine owns budgets, kill switches, and policy decisions.
- GovernedOrchestrationService owns governed action-plan DAGs.
- DelegationService owns bounded delegated authority.
- Authority Control Plane owns inventory, classification, and startup assertions.

## Authority Classes

- `CANONICAL_READ`: read-only or bootstrap surfaces.
- `CANONICAL_LOCAL_MUTATION`: local reversible state changes.
- `CANONICAL_CONTROLLED_ACTION`: governed external action execution.
- `CANONICAL_GOVERNED_ORCHESTRATION`: multi-step governed plans.
- `CANONICAL_DELEGATED_AUTHORITY`: bounded delegation scopes.
- `ADAPTER_TO_CANONICAL`: compatible legacy mount that routes into a canonical owner.
- `LEGACY_QUARANTINED`: legacy write or external surface blocked until adapted.
- `FORBIDDEN`: prohibited authority expansion.
- `INTERNAL_TEST_ONLY`: test and validation harnesses.

## Manifest

The generated manifest lives at `server/authority-manifest.json` and is produced by:

```powershell
npm --prefix server run authority:manifest
```

Current Phase 6A manifest totals:

- Total surfaces: 1,023
- Mutations: 394
- Canonical surfaces: 649
- Adapters: 158
- Quarantined surfaces: 155
- Unknown mutations: 0

Startup validation regenerates the manifest model and fails fast if a mutation is unregistered, a forbidden surface is mounted, or an external write bypasses the canonical controlled-action path. The assertion can be disabled only for emergency local diagnostics with `MI_AUTHORITY_STARTUP_ASSERT=false`.
