# Phase 6 Discovery And Roadmap

Discovery date: 2026-08-11

Repository audited: `D:\mi-core-phase6-discovery`

Production checkout observed: `D:\Project\Mi-core-system\Master\mi-core`

Scope: discovery, architecture audit, and roadmap design only. No Phase 6A implementation, no production changes, no deploy, no migration, no restart.

## DONE

### Executive Decision

Phase 6 should be a consolidation, control-plane, and evidence-hardening phase before it expands autonomy.

The Phase 5 core is intentionally narrow and mostly coherent: Personal OS v10 stores memory, knowledge, operating records, controlled actions, governance, orchestration, and delegated authority; Task Runtime and Project Registry keep their own DBs; Command Center exposes the Phase 5 surfaces through session auth while raw API access uses API-key auth.

The main Phase 6 risk is not that the new Phase 5 path is casually executing external actions. The main risk is that the production server still mounts many older or parallel surfaces for approvals, actions, voice, Jarvis, company OS, workflows, autonomous execution, and operations. Some of those surfaces include older send/execute concepts that are outside the Phase 5 canonical authority model.

Recommended Phase 6 theme:

> Make the Personal OS Phase 5 core the single governed control plane, quarantine or adapt legacy authority surfaces, and improve operator visibility/evidence before adding more autonomous capability.

### Reality Baseline

| Check | Result |
| --- | --- |
| Expected docs/freeze SHA | `11c0a3dff11e51e6ec612d9780e0d914a701e237` |
| `origin/master` | `11c0a3dff11e51e6ec612d9780e0d914a701e237` |
| Expected functional deployed SHA | `ff51bcab13cf6dfca7d1a6259046b35b282d08dc` |
| `.env` deployed marker | `MI_DEPLOYED_SOURCE_SHA=ff51bcab13cf6dfca7d1a6259046b35b282d08dc` |
| Production source root marker | `D:\Project\Mi-core-system\Master\mi-core` |
| Production health | `http://127.0.0.1:4001/api/health` returned 200 |
| `/api/tools` unauthenticated | 401 |
| `/api/tools` with local API key | 200 |
| Command Center root | 200, root div present |
| Personal OS schema | v10 |
| Personal DB integrity | `ok`, 0 FK violations |
| Task DB integrity | `ok`, 0 FK violations |
| Project DB integrity | `ok`, 0 FK violations |

The expected production/master split is present: production is marked as the functional SHA while master contains the later docs-only freeze SHA. This is not treated as drift.

### Runtime Wiring Observed

The production process is running:

| Process | Status | CWD | Script |
| --- | --- | --- | --- |
| `mi-core` | online | `D:\Project\Mi-core-system\Master\mi-core` | `server\dist\index.js` |
| `mi-ai-service` | online | `D:\Project\Mi-core-system\Master\mi-core\ai-service` | Python 3.13 executable |

The Phase 5 routers are mounted twice in `server/src/index.ts`:

| Surface | Auth model | Mounts |
| --- | --- | --- |
| Command Center bridge | `requireRemoteAuth` session/auth guard | `/api/command-center/task-runtime`, `/api/command-center/coding`, `/api/command-center/projects`, `/api/command-center/*` |
| Raw API | `requireTaskRuntimeAuth` API-key guard | `/api/task-runtime`, `/api/coding`, `/api/*` for Personal OS, intelligence, knowledge documents, operating, controlled actions, governance, orchestration, delegation |

Static UI is served at `/command-center`.

Many older or parallel routers are also mounted after the Phase 5 surfaces, including `/api/approval`, `/api/memory`, `/api/knowledge`, `/api/jarvis`, `/api/projects`, `/api/reminders`, `/api/browser`, `/api/voice`, `/api/company-os`, `/api/autonomous`, `/api/council`, `/api/improvement`, `/api/digital-twin`, `/api/operations`, `/api/workflows`, `/api/telemetry`, `/api/n8n`, `/api/analytics`, `/api/engineering`, `/api/ai`, `/api/connectors`, and `/api/ceo`.

