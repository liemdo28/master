# Phase 6A Authority Boundary

Phase 6A keeps the Phase 5 freeze intact while creating an explicit control-plane map for future authority work.

## Enforced Constraints

- No direct Gmail SEND expansion.
- No new external action categories outside ControlledActionService.
- No financial execution actions.
- No autonomous approval, merge, deployment, or release action.
- No voice output expansion or desktop control.
- No external mutation path may bypass canonical controlled actions or legacy quarantine.

## Quarantined Legacy Surfaces

Legacy external/process-control endpoints now return `AUTHORITY_SURFACE_QUARANTINED` before execution:

- `/api/approval/:id/approve` for legacy external queued actions.
- `/api/browser/write`.
- `/api/voice/output/daily-brief`.
- `/api/voice/output/send`.
- `/api/company-os/command`.
- `/api/company-os/money/:workflow_id`.
- `/api/n8n/trigger/:id`.
- `/api/n8n/execution/:id`.
- `/api/n8n/evidence`.

Each quarantine response records a governance audit event with the affected surface id and reason.

## Read Model Access

The authority inventory is exposed as read-only:

- Command Center session path: `/api/command-center/authority/manifest`
- API-key path: `/api/authority/manifest`
- Status path: `/api/authority/status`

These endpoints do not execute actions and do not grant authority.
