# PROJECT MAP

Generated: 2026-06-01 19:03:40 +0700
Root: `E:\Project\Master`

## Company Operating Map

```text
E:\Project\Master
|-- agent-os                 Shared Service: Control Plane + Worker Network
|-- qa-platform              Shared Service: canonical QA engines and release gates
|-- master-journal           Shared Service: events, decisions, artifacts, AI memory
|-- Agent                    Shared Service: Agent brain, coding agents, MCP/review tools
|-- QA                       Shared Service: existing QA engines and runners to migrate/wrap
|-- Bakudan                  Product group
|-- RawSushi                 Product group
|-- Other                    Product/utility incubator and legacy mixed area
|-- reports                  Audit/report artifacts
|-- storage-audit-report     Storage audit artifacts
|-- _archive                 Legacy snapshots/migration leftovers
|-- _snapshots               Master rolling snapshots
```

## Canonical Ownership

| Area | Canonical Path | Classification | Notes |
|---|---|---|---|
| Agent OS | `agent-os` | Shared Service | Control plane, worker, queue, approvals, artifacts, permissions, kill switch roadmap. |
| QA Platform | `qa-platform` | Shared Service / QA Platform | New canonical QA service boundary created in this pass. |
| Master Journal | `master-journal` | Shared Service / Journal | New canonical event and AI memory service boundary created in this pass. |
| Agent Brain / Coding | `Agent\agent-coding` | Shared Service | Strongest brain/workflow candidate to wrap under Agent OS. |
| Agent API Keys | `Agent\agent-coding-api-keys` | Shared Service / Sensitive | Must be isolated behind permission and secrets policy. |
| AI Search Tool | `Agent\ai-search-tool` | Shared Service / Utility | Contains AI/CV utility code. |
| Review MCP | `Agent\review-management-mcp` | Shared Service | Review automation integration candidate. |
| QA System | `QA\qa-system` | Shared Service / QA | Candidate source for future `qa-platform`. |
| QA Runner | `QA\qa_runner` | Shared Service / QA | Playwright runner candidate. |
| Tester QA | `QA\Tester-QA` | Shared Service / QA | Python QA project plus control center. |
| PC QA Stability | `QA\PC-QA-Stability-Certification` | Shared Service / QA | Worker-node certification candidate. |
| Bakudan Website | `Bakudan\bakudanramen.com-current` | Product | Current public site. |
| Bakudan Dashboard | `Bakudan\dashboard.bakudanramen.com` | Product | Operational dashboard with QA config. |
| Bakudan Packing List | `Bakudan\packing-list` | Product | Contains nested duplicate candidate. |
| Bakudan Review Automation | `Bakudan\review-automation-system` | Product / Automation | Should consume Agent OS review and QA workflows. |
| Bakudan Integration System | `Bakudan\integration-system` | Product / Integration | Toast/QB style integration area. |
| RawSushi Website | `RawSushi\RawWebsite` | Product | Cloudflare/Worker style site. |
| Other | `Other` | Mixed | Needs per-project active/legacy decision. |

## Target Agent OS Flow

```text
CEO -> Command Center -> Control Plane -> Tailscale -> PC Worker Nodes -> Executors -> Artifacts + Journal -> QA Gate
```

## Required Service Boundaries

- `qa-platform`: canonical service for Audit Engine, Test Engine, Stress Engine, Security Engine, Architecture Engine, and Release Gate Engine. Skeleton created.
- `master-journal`: canonical event, decision, incident, bug, snapshot, artifact, knowledge, and AI memory store. Skeleton created.
- `agent-os`: remains control plane, approval engine, worker network, permission layer, kill switch, snapshot coordinator, artifact registry, and knowledge graph API.

## CEO Canonical Decisions

See `CANONICAL_PROJECT_DECISIONS.md` for confirmed ownership: `Bakudan\packing-list` is canonical, LinkTreeHL belongs under Bakudan website ownership, and `Agent\agent-coding` is the Agent Brain.

## LinkTreeHL Migration Update

`Other\LinkTreeHL` has been copied into `Bakudan\bakudanramen.com-current\integrations\linktreehl-next` as a non-runtime source integration. See `LINKTREEHL_MIGRATION_REPORT.md`.