### Canonical Phase 5 Components

| Area | Canonical paths | Current behavior |
| --- | --- | --- |
| Personal OS base | `server/src/personal-os/store.ts`, `server/src/personal-os/service.ts` | Preferences, goals, priorities, daily briefs, planning records, knowledge records. Plans create draft child tasks and move them to `WAITING_APPROVAL`; they do not execute. |
| Task Runtime | `server/src/task-runtime/types.ts`, `server/src/task-runtime/store.ts`, `server/src/task-runtime/engine.ts` | Own `tasks.db`; strict state machine; read-only allowlisted inspection commands; argv spawn; working directory constrained to allowed roots. |
| Project Registry | `server/src/project-registry/store.ts`, `server/src/project-registry/service.ts` | Own `projects.db`; project maps, resume contexts, context packs, validation profile, runtime hints. |
| Knowledge OS | `server/src/personal-os/documents/*` | Approved-root discovery; gated ingestion; secret scan; FTS5 retrieval; cited/extractive facts; UNKNOWN when evidence is missing. |
| Intelligence | `server/src/intelligence/*` | Read-only Google capability interface; facts, suggestions, unknowns; no Gmail/Calendar writes; bounded summaries and opaque evidence refs. |
| Operating Loop | `server/src/personal-os/operating/*` | Morning/midday/evening/weekly loops; idempotent records; separates service health facts from memory/knowledge statements; pending approval view is read-only. |
| Controlled Actions | `server/src/personal-os/actions/*` | Proposals, approvals, executions, compensation/evidence; R4 rejected; Gmail send documented but not implemented; live provider writes blocked unless sandbox explicitly configured. |
| Governance | `server/src/personal-os/actions/governance/*` | Policy sets/rules/decisions, budgets, kill switches, anomalies, deterministic decision hashes. |
| Orchestration | `server/src/personal-os/orchestration/*` | DAG plans with READ_ONLY/LOCAL_COMPUTE/CONTROLLED_ACTION steps; controlled steps wait for approval; approvals bind to one proposal/payload/action/target. |
| Delegation | `server/src/personal-os/delegation/*` | Narrow delegated authorization for selected controlled action types only; strong human approval required; immutable snapshots; policy drift pauses authority. |
| Command Center | `command-center/src/App.tsx`, `command-center/src/Layout.tsx` | Screens for Today, goals, projects, tasks, approvals, plan, memory, knowledge, calendar, inbox, coding, health, reviews, settings, actions, governance, plans, delegations. |

### Database Inventory

Count-only inventory from production DB files:

| DB | Path | Version | Table count | Selected counts |
| --- | --- | --- | ---: | --- |
| Personal OS | `D:\Project\Mi-core-system\Master\mi-core\.local-agent-global\personal-os\personal-os.db` | 10 | 54 | 9 action proposals, 4 action approvals, 1 action execution, 3 action plans, 1 active policy set, 3 action budgets, 0 kill switches, 8 knowledge documents, 11 ingestion jobs, 1 operating brief, 5 loop runs, 4 delegation versions |
| Task Runtime | `D:\Project\Mi-core-system\Master\mi-core\.local-agent-global\task-runtime\tasks.db` | n/a | 2 | 27 tasks, 181 task events |
| Project Registry | `D:\Project\Mi-core-system\Master\mi-core\.local-agent-global\project-registry\projects.db` | `001_project_registry` | 5 | 4 projects, 12 project maps, 8 context packs, 2 resume contexts |

No personal content values were inspected for this inventory.

### Authority Boundary Findings

The Phase 5 controlled-action path is narrow:

