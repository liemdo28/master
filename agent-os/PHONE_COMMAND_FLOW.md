# Phone Command Flow

## Level 1: Remote Control

```text
iPhone chat
  -> Agent OS
  -> Agent Commander
  -> Task Planner
  -> PC Worker
  -> Report back to phone
```

CEO should not need Remote Desktop for normal command execution.

## Level 2: Push Notification

Example:

```text
Payroll build completed.
QA Score: 95.
Deploy?

[Approve] [Reject]
```

Approval actions must call Agent OS approval APIs, not bypass them.

## Level 3: Voice

Voice is a chat transport. It must still pass through:

```text
Intent Analysis -> Task Planner -> Approval Engine -> Executor
```

Voice must not become raw shell.

## Current Status

Phone transport and push notifications are not implemented yet. Agent Commander contract is ready for them because the chat API now returns `commanderPlan` with strategy, QA policy, and next actions.

