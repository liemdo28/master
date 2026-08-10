# Phase 5F Rollback

Rollback is honest and action-specific.

| Action | Rollback/compensation |
| --- | --- |
| `GMAIL_CREATE_DRAFT` | Delete draft can be proposed as a separate action later. |
| `GMAIL_SEND_DRAFT` | Not implemented. Sent email is irreversible. |
| `CALENDAR_EVENT_PROPOSAL` | Cancel local proposal before external create. |
| `CALENDAR_CREATE_EVENT` | Delete event requires a new approval. |
| Local task/state | Use legal Task Runtime or Personal OS state transitions. |

Database rollback:

- Phase 5F migration is additive from v6 to v7.
- Production data is preserved.
- To disable Phase 5F without deleting data, stop mounting `controlledActionsRouter`.
