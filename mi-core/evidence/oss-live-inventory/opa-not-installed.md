# Evidence: OPA Not Installed

**Date:** 2026-06-28
**OSS:** Open Policy Agent (OPA)
**Expected Status:** `CONFIGURED_NOT_INSTALLED`

## Verification

No OPA server on TCP 8181.

## Business Role

- Guardrail policy decisions
- Rego policy evaluation

## Replacement

In-engine GuardrailEngine + whitelist handles all policy decisions.

## Fallback Status

`FALLBACK_READY` - In-engine GuardrailEngine active.
