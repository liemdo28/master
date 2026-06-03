# Agent Commander Architecture

## Goal

Agent OS must not be a button that runs scripts. CEO chat is the control surface; Agent Commander decides intent, plan, executor strategy, QA lane, and reporting path.

## Flow

```text
CEO
  -> Chat Command
  -> Agent Commander
  -> Intent Analysis
  -> Task Planner
  -> Execution Strategy
  -> Execution
  -> QA
  -> Report
  -> CEO
```

## Runtime Contract

Agent Commander produces:

```json
{
  "intent": "audit | build | fix | qa | deploy | research | status",
  "project": "project path",
  "taskSize": "small | medium | large",
  "strategy": "local_agent | cline | antigravity | multi_agent | qa_agent",
  "plan": [],
  "qa": [],
  "handoffPrompt": "prompt for external agent when needed",
  "nextActions": ["Fix", "Report", "Ignore"]
}
```

## Strategy Rules

| Work type | Strategy | Reason |
| --- | --- | --- |
| Git Status, Health Check, Port Scan, Worker Status, CPU/RAM | Local Agent | Read-only system work. |
| Small one-file fix, narrow refactor, small API patch | Cline | Localized source edit. |
| Large audit, new module, many-file refactor, system QA | Antigravity | Broad context and parallel exploration. |
| Deploy, research with unknowns, cross-project decision | Multi-Agent | Separate research/execution/approval lanes. |
| Build complete validation | QA Agent | Independent verification before CEO decision. |

## Current Implementation

Implemented in:

```txt
E:\Project\Master\agent-os\agent-control\src\services\agentCommander.ts
E:\Project\Master\agent-os\agent-control\src\routes\chat.ts
```

Known behavior:

- `Git Status` remains local.
- `Start API Proxy` remains local/registry-safe.
- `Audit dashboard.bakudanramen.com` is recognized as dynamic commander intent and routes to Antigravity launch strategy with a handoff prompt in task payload.
- Unknown free text still creates no task.

## Gap

Antigravity prompt injection is not yet automated. Current implementation can choose Antigravity and launch/log handoff metadata. Next phase should add an Antigravity task-injection adapter or an Agent Manager bridge.

