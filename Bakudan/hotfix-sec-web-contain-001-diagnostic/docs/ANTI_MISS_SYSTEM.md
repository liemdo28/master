# Anti-Miss System

## Required Record Fields

Every workflow record must contain:

- Owner
- Store
- Priority
- Due Date
- Created By
- Optional verification chain
- Escalation rules
- Reminder rules

Creation must fail if owner or due date is missing. `UniversalVerificationEngine::validateWorkflowRecord()` enforces owner, due date, and priority before creating verification records.

## Reminder Schedule

The reminder engine supports:

- 24h before due
- 3h before due
- At due time
- 24h overdue
- 3 days overdue
- 7 days overdue

Reminder events are stored in `verification_reminders`. Channels are normalized to notification, email, mobile push, and audit log. Email and mobile push are future channels and should be queued, not sent directly from business logic.

## Visibility Rule

No overdue verification can be hidden. CEO/Admin dashboards must show overdue verification totals even when the related object is not otherwise visible in a normal task list.

## Audit Trail

Every action writes to `verification_history`. Comments and evidence are stored in separate normalized tables so reports can reconstruct who blocked, approved, rejected, or delayed work.
