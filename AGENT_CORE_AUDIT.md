# AGENT CORE AUDIT

Generated: 2026-06-01 19:03:40 +0700
Root: `E:\Project\Master`

## Finding

The strongest current Agent Brain candidate is `agent-os` plus `Agent\agent-coding`.

`agent-os` already contains the concrete operating-system layer: control plane, worker process, task queue, worker registry, shared protocol, SQLite tables, task logs, artifacts, heartbeats, and execution records. `Agent\agent-coding` appears to be the broader local-agent/code-agent workspace and should be audited before it is merged, wrapped, or promoted.

## Current Agent OS Evidence

- `agent-os\agent-control\src\services\taskQueue.ts`: task creation, priority queueing, worker assignment, cancellation, retry.
- `agent-os\agent-control\src\services\database.ts`: SQLite tables for workers, tasks, logs, task artifacts, heartbeats, executions.
- `agent-os\agent-control\src\routes\tasks.ts`: task API including logs and artifacts.
- `agent-os\agent-control\src\routes\workers.ts`: worker registration, heartbeat, token validation, worker deletion.
- `agent-os\agent-worker\src\worker.ts`: worker runtime candidate for PC node execution.
- `agent-os\agent-worker\src\handlers\index.ts`: executor handler area.
- `agent-os\shared\src\types.ts` and `agent-os\shared\src\protocol.ts`: shared task/worker protocol.
- `agent-os\APPROVAL_ENGINE.md`, `PERMISSION_MODEL.md`, `WORKER_EXECUTORS.md`, `KILL_SWITCH.md`, `ARTIFACT_STORAGE.md`: roadmap docs already exist.

## Agent / AI / Automation Hotspots

| Path | Role | Status |
|---|---|---|
| `agent-os` | Control Plane + Worker Network | Active shared service |
| `Agent\agent-coding` | Agent brain / coding automation candidate | Active shared service |
| `Agent\agent-coding-api-keys` | API/secrets support | Active but sensitive |
| `Agent\ai-search-tool` | AI utility / CV tooling | Active utility |
| `Agent\review-management-mcp` | Review automation MCP | Needs review |
| `Bakudan\review-automation-system` | Product automation | Active product automation |
| `qa-platform` | New canonical QA service boundary | Skeleton created |
| `master-journal` | New canonical event and AI memory store | Skeleton created |
| `QA\qa-system` | QA foundation | Active shared QA candidate |
| `QA\qa_runner` | Playwright runner | Active shared QA candidate |
| `QA\Tester-QA` | QA control center / Python QA | Active shared QA candidate |
| `QA\PC-QA-Stability-Certification` | Worker/node certification | Active shared QA candidate |

## Projects Needing the Brain

- Bakudan products need build, QA, review automation, deploy gating, and rollback artifacts.
- RawSushi and active Other products should consume build/QA/deploy workflows from Agent OS, not own their own agent logic.
- Existing QA projects should be consolidated into `qa-platform` so projects call one release-gate interface.

## Remaining Gaps

- `master-journal` skeleton now exists; implementation and append-only writer are still needed.
- `qa-platform` skeleton now exists; existing QA code is still split across `QA` and must be migrated/wrapped.
- `agent-os\KNOWLEDGE_GRAPH.md` exists but is empty.
- Approval enforcement and kill switch need code-level verification beyond documentation.

## CEO Canonical Decisions

See `CANONICAL_PROJECT_DECISIONS.md` for confirmed ownership: `Bakudan\packing-list` is canonical, LinkTreeHL belongs under Bakudan website ownership, and `Agent\agent-coding` is the Agent Brain.