| Finding | Evidence |
| --- | --- |
| R4 proposals are rejected at proposal time | `server/src/personal-os/actions/service.ts:111-113` |
| `GMAIL_SEND_DRAFT` is documented but not implemented | `server/src/personal-os/actions/service.ts:642` |
| Gmail draft implementation uses `drafts.create`, not send | `server/src/personal-os/actions/service.ts:463-474` |
| Calendar sandbox create uses `events.insert` with `sendUpdates: 'none'` | `server/src/personal-os/actions/service.ts:531-550` |
| Approval stores the proposal payload snapshot and hash | `server/src/personal-os/actions/service.ts:212-250` |
| Execution rechecks policy, budget, expiry, and payload hash | `server/src/personal-os/actions/service.ts:302-356` |
| Governance has explicit policy, budget, kill switch, anomaly, and decision records | `server/src/personal-os/actions/governance/schema.ts:15-132` |
| Default governance denies `GMAIL_SEND_DRAFT` and all R4 | `server/src/personal-os/actions/governance/schema.ts:155-162` |
| Orchestration only allows `GMAIL_CREATE_DRAFT`, `CALENDAR_EVENT_PROPOSAL`, `CALENDAR_CREATE_EVENT` as controlled action types | `server/src/personal-os/orchestration/types.ts:14-20` |
| Orchestration resume explicitly does not auto-execute waiting approvals | `server/src/personal-os/orchestration/service.ts:243` |
| Orchestration binds approval to exact proposal/payload/action/target before execution | `server/src/personal-os/orchestration/service.ts:497-507` |
| Delegation eligible action types are the same three controlled action types | `server/src/personal-os/delegation/types.ts:8-12` |
| Delegation requires human strong confirmation containing `AUTHORIZE:<id>` | `server/src/personal-os/delegation/service.ts:125-138` |
| Delegation pauses on active policy hash drift | `server/src/personal-os/delegation/service.ts:173-187` |
| Delegation reserves quota before approving through ControlledActionService | `server/src/personal-os/delegation/service.ts:276-316` |
| Delegation eligibility rejects already executed proposals and payload hash mismatches | `server/src/personal-os/delegation/eligibility.ts:180-185` |

### Duplicate And Overlap Audit

