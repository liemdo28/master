# OPERATOR EVIDENCE CAPTURE PROOF

## Evidence Stored Per Run

The runtime stores or attempts to store:

- execution log
- screenshot paths
- HTML snapshot when target is considered safe
- timing
- errors
- task input
- task output
- policy decision

## Evidence Schema Fields

Each evidence record includes:

- `task_id`
- `objective_id`
- `timestamp`
- `adapter`
- `mode`
- `target_url`
- `result`
- `policy_decision`

## Verified Evidence Output

Observed from test execution:

- `d:\\Project\\.local-agent-global\\operator-runtime\\evidence\\OPS-0001\\log.json`
- `d:\\Project\\.local-agent-global\\operator-runtime\\html\\OPS-0001.html`

## Behavior

Even when browser execution fails safely, evidence is still emitted so the failure is auditable.