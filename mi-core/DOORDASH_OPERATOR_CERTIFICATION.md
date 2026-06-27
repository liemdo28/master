# DoorDash Operator Certification

Generated: 2026-06-27T03:30:00Z

Certification result: `BLOCKED`

## Operator Safety

- DoorDash production mutation remains approval-gated.
- Existing operator path is read-only for evidence collection.
- No production mutation was attempted during this audit.

## Current Blockers

- DoorDash agent not listening on port `3460`.
- Health endpoint unreachable.
- Historical session output contains DoorDash page-load errors instead of usable campaign/menu metrics.

## Decision

Operator safety controls exist, but operator live certification is blocked because the live agent is not reachable and fresh read-only account evidence is not available.
