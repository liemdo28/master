# Approval Engine Integration

## Required approval behavior

Registered commands carry `risk_level` and `approval_required` metadata.

Safe commands are auto-approved:

- `audit_master`
- `git_status_all`
- `run_qa`
- `build_dashboard`
- `build_payroll`
- `open_antigravity`
- `start_api_proxy`
- `create_master_snapshot`
- `search_master`

Approval-required commands:

- `deploy_staging`
- any future production deploy
- any delete/remove operation
- any DNS or Cloudflare mutation
- any outbound email/send action
- any git push

## Current code path

1. Chat route calls `parseIntent`.
2. Unsupported intent returns a system message and exits before `taskQueue.createTask`.
3. Supported task is inserted through `taskQueue.createTask`.
4. `approvalEngine.assessTaskRisk` creates `auto_approved` or `pending` approval records.
5. Waiting tasks must be approved before moving to `pending`.

## CEO escalation rule

If implementation may slip, the developer must report it at least 48 hours before the deadline. Disagreement must be raised immediately; after today it is not a valid reason for missing the acceptance criteria.

