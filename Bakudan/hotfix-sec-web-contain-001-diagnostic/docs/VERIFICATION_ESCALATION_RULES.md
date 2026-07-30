# Verification Escalation Rules

## Overdue Escalation

| Age | Notify | Penalty |
| --- | --- | --- |
| 1 day overdue | Owner, backup owner | No |
| 3 days overdue | Manager | No |
| 7 days overdue | Admin | Suggested only |
| 14 days overdue | CEO risk dashboard | Suggested only |

## Verification Delay Rule

If a verifier fails to verify:

- 1 day overdue: reminder
- 3 days overdue: manager notification
- 7 days overdue: suggested penalty

Suggested penalty categories:

- Verification Missed
- Approval Missed
- Financial Confirmation Missed

The system never auto-punishes. Penalties require human approval and are tracked in `verification_escalations.penalty_approved_by` and `penalty_approved_at`.

## Pure Policy Functions

The tested policy functions live in `UniversalVerificationEngine`:

- `reminderStages($dueAt, $now)`
- `escalationStage($dueAt, $now)`
- `suggestedPenaltyCategory($objectType, $missType)`
