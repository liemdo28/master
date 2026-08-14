# Phase 7C — Component Audit

Date: 2026-08-14

Read-only audit performed before any Phase 7C implementation, per the
governing directive's Section 2 ("No implementation until one canonical
route is selected"). Six parallel research passes independently re-verified
every claim in `docs/architecture/PHASE7_DISCOVERY_AND_ROADMAP.md` against
current code (not just re-stated it) and extended it with findings from
after that doc was written — Phase 7A's containments and Phase 7B's health
model are both now live, and this audit checks whether anything downstream
actually knows about them.

## Executive summary

- The original discovery doc undercounted duplication. It found "5+ reasoning
  engines, 4 planners, 3 approval mechanisms, 5 memory stores, 4 knowledge
  implementations." This audit found **at least 7 planner/orchestrator
  implementations, 6+ independent approval/risk-classification mechanisms, 5
  separate conversation-memory stores, and confirms canonical Phase 6E
  knowledge retrieval has exactly one caller in the entire codebase outside
  its own module** (`personal-os/operating/brief.ts`).
- **Critical, pre-existing security finding, not introduced by Phase 7C**:
  `gstack`/`coo-v4` are correctly quarantined at the HTTP layer
  (`legacyAuthorityBoundary` 409-blocks their mutating routes), but both are
  reachable via direct in-process function calls from
  `jarvis/executive/executive-personality.ts:416-427` and
  `jarvis/phase30-jarvis/jarvis-core.ts:246-247,535-540,548` on raw WhatsApp
  text — completely bypassing that quarantine, since Express middleware
  cannot intercept an in-process function call. Through this path a WhatsApp
  message can reach `execSync('pm2 restart …')`, a real external
  website-publish call (`gstack/connectors/raw-website-connector.ts`), and a
  shell command with unescaped content interpolated directly into it
  (`coo-v4/agents/creative-agents.ts:78`, command-injection shaped). This is
  addressed as required legacy-entrypoint containment in this phase — see
  "Containment decisions" below — using the same precedented technique
  Phase 7A used for `autonomous-task-runner.ts` (make the call sites return
  blocked, do not redesign the subsystems themselves).
- A genuinely new ungoverned external-write path was found beyond the
  original doc's three:
  `whatsapp/ceo-command-router.ts`'s `handleReviewCommand()` makes live
  writes (`approve`/`post`/`reject`/`escalate`) to an external Review System,
  gated only by an env-var phone allowlist — never `ControlledActionService`
  or `approval/gate.ts`.
- `/api/mi` (`mi-review-approvals.ts`) is mounted with **no auth at all**,
  and one of its two mutation routes has no auth of any kind, not even the
  router's own optional check.
- Command Center confirmed to have zero chat/Jarvis page today (26 routes,
  none conversational), and `MI_CORE_API_KEY` is never referenced in
  frontend code.
- The canonical coding engine (`server/src/coding/`) is loopback-locked to
  Ollama only and has its own separate, already-sandboxed
  (`shell:false`, allow-listed, worktree-scoped) command-execution surface —
  distinct from and unrelated to the gstack/coo-v4 finding above.

## 1. Conversational entrypoints — what actually handles a WhatsApp/chat message today

A single inbound WhatsApp message (`POST /api/whatsapp/mi`,
`server/src/routes/whatsapp.ts`) passes through an 18-stage waterfall and can
be answered by any of up to **seven** different reasoning paths depending on
which regex/classifier fires first: `execution/index.ts`'s
`processCEORequest()`, `jarvis-core.ts`'s `processJarvisQuery()` (called
**twice** in the same waterfall, stages 11 and 16),
`communication/natural-conversation-engine.ts` (via `mi-human-assistant.ts`,
called **twice**, stages 12 and 14), `skills/skill-registry.ts`,
`whatsapp/ceo-command-router.ts`, and finally
`pipeline/response-pipeline.ts`'s `runPipeline()` as the last-resort
fallback. **`KnowledgeRetrievalService`
(`personal-os/documents/retrieval.ts`, the canonical Phase 6E retrieval
path) is reachable from none of these seven.**

Separately, `server/src/routes/chat.ts` (`POST /api/chat`, mounted
`index.ts:309` behind `requireAuth`) is a fully independent HTTP+WS chat
entrypoint that never imports `personal-os/` or `task-runtime/` at all — it
has its own dangerous-command gate, its own multi-intent short-circuit, and
falls to the same `pipeline/response-pipeline.ts` used by WhatsApp's
last-resort stage.

### Entrypoint inventory

