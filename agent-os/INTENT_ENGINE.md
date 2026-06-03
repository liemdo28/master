# Intent Engine

## CEO rule

Agent OS chat is not a shell. Free text from the CEO must pass through the intent engine before any task can be created.

## Current contract

Flow:

`Chat Input -> Intent Engine -> Command Registry -> Task Engine -> Approval Engine -> Executor Router -> Worker Executor -> Logs/Artifacts`

The intent engine now uses `COMMAND_REGISTRY.json` as the source of truth. A message is supported only when it exactly matches a registered alias after lowercase and whitespace normalization.

## Unknown input

Unknown input returns:

```text
I received your message, but it is not a supported command yet.

Try:
- Audit Master
- Git Status
- Run QA
- Open Antigravity
- Start API Proxy
```

Unknown input creates no task and carries no shell command.

## No guessing

`KNOWN_UNKNOWN` is allowed. Guessing is not.

If the engine cannot map text to one registered command, it must return an unsupported response. It must not infer that the user wanted `script`, `PowerShell`, `cmd`, or any raw command execution.

