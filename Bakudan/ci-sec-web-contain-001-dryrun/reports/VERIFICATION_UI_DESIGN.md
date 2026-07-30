# Verification UI Design

Status: Preview Version

## Verification Rules Screen

Section: `Verification Rules`

Runtime route:

- `GET /admin/verification-rules-preview`

Fields:

- Require Verification? yes/no toggle
- Object Type selector: task, bill, payment, payroll, form, audit, checklist
- Template name
- Store scope
- Owner role
- Verification steps, 1 to 5

Each step contains:

- Assigned user or assigned role
- Step due time
- Required comment toggle
- Required evidence toggle

Current implementation ships the preview screen and engine-backed architecture. The visible Save action is disabled. No production rule is saved from this screen.

## CEO Dashboard

No approval buttons.

Show:

- Team Health Score
- Stores At Risk
- Pending Verifications
- Overdue Verifications
- Pending Payroll Reviews
- Pending Payment Reviews
- Suggested Penalties
- Repeated Delays
- Verification Bottlenecks
- Top Operational Risks

## Accounting Dashboard

Show:

- Bills Awaiting Verification
- Payments Awaiting Verification
- Payroll Awaiting Verification
- Financial Confirmations Pending
- Verification SLA

## Manager Dashboard

Show:

- Store Tasks
- Pending Verifications
- Overdue Tasks
- Escalations
- Verification Delays

## Admin Dashboard

Show:

- All Verifications
- All Escalations
- Suggested Penalties
- Verification Analytics
- User Accountability
- Store Accountability
