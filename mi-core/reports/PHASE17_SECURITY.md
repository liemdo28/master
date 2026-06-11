# Phase 17 Security

## Implemented
- Existing secret redaction remains in big-data ingestion and indexing.
- Added permission audit table.
- Added `server/src/security/permission-layer.ts`.
- Browser writes now require approval IDs.

## Required Next
Persist approval gate state, add RBAC roles, block secret-bearing uploads earlier, and add CI secret scanning.
