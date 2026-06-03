# SYSTEM DEPENDENCY MAP

Generated: 2026-06-01 19:03:40 +0700
Root: `E:\Project\Master`

## Runtime Dependency Model

```text
CEO
 |
 v
Command Center (Laptop / MacBook / iPhone UI)
 | create / review / approve / monitor / stop
 v
agent-os / Control Plane
 |-- Task Queue
 |-- Approval Engine
 |-- Permission Model
 |-- Artifact Registry
 |-- Master Snapshot Coordinator
 |-- Knowledge Graph API
 |-- Master Journal Writer
 |
 v
Tailscale private network
 |
 v
PC Worker Nodes
 |-- File Executor
 |-- Git Executor
 |-- Build Executor
 |-- QA Executor -> qa-platform
 |-- App Executor
 |-- Script Executor
 |-- Cloud Executor (future gated)
 |
 v
Products: Bakudan, RawSushi, Other active projects
```

## Dependency Table

| Producer | Consumers | Dependency | Required Control |
|---|---|---|---|
| `agent-os` control plane | All workers and command center | Task lifecycle, worker registry, approvals, artifacts | Token auth, approval gate, audit log |
| `agent-os` worker | Products and QA platform | Local filesystem/build/test/script execution | Capability-scoped executors, kill switch |
| `Agent\agent-coding` | Agent OS and future agents | Agent/coding brain and local automation patterns | Wrap behind control plane instead of direct uncontrolled execution |
| Existing `QA` projects | `qa-platform` | Test runners, stress/security/architecture checks | Central release gate engine |
| `master-journal` | QA platform, CEO dashboard, Agent OS | Events, decisions, bugs, fixes, snapshots, AI memory | Append-only writes and indexed reads |
| `_snapshots` | Rollback and release gates | `MASTER-LATEST.zip` and `MASTER-PREVIOUS.zip` | Exclude dependency/build/cache directories |
| Artifact Storage | QA and CEO dashboard | audit-reports, build-logs, qa-results, screenshots, videos, deploy/git reports | Every task must publish artifacts |
| Future Cloud Operators | Gmail, DreamHost, Cloudflare, Drive, GitHub | External actions | Level 3 approval and secrets isolation |

## Approval Required Operations

- Git push
- Delete files
- Deploy production
- DNS change
- Cloud access
- Email send

## Snapshot Contract

- Trigger after build, fix, refactor, QA, and release candidate.
- Write to `E:\Project\Master\_snapshots\`.
- Keep `MASTER-LATEST.zip` and `MASTER-PREVIOUS.zip`.
- Exclude `node_modules`, `vendor`, `.git`, `cache`, `dist`, `build`, `logs`, and `coverage`.

## Dev Checklist Status

- [DONE] Master Inventory exists - `MASTER_INVENTORY.md` generated.
- [DONE] Dependency Map exists - `SYSTEM_DEPENDENCY_MAP.md` generated.
- [DONE] Agent Core identified - primary candidates documented in `AGENT_CORE_AUDIT.md`.
- [DONE] Control Plane architecture exists - `agent-os\ARCHITECTURE.md` and current control-plane code exist.
- [DONE] Worker architecture exists - `agent-os\agent-worker` and `WORKER_SETUP.md` exist.
- [DONE] Permission Model exists - `agent-os\PERMISSION_MODEL.md` exists.
- [PARTIAL] Approval Engine exists - docs exist; runtime enforcement requires code review.
- [PARTIAL] Kill Switch exists - docs exist; runtime cancellation/stop requires code review.
- [PARTIAL] Snapshot system exists - `_snapshots` exists; automation must be wired.
- [DONE] QA Platform planned - `qa-platform` skeleton and `agent-os\QA_PLATFORM.md` exist.
- [DONE] Master Journal planned - `master-journal` skeleton and AI memory schema exist.
- [DONE] Artifact Registry planned - `agent-os\ARTIFACT_STORAGE.md` and DB artifact table exist.
- [NEEDED] Knowledge Graph planned - `agent-os\KNOWLEDGE_GRAPH.md` is empty.
- [DONE] AI Memory planned - `master-journal\schemas\AI_MEMORY_ENTRY.md` created; runtime generation still needed.

## CEO Canonical Decisions

See `CANONICAL_PROJECT_DECISIONS.md` for confirmed ownership: `Bakudan\packing-list` is canonical, LinkTreeHL belongs under Bakudan website ownership, and `Agent\agent-coding` is the Agent Brain.

## Runtime Implementation Update

- Approval Engine runtime API is implemented and smoke-tested.
- Kill Switch worker handling is implemented.
- Snapshot route is implemented as an async job because full synchronous Master ZIP is too heavy.
- Master Journal writer is implemented for events, decisions, and AI memory entries.
- QA Platform artifact routing is implemented for worker QA/audit tasks.
