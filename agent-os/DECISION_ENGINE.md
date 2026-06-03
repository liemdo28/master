# Decision Engine

## Intent Classes

```text
Build
Fix
Audit
QA
Deploy
Research
Status
```

## Decision Inputs

- CEO message
- Project alias/path
- Risk level
- Task size
- Registered command metadata
- Current executor capability

## Decision Output

```json
{
  "strategy": "local_agent",
  "reason": "Read-only local system check",
  "canExecuteNow": true
}
```

## Routing

| Intent | Small | Medium | Large |
| --- | --- | --- | --- |
| Status | Local Agent | Local Agent | Local Agent |
| Fix | Cline | Cline | Antigravity |
| Audit | Antigravity | Antigravity | Antigravity |
| Build | Cline | Antigravity | Antigravity |
| QA | QA Agent | QA Agent | QA Agent |
| Deploy | Multi-Agent + Approval | Multi-Agent + Approval | Multi-Agent + Approval |
| Research | Multi-Agent | Multi-Agent | Multi-Agent |

## CEO Rule

If the decision engine is not sure, it returns `plan_only` or unsupported. It must not guess a shell command.

