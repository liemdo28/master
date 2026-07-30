# Mi Operator Harness

ECC-inspired operator layer for mi-core. This is intentionally small and local:

- `manifests/` defines installable profiles and modules.
- `skills/` defines reusable agent workflows.
- `rules/` defines coding, safety, and verification rules.
- `commands/` defines promptable operator commands.
- `mi-harness.mjs` resolves a profile and can materialize `.mi-harness/` context files.

This is not a copy of ECC. It adapts the useful pattern: profile -> modules -> skills/rules/commands, scoped to Mi Ultimate's architecture.

## Usage

```powershell
npm run harness:list
npm run harness:plan -- --profile core
npm run harness:materialize -- --profile core
```

The materialized `.mi-harness/` directory is generated context for coding agents and should be treated as derived working state.

