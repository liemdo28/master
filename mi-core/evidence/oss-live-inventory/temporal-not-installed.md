# Evidence: Temporal Not Installed

**Date:** 2026-06-28
**OSS:** Temporal
**Expected Status:** `CONFIGURED_NOT_INSTALLED`

## Verification

No Temporal server running on TCP 7233.

## Business Role

- Durable approval workflow
- Long-running workflow state management

## Replacement

In-engine propose/approve/reject lifecycle manages all approval workflows.
The approval engine in `mi-core/server/src/approval/` handles durable workflow state.

## Fallback Status

`FALLBACK_READY` - In-engine approval lifecycle is active.