| Entrypoint | Route | Auth | Reaches canonical Knowledge? | Reaches canonical Governance/Approval? | Classification |
|---|---|---|---|---|---|
| `jarvis-core.ts` `processJarvisQuery()` | `POST /api/jarvis/evolution/query` (double-gated: `requireAuth` + a second raw-`x-api-key` check); also called directly from WhatsApp waterfall (2x) and `gstack/skills/skill-registry.ts`, `gstack/role-agents/qa-agent.ts` | Mixed | No — own `phase21-knowledge/knowledge-indexer.ts` FTS index | No — internally reaches `gstack`/`coo-v4`/`autonomous`/`council` directly (see below) | LEGACY, highest-traffic single node |
| `communication/natural-conversation-engine.ts` (via `mi-human-assistant.ts`) | Not directly HTTP-routed; reached from WhatsApp waterfall (2x) and `routes/voice.ts` | N/A (internal) | No | No | ADAPTER — delegates to jarvis-core/executive-personality, inherits their gaps |
| `pipeline/response-pipeline.ts` `runPipeline()` | Fallback stage of `POST /api/whatsapp/mi` and primary path of `POST /api/chat` | Mount-level `requireAuth` on `/api/chat`; unauthenticated internally on the WhatsApp fallback (gated further up the waterfall) | No — calls `knowledge/knowledge-db.ts` (FTS5) and `knowledge-federation/index.ts` (separate aggregator), never `KnowledgeRetrievalService` | No — calls `askAiWithBrain()` → `providers/provider-router.ts` directly; no governance/approval layer at all (it is answer-only, doesn't execute) | LEGACY, two more duplicate-knowledge implementations |
| `execution/index.ts` `processCEORequest()` | Early WhatsApp waterfall stage | Internal | No | **Own** approval flow (`execution/approval-orchestrator.ts`) — a 5th+ independent approval mechanism, not `ControlledActionService` | LEGACY |
| `whatsapp/ceo-command-router.ts` | WhatsApp waterfall stage | Env-var phone allowlist only | No | `handleReviewCommand()` writes live to an external Review System with no `ControlledActionService`/`approval/gate.ts` involvement | LEGACY, **new ungoverned write path** |
| `gstack/gstack-orchestrator.ts` `processGStackRequest()` | `POST /api/gstack/process` — **LEGACY_QUARANTINED, 409-blocked at HTTP layer** — but also `require()`d directly by `executive-personality.ts:416-427` on raw text, bypassing the block entirely | HTTP: blocked. In-process: none | No | **Own** approval engine (`gstack/approval-engine.ts`) | LEGACY_QUARANTINED at HTTP, **live bypass via in-process call** |
| `coo-v4/coo-orchestrator.ts` `cooExecute()`/`handleCeoSignal()` | `POST /api/coo-v4/execute` etc. — **LEGACY_QUARANTINED, 409-blocked at HTTP layer** — but also `require()`d directly by `jarvis-core.ts:246-247,535-540,548` on raw text, bypassing the block entirely | HTTP: blocked. In-process: none | No | **Own** governor (`coo-v4/production-governor.ts`) + 9-agent council (`coo-v4/agent-council-v4.ts`) | LEGACY_QUARANTINED at HTTP, **live bypass via in-process call** |
| `routes/chat.ts` (`POST /api/chat`) | Direct HTTP route | `requireAuth` | No (via `runPipeline`) | No | LEGACY, real live entrypoint, never touches Personal OS |

## 2. Legacy entrypoint containment decisions (directive Section 34)

Per the directive: *"For each legacy Jarvis/chat route: choose
ADAPT_TO_GATEWAY / READ_ONLY_COMPATIBILITY / QUARANTINE / DEPRECATE. No
legacy mutation path may bypass gateway/canonical governance."*

| Entrypoint | Decision | Rationale |
|---|---|---|
| `gstack-orchestrator.processGStackRequest()`'s in-process call site (`executive-personality.ts:416-427`) | **QUARANTINE** (this phase) | Same technique as Phase 7A's `autonomous-task-runner.ts`: the call site is made to return a blocked/quarantined result instead of invoking the orchestrator, closing the live HTTP-quarantine-bypass. HTTP route stays quarantined as-is. No redesign of `gstack/` itself. |
| `coo-v4/coo-orchestrator.ts`'s two in-process call sites (`jarvis-core.ts:246-247,535-540,548`) | **QUARANTINE** (this phase) | Same technique, same rationale — closes the bypass without touching `coo-v4/`'s internals. |
| `jarvis-core.ts` `processJarvisQuery()` | **ADAPT_TO_GATEWAY** | Remains reachable for its own narrow, already-governed behaviors (WhatsApp NLP for non-authority queries), but the new Jarvis Gateway becomes the canonical entrypoint for anything Command Center/API-facing; `jarvis-core.ts`'s in-process calls into `autonomous/`/`council/` are read-only classification helpers (confirmed no execution capability of their own — see §4) and are left as-is, not quarantined. |
| `execution/approval-orchestrator.ts`, `gstack/approval-engine.ts`, `coo-v4/production-governor.ts`, `coo-v4/agent-council-v4.ts` | **READ_ONLY_COMPATIBILITY** | Left running for their existing narrow scopes (they don't themselves execute anything without going through the orchestrators quarantined above); the Jarvis Gateway never calls any of them for authority decisions — only canonical `ActionPolicyEngine`/`RiskEvaluator`/`BudgetManager`/`KillSwitchService` can authorize gateway-initiated action proposals. |
| `whatsapp/ceo-command-router.ts` `handleReviewCommand()` | **QUARANTINE-FLAG, not fixed this phase** | Real ungoverned write path, but out of the Jarvis Gateway's own call graph (WhatsApp-only, phone-allowlist-gated, pre-existing). Documented here and in the Security Boundary doc as a known gap for a future phase; the Gateway does not add a new path to it and does not inherit it. |
| `communication/whatsapp-router.ts`, `communication/message-normalizer.ts`, `communication/response-formatter.ts` | **DEPRECATE (dead already)** | Confirmed zero importers anywhere in the repo — safe to leave in place (removal is a separate, non-functional cleanup) or delete in a later hygiene pass; not touched by this phase. |
| `jarvis/decision-gate-runtime.ts`, `jarvis/evidence-gate-runtime.ts`, `jarvis/executive/confidence-engine.ts` + `confidence-rules.ts` | **DEPRECATE (dead already)** | Fully unreachable or imported-but-never-called; not touched by this phase. |
| `routes/chat.ts` (`POST /api/chat`) | **READ_ONLY_COMPATIBILITY** | Left running as-is for existing integrations; the new Jarvis Gateway does not replace it in this phase, only adds the new canonical `/api/jarvis/request` surface. A future phase may formally deprecate it once Command Center and any other callers have migrated. |

## 3. Canonical subsystem owner map

| Subsystem | Canonical owner | Mounted? |
|---|---|---|
| Personal OS | `personal-os/service.ts` `PersonalOsService` | Yes, `index.ts:238,254` |
| Task Runtime | `task-runtime/engine.ts` `TaskEngine` | Yes, `index.ts:235,252` |
| Project Registry | `project-registry/service.ts` `ProjectRegistryService` | Yes, `index.ts:237,313` |
| Daily Operating Loop | `personal-os/operating/loop.ts` `DailyOperatingLoop` | Yes, `index.ts:241,257` |
| Phase 5H Governed Orchestration | `personal-os/orchestration/service.ts` `GovernedOrchestrationService` | Yes, `index.ts:244,260` |
| Phase 6F Automation Simulation | `personal-os/automation-simulation/service.ts` `AutomationSimulationService` | Yes, `index.ts:249,265` |
| Controlled Actions | `personal-os/actions/service.ts` `ControlledActionService` | Yes, `index.ts:242,258` |
| Governance (Policy/Risk/Budget/KillSwitch) | `personal-os/actions/governance/engine.ts` `ActionPolicyEngine` (composes `RiskEvaluator`/`BudgetManager`/`KillSwitchService`) | Yes, indirectly via `ControlledActionService`, plus own router `index.ts:243,259` |
| Delegation | `personal-os/delegation/service.ts` `DelegationService` | Yes, `index.ts:245,261` |
| Evidence | `evidence/service.ts` `EvidenceService` | Yes, `index.ts:248,264` |
| Operator Control | `operator-control/service.ts` `OperatorControlService` | Yes, `index.ts:247,263` |
| Knowledge Retrieval | `personal-os/documents/retrieval.ts` `KnowledgeRetrievalService` (`buildKnowledgePack()` — *"the only code path allowed to assemble a KnowledgePack"*) | Yes, mounted; but only 1 in-code caller outside its own module (`personal-os/operating/brief.ts`) |
| Health Truth | `health-truth/aggregate.ts` `getSystemHealth()` | Yes, `index.ts:225,249,265` (Phase 7B) |
| Coding Engine | `coding/workflow.ts` `CodingWorkflow` | Yes, `index.ts:236,253` |

## 4. Duplicate planner/orchestrator inventory (revised count: 7, not 4)

1. `personal-os/orchestration/` — **CANONICAL**.
2. `gstack/gstack-orchestrator.ts` — LEGACY_QUARANTINED at HTTP, contained this phase (see §2).
3. `coo-v4/coo-orchestrator.ts` — LEGACY_QUARANTINED at HTTP, contained this phase (see §2).
4. `jarvis/phase27-workflows/workflow-runner.ts` — LEGACY, adapted (static workflow definitions run against `phase23-tools`, which is inert metadata — no live dispatch found).
5. `executive-intelligence/executive-planner.ts` + `executive-intelligence-orchestrator.ts` — LEGACY, mounted at `/api/executive-intelligence` (`requireAuth`), not touched by this phase (not in the Gateway's call graph).
6. `execution-orchestrator/index.ts` — LEGACY; its "QA"/"evidence" results are hardcoded always-passing (`qaResult:{passed:true,score:100,...}`), i.e. closer to a stub than a real executor.
7. `execution/index.ts` `processCEORequest()` + `execution/approval-orchestrator.ts` — LEGACY, own 5th+ approval mechanism.

None of 2-7 are used by the new Jarvis Gateway. The Gateway calls
`GovernedOrchestrationService` exclusively for anything planning-shaped.

## 5. Duplicate approval/risk-classification inventory (revised count: 6+, not 3)

1. `personal-os/actions/governance/engine.ts` `ActionPolicyEngine` — **CANONICAL**.
2. `approval/gate.ts` — status/audit record only (Phase 7A verified), not itself authorizing.
3. `gstack/approval-engine.ts` — own SAFE/REQUIRES_APPROVAL classifier.
4. `coo-v4/production-governor.ts` — own SAFE/REQUIRES_APPROVAL/DANGEROUS/BLOCKED classifier.
5. `coo-v4/agent-council-v4.ts` — 9-agent weighted-vote council, can BLOCK/ESCALATE.
6. `execution/approval-orchestrator.ts` — own ApprovalRequest/approve/edit/cancel flow.
7. `autonomous/autonomous-execution-engine.ts` `classifyAutonomy()` — FULL_AUTO/NOTIFY_AFTER/REQUIRES_APPROVAL/BLOCKED classifier, no persistence.
8. `council/multi-agent-council.ts` `runCouncilSession()` — 6-persona stateless consensus simulator.

Only #1 (`ActionPolicyEngine`) may authorize a Jarvis Gateway-initiated
action proposal. None of 3-8 are consulted by the Gateway.

## 6. Duplicate conversation-memory inventory (5 independent stores)

1. `personal-os.db` (canonical, used by Daily Operating Loop context).
2. `chat/conversation-store.ts` — SQLite-backed, used by `routes/chat.ts`.
3. `communication/conversation-memory.ts` — in-memory `Map`, 4h TTL, used by WhatsApp waterfall.
4. `jarvis/phase30-jarvis/conversation-store.ts` — in-memory, 30-min TTL, used by `jarvis-core.ts`.
5. `jarvis/executive/context-engine.ts` — in-memory, used by `executive-personality.ts`, entity/pronoun resolution — live in the *same call chain* as #4 with no shared state.
6. `coo-v4/durable-workflow.ts` — SQLite-backed workflow/step/signal store (`workflows.db`), a 6th persistence layer not previously counted.

The Jarvis Gateway uses the minimal existing canonical context needed
(directive Section 24 — full consolidation is explicitly deferred to Phase
7D) and introduces no new persistent store.

## 7. Duplicate knowledge/model-routing inventory

- **Canonical**: `personal-os/documents/retrieval.ts` `KnowledgeRetrievalService`/`buildKnowledgePack()`.
- Legacy, live, bypass canonical retrieval: `jarvis/phase21-knowledge/knowledge-indexer.ts` (filesystem FTS-style index, used by `jarvis-core.ts`), `knowledge/knowledge-db.ts` (FTS5, used by `pipeline/response-pipeline.ts`), `knowledge-federation/index.ts` (aggregator, used by `pipeline/response-pipeline.ts`).
- **Coding model routing (CANONICAL for coding)**: `coding/workflow.ts` → `coding/model-router.ts` `selectCodingModelRoles()` → Ollama only, loopback-enforced (`assertLoopbackEndpoint()` hard-blocks any non-localhost host).
- **Chat/Jarvis model routing (CANONICAL for chat, separate purpose from coding)**: `providers/provider-router.ts` (multi-provider: openai/anthropic/gemini/deepseek/ollama/minimax, circuit-breaker around Ollama) + `brain/brain-router.ts` (`selectBrainConfig()`, picks model config per classified intent) → `services/ai-client.ts` `askAiWithBrain()`. Used by `pipeline/response-pipeline.ts` and `connectors/briefing-engine.ts`.
- **Dead** (zero importers, confirmed by repo-wide grep): `executive-intelligence/structured-llm.ts`'s generation path (`callStructuredLLM`/`callLLMText`), `models/local-model-router.ts` (`selectModel`/`recordModelOutcome`).
- `model-router/ollama-router.ts` — ADAPTER, shared Ollama-only utility consumed by multiple status/health routes and as a fallback tier inside `coding/model-router.ts`.

The Jarvis Gateway's model routing (directive Section 13) reuses
`providers/provider-router.ts` + `brain/brain-router.ts` for
chat/conversational generation (already the canonical implementation for
that purpose) and `coding/workflow.ts` unchanged for coding requests — no
new routing layer is created.

## 8. Command Center / API surface

- Command Center: 26 routes registered in `App.tsx`, zero chat/Jarvis page. `MI_CORE_API_KEY` never referenced in `command-center/src/`.
- `/api/jarvis` (`routes/jarvis.ts`, mounted `index.ts:310` behind `requireAuth`): 40 routes, mostly read-only operational-control (monitor/alerts/knowledge/memory/agents/observability/workflows/twin), several real mutation routes (`POST /monitor`, `/alerts/:id/ack`, `/approvals/:id/approve|reject` [note: `createApproval` is never called in production, so this always operates on an empty store], `/briefing/trigger`, `/knowledge/index`, `/memory/store`, `/agents/route`, `/observability/sweep`, `/workflows/:id/run`, `/twin/simulate/:id`), plus `POST /evolution/query` which is separately double-gated (`requireAuth` + a second raw `x-api-key` check) and drives the full `jarvis-core.ts` NLP pipeline.
- `/api/mi` (`routes/mi-review-approvals.ts`, mounted `index.ts:336`): **no auth at mount level**; `POST /review-approvals` has an *optional* per-route token check that no-ops if the token env var is unset; `POST /review-approvals/sweep-timeouts` has **no auth of any kind**. Both are under the rate-limiter's internal-Jarvis-bypass prefix (`/api/mi`) but that bypass only matters if the caller *has* the internal key — these routes don't require it at all. **Flagged for the Security Boundary doc**; the new Jarvis Gateway does not use or extend this router.

## 9. Non-conversational cross-checks

- Phase 7A's `autonomous-task-runner.ts` quarantine verified still solid in current code — both exported functions unconditionally return `blocked`, no `child_process` import.
- Phase 7B's canonical health-truth model (`server/src/health-truth/`) has **zero references anywhere under `server/src/jarvis/`** — `jarvis/phase26-observability/health-center.ts` remains a completely separate, non-integrated health implementation. The new Jarvis Gateway uses `health-truth/aggregate.ts` directly (directive Section 12); it does not call `health-center.ts`.
- The coding engine's own `child_process` surface (`coding/llm/tools.ts` `runRegisteredCommand()`, `coding/validation-runner.ts`, `coding/git.ts`, `coding/resource-control.ts`) is legitimate and already sandboxed (`shell:false`, allow-listed commands only, worktree-scoped, output-capped, timeout-bounded) — confirmed distinct from and unrelated to the gstack/coo-v4 finding in §2. The Jarvis Gateway routes coding requests to `coding/workflow.ts` unchanged and never touches this surface directly (directive Section 22).
- Several new instances of the pre-Phase-7A-era stale hardcoded path bug
  (`E:/Project/Master/...` defaults, predating the D:→F: drive migration)
  were found beyond the two the original discovery doc listed:
  `jarvis/autonomous-task-runner.ts:18`, `jarvis/ceo-preference-store.ts:10`,
  `jarvis/phase21-knowledge/knowledge-indexer.ts:31,33`,
  `gstack/work-order-engine.ts:13`, `gstack/execution-ledger.ts:12`,
  `execution/approval-orchestrator.ts`. All are log/data-path defaults, not
  security-relevant, and out of scope for this phase (not touched).

## Conclusion — canonical route selected

Per directive Section 2, one canonical route is selected: **a new
`JarvisGateway` service** (server/src/jarvis-gateway/, see
`docs/architecture/PHASE7C_CANONICAL_JARVIS_GATEWAY.md`) that orchestrates
the existing canonical subsystems listed in §3, uses the canonical Knowledge
retrieval, planner, and approval implementations exclusively, and never
calls any of the LEGACY/duplicate implementations catalogued in §4-§7. The
two in-process quarantine-bypass call sites found in §2 are closed as
required legacy-entrypoint containment before the Gateway is considered
complete.