| Candidate | Paths | Production dependency evidence | Risk | Phase 6 recommendation |
| --- | --- | --- | --- | --- |
| Legacy approval/action executor | `server/src/routes/approval.ts`, `server/src/approval/gate.ts`, `server/src/actions/google-executor.ts`, `server/src/actions/gmail-action-adapter.ts`, `server/src/routes/actions.ts` | `/api/approval` is mounted in `server/src/index.ts`; `routes/approval.ts` imports `executeApprovedAction`; `google-executor.ts` includes Gmail send and Calendar create/update operations. `routes/actions.ts` appears not mounted in `index.ts`. | High conceptual overlap with Phase 5 Controlled Actions; legacy executor includes external send/create paths outside the Phase 5 policy engine. | Phase 6A should inventory and classify as legacy. Phase 6B should either route through Controlled Actions or disable/write-protect the legacy executor endpoints. |
| Legacy `/api/knowledge` | `server/src/routes/knowledge.ts`, `server/src/knowledge/knowledge-db.ts`, `server/src/knowledge/pack-manager.ts` | `/api/knowledge` is mounted in `server/src/index.ts`. New Knowledge OS service says the broad knowledge DB remains for existing consumers and is not called by the gated document ingestion service. | Medium. Confusing dual knowledge sources can cause stale/conflicting answers. | Keep read-only compatibility if needed, but mark Personal OS Knowledge OS as canonical. Add telemetry to show which knowledge backend answered. |
| Legacy `/api/memory` and memory families | `server/src/routes/memory.ts`, `server/src/memory/*`, `server/src/operational-memory/*`, `server/src/strategic-memory/*`, `server/src/memory2/store-context.ts` | Multiple memory routers mounted at `/api/memory` and `/api/strategic`; Personal OS v10 memory is separate. | Medium. User preferences and memories may diverge. | Define a single memory contract and migration/adaptation plan; do not add new memory write surfaces until this is resolved. |
| Jarvis proactive and briefing layer | `server/src/jarvis/*` | `/api/jarvis` mounted; boot starts proactive monitor and daily briefing scheduler; Jarvis code queues WhatsApp messages and references approvals. | Medium to high depending on notification/execution path. This is outside the Phase 5 operating loop. | Treat as legacy notification/assistant layer. Route future proactive suggestions into Operating Loop + Controlled Actions, or keep strictly read-only. |
| Voice/WhatsApp output layer | `server/src/voice/*`, `server/src/communication/*`, `server/src/services/whatsapp-sender.ts` | `/api/voice` mounted; voice output has CEO exemption and can send WhatsApp audio for CEO-targeted notes. | Medium. Not Gmail send, but still an external communication channel. | Bring outbound communication under the same action classification vocabulary, with explicit exemptions documented and visible in Command Center. |
| Company OS / autonomous / council / improvement | `server/src/company-os/*`, `server/src/autonomous/*`, `server/src/council/*`, `server/src/self-improvement/*` | Mounted at `/api/company-os`, `/api/autonomous`, `/api/council`, `/api/improvement`; Company OS and autonomous modules include execution pipeline concepts. | High architectural ambiguity. These names imply broad authority and may bypass the Phase 5 mental model. | Phase 6A must classify runtime authority. Phase 6B should quarantine external side effects or adapt them into governed Action Plans. |
| Operations/workflow telemetry | `server/src/operations/*`, `server/src/execution/*`, `server/src/routes/workflow-metrics.ts` | Mounted at `/api/operations`, `/api/workflows`; boot starts burn-in/self-healing schedulers and self-healing monitor. | Medium. Valuable observability exists, but separate approval-source-of-truth and workflow ledgers can conflict with Phase 5 governance. | Fold useful observability into a unified evidence/operations dashboard; keep remediation actions behind controlled actions. |
| Project routes and old project scanner | `server/src/routes/projects.ts`, `server/src/projects/*`, `server/src/project-registry/*` | `/api/projects` and `/api/command-center/projects` both use `projectsRouter`; project-registry service also names legacy project scanner as evidence. | Low to medium. Some overlap is adapter-shaped, not necessarily unsafe. | Keep Project Registry canonical; document route ownership and deprecate old scanners once maps/context packs cover use cases. |

### Option Scoring Matrix

Scores: 5 is best. Weight is importance for Phase 6.

| Option | Description | Safety weight 30 | Clarity weight 25 | User value weight 20 | Delivery weight 15 | Future leverage weight 10 | Weighted score |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A. Canonical Control Plane First | Make Phase 5 Personal OS the source of truth; classify/quarantine/adapt legacy authority surfaces; add operator visibility and evidence. | 5 | 5 | 4 | 4 | 5 | 4.65 |
| B. Add More Autonomy Now | Expand delegated/external action capability before consolidation. | 2 | 2 | 4 | 3 | 3 | 2.65 |
| C. Knowledge/RAG Expansion First | Focus on ingestion, retrieval quality, citations, and evaluation scale before authority cleanup. | 4 | 3 | 4 | 4 | 4 | 3.75 |
| D. UI/Product Polish First | Expand Command Center workflows and UX while leaving backend authority mostly unchanged. | 3 | 3 | 5 | 4 | 3 | 3.55 |
| E. Ops/Reliability First Only | Focus on backup/recovery/SLOs, schedulers, and health dashboards before authority cleanup. | 4 | 3 | 3 | 4 | 3 | 3.45 |

Recommended: Option A, with selected pieces of C, D, and E sequenced after boundary consolidation.

### Proposed Phase 6 Decomposition

#### Phase 6A - Canonical Surface Inventory And Runtime Contract

