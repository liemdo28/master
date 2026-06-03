# Executor Router

## Purpose

The executor router separates CEO chat text from worker execution. Chat selects a registered intent; the registry names the executor; the worker handler executes only the typed task.

## Registered executors

| Executor | Task type | Notes |
| --- | --- | --- |
| `audit_executor` | `audit` | Writes audit artifacts under `qa-platform/artifacts`. |
| `git_executor` | `git_sync` | Runs safe git read operations. Root Master status uses `git-status-all.ps1`. |
| `qa_executor` | `qa` | Runs detected test tooling or structural QA. |
| `build_executor` | `build` | Runs project build flow. |
| `app_executor` | `launch` | Opens approved apps only. |
| `script_executor` | `script` | Runs approved script paths only. |
| `deploy_executor` | `deploy` | Requires approval before execution. |
| `query_executor` | `query` | Returns control-plane status without creating a task. |

## Router rule

The worker must not route `launch` or `deploy` back into generic shell execution unless the payload passes the same registry and whitelist checks as `script`.

Current implementation:

- `launch` maps to `handleLaunch`.
- `script` maps to `handleScript`, which requires `registryIntent` plus an approved `scriptPath` or explicit internal `rawShellApproved`.
- `deploy` is still backed by script handling, so it is approval-gated and blocked unless a registered approved script is added.

