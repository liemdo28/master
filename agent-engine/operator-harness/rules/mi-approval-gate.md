# mi-approval-gate

Approval levels:

- Level 1: read-only, analysis, status, local verification.
- Level 2: write/edit/send/update actions with reversible impact.
- Level 3: delete, deploy, credential rotation, remote execution, irreversible or high-business-impact actions.

Any Level 2 or Level 3 action must leave an audit entry with action, target, approval source, timestamp, and result.