Goal: decide what is canonical, adapter, legacy, experimental, or disabled.

Deliverables:

- Route inventory generated from `server/src/index.ts`.
- Authority inventory of every mounted route that can write local state, write external systems, notify, execute, schedule, or self-heal.
- Canonical ownership matrix for Personal OS, Task Runtime, Project Registry, Knowledge OS, Controlled Actions, Governance, Orchestration, Delegation, Command Center.
- Compatibility plan for legacy routes.
- Tests that assert no unexpected write-capable route is mounted without a classification.

Exit gate:

- Every mounted route has an authority class.
- Legacy Gmail send and other external write paths are either disabled, documented as noncanonical, or routed through Controlled Actions.
- No Phase 6B work begins until this matrix is accepted.

#### Phase 6B - Legacy Authority Quarantine / Adapter Layer

Goal: prevent older surfaces from bypassing the Phase 5 governed path.

Deliverables:

- Adapter for legacy approval requests into Controlled Action proposals where feasible.
- Hard disable or feature-flag for legacy `gmail_send`, direct Calendar writes, Drive share/upload, and broad external executors unless explicitly sandboxed.
- Command Center visibility for any legacy queue that remains.
- Regression tests proving Phase 5 policy, budget, kill switch, payload hash, and approval-binding checks cannot be bypassed.

Exit gate:

- Reachable Gmail send paths are blocked or require the Phase 5 governed path.
- Calendar external writes use Phase 5 policy and `sendUpdates=none` sandbox rules unless a later phase deliberately changes policy.
- The old approval queue cannot execute external actions independently.

#### Phase 6C - Operator Control Center

Goal: make Command Center the practical cockpit for daily operation.

Deliverables:

- Unified pending approvals view across Task Runtime, Knowledge OS confirmations, Controlled Actions, Governance changes, Action Plans, Delegations, and any remaining legacy queue.
- Unified "why is this blocked?" evidence panel.
- Governance/budget/kill-switch state visible near every approval.
- Delegation review screen showing active authority, expiry, quota usage, policy hash, target restrictions, and last decisions.

Exit gate:

- The operator can answer "what can Mi do without me?" and "what is waiting on me?" from one screen.

#### Phase 6D - Evidence And Observability Contract

Goal: standardize facts, assumptions, unknowns, conflicts, and side-effect evidence across the stack.

Deliverables:

- Evidence reference contract shared by Personal OS, Knowledge OS, Operating Loop, Controlled Actions, Orchestration, Delegation, Task Runtime, and legacy adapters.
- Retention and redaction policy for evidence.
- Health metrics for: approvals waiting, blocked plans, stale knowledge, failed ingestion, policy drift, delegation expiry, DB integrity, scheduler status.
- Daily audit digest generated from evidence, not freeform claims.

Exit gate:

- Every user-facing assertion in operating summaries links to a source category.
- Every side-effect proposal/execution has a durable evidence trail.

#### Phase 6E - Knowledge Quality And Scale

Goal: improve evidence quality without letting retrieval become unsupported synthesis.

Deliverables:

- Larger retrieval evaluation suite with project-specific and conflict/staleness cases.
- Knowledge ingestion queue metrics and recovery dashboard.
- Optional semantic search experiment behind evaluation gates only; FTS remains canonical until measured improvement and citation safety are proven.
- Source freshness policy by document class.

Exit gate:

- Retrieval changes beat Phase 5 deterministic FTS baselines on quality without increasing hallucination or citation failures.

#### Phase 6F - Governed Automation Simulation

Goal: rehearse more capable plans without increasing live authority.

Deliverables:

- Simulation runner for action plans with fake providers and deterministic outcomes.
- Policy what-if tests for budgets, kill switches, policy drift, delegation quota exhaustion, expired approvals, and restart/resume.
- Operator preview for "this plan would request these approvals and could perform these effects."

Exit gate:

