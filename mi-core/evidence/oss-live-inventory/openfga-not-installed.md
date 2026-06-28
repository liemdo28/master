# Evidence: OpenFGA Not Installed

**Date:** 2026-06-28
**OSS:** OpenFGA
**Expected Status:** `CONFIGURED_NOT_INSTALLED`

## Verification

No OpenFGA server on TCP 8080.

## Business Role

- Tenant/relationship authorization
- Fine-grained access control

## Replacement

In-engine TenantIsolation guard handles all tenant authorization needs.

## Fallback Status

`FALLBACK_READY` - In-engine TenantIsolation active.