- More complex automations can be evaluated end-to-end without live side effects.

#### Phase 6G - Carefully Expanded Authority Candidates

Goal: only after 6A-6F, consider one new external capability at a time.

Candidate order:

1. Calendar create in sandbox/controlled contexts with explicit target restrictions.
2. Gmail draft quality and provenance improvements.
3. Gmail send only if a separate future phase proves draft provenance, recipient restrictions, revocation windows, final preview UX, audit export, and emergency kill-switch handling.

Exit gate:

- No Gmail send enablement in Phase 6A-6F.
- Any new authority has its own policy, tests, fixtures, rollback story, and Command Center visibility.

### Recommended Phase 6 Freeze Gates

| Gate | Requirement |
| --- | --- |
| G1 Source of truth | Route/authority classification complete and reviewed. |
| G2 No bypass | Tests prove legacy external send/create paths cannot bypass Controlled Actions. |
| G3 Operator view | Unified pending approvals and authority inventory visible. |
| G4 Evidence | Evidence contract adopted by new work and adapters. |
| G5 DB safety | Personal OS schema remains compatible; migrations are additive and backed up. |
| G6 Restart safety | Waiting approvals/plans/delegations survive restart without auto-approval or auto-execution. |
| G7 External safety | No new live external write provider without sandbox acceptance and explicit owner confirmation. |
| G8 Rollback | Feature flags and rollback docs exist for every changed authority path. |

## PARTIALLY DONE

Phase 5 already completed much of the foundation that Phase 6 needs:

- Personal OS v10 centralizes memory, knowledge, operating, action, governance, orchestration, and delegation records.
- Task Runtime and Project Registry are separate, bounded stores with their own safety contracts.
- Knowledge OS has deterministic retrieval, citations, staleness/conflict handling, and approved-root ingestion.
- Intelligence and Operating Loop separate facts, suggestions, unknowns, risks, and evidence.
- Controlled Actions, Governance, Orchestration, and Delegation have substantial restart/concurrency/security/evaluation coverage.
- Command Center already exposes most Phase 5 surfaces.

However, this is only partially done as an architecture because:

- Older mounted routes still carry overlapping concepts for approval, action execution, memory, knowledge, operations, autonomous work, and notifications.
- There is no single route-level authority inventory enforced by tests.
- Command Center does not yet appear to be the single operator console for all authority surfaces.
- Evidence and health concepts exist in several modules, but are not yet one shared contract.

## BLOCKED

No hard blocker was found for Phase 6 discovery.

Risks that should block any Phase 6 implementation until resolved:

- A reachable Gmail send path outside Phase 5 Controlled Actions.
- Any route that can perform external write/send/create/delete without classification and policy binding.
- Any automatic approval or delegation bypass that does not pass `ControlledActionService.approve`.
- Any schema change that moves Personal OS away from v10 without additive migration and backup.
- Any production/master mismatch beyond the intentional functional-SHA/docs-SHA split.
- Any production deployment, PM2 restart, DB migration, or external provider write during discovery.

## NOT STARTED

The following Phase 6 implementation work has not been started and should remain untouched until the roadmap is approved:

- Disabling or adapting legacy routes.
- Adding new Command Center screens.
- Adding new database migrations.
- Changing provider behavior.
- Enabling Gmail send.
- Changing scheduler behavior.
- Deploying or restarting production.

## EVIDENCE

### Commands Run

| Command intent | Path | Exit code | Evidence |
| --- | --- | ---: | --- |
| Fetch and inspect `origin/master` | `D:\Project\Mi-core-system\Master\mi-core` | 0 | `origin/master = 11c0a3dff11e51e6ec612d9780e0d914a701e237`; recent log includes Phase 5 final freeze docs merge and functional Phase 5I merge. |
| Inspect production checkout status | `D:\Project\Mi-core-system\Master\mi-core` | 0 | Production checkout on `codex/phase10-2-reality-closure`, HEAD `1db12eb31b6525870afc2b8ab827b0de3748b4bf`, dirty with unrelated changes. Not used as audit source. |
| Health check | local HTTP | 0 | `/api/health` returned 200 with server, Python AI service, and Ollama ok. |
| PM2 process list | local PM2 | 0 | `mi-core` and `mi-ai-service` online; `mi-core` runs from production checkout `server\dist\index.js`. |
| Read deployment markers | production `.env` | 0 | `MI_DEPLOYED_SOURCE_SHA=ff51bcab13cf6dfca7d1a6259046b35b282d08dc`; secrets not printed. |
| Personal/Task/Project DB integrity | production DB files | 0 | Personal v10 ok; Tasks ok; Projects ok; 0 FK violations. |
| `/api/tools` unauthenticated | local HTTP | 0 | 401. |
| `/api/tools` authenticated | local HTTP with local key | 0 | 200; key not printed. |
| Command Center root check | local HTTP | 0 | 200; root div present. |
| Branch/worktree creation | repository | 0 | Created `D:\mi-core-phase6-discovery` on `codex/phase6-discovery` at `origin/master`. |
| Authority boundary source search | `D:\mi-core-phase6-discovery` | 0 | Found R4 rejection, Gmail send block, policy/budget/kill-switch, orchestration/delegation gating. |
| Duplicate/legacy source search | `D:\mi-core-phase6-discovery` | 0 / 1 | Useful findings found; one broad search returned exit 1 because two glob/path inputs were invalid/missing. Subsequent targeted searches succeeded. |
| Count-only DB inventory | production DB files | 1 then 0 | First script printed Personal/Task counts then failed on Project Registry migration column shape; rerun with column check succeeded for Projects. |

### Key Files Inspected

- `server/src/index.ts`
- `server/src/personal-os/store.ts`
- `server/src/personal-os/service.ts`
- `server/src/task-runtime/types.ts`
- `server/src/task-runtime/store.ts`
- `server/src/task-runtime/engine.ts`
- `server/src/project-registry/types.ts`
- `server/src/project-registry/store.ts`
- `server/src/project-registry/service.ts`
- `server/src/personal-os/documents/service.ts`
- `server/src/personal-os/documents/store.ts`
- `server/src/personal-os/documents/retrieval.ts`
- `server/src/intelligence/store.ts`
- `server/src/intelligence/service.ts`
- `server/src/personal-os/operating/loop.ts`
- `server/src/personal-os/operating/brief.ts`
- `server/src/personal-os/operating/approvals.ts`
- `server/src/personal-os/actions/types.ts`
- `server/src/personal-os/actions/service.ts`
- `server/src/personal-os/actions/governance/schema.ts`
- `server/src/personal-os/actions/governance/engine.ts`
- `server/src/personal-os/actions/governance/risk.ts`
- `server/src/personal-os/orchestration/types.ts`
- `server/src/personal-os/orchestration/service.ts`
- `server/src/personal-os/delegation/types.ts`
- `server/src/personal-os/delegation/service.ts`
- `server/src/personal-os/delegation/eligibility.ts`
- `server/src/routes/approval.ts`
- `server/src/approval/gate.ts`
- `server/src/actions/google-executor.ts`
- `server/src/actions/gmail-action-adapter.ts`
- `server/src/routes/actions.ts`
- `server/src/voice/voice-output-orchestrator.ts`
- `server/src/jarvis/daily-briefing-scheduler.ts`
- `server/package.json`
- `command-center/package.json`

### Recommended Next PR

The immediate next PR should be docs/test-only planning for Phase 6A:

1. Add a route/authority classification artifact.
2. Add a test that fails when a mounted route lacks classification.
3. Add a legacy external-action quarantine plan.
4. Do not change production behavior until the classification is reviewed.

The first implementation PR after that should be Phase 6A, not Phase 6G.
