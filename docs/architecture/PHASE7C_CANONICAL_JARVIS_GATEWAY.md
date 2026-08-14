# Phase 7C — Canonical Jarvis Gateway

Date: 2026-08-14

## Mission

Give Mi-Core exactly one canonical conversational/request entrypoint that
routes into the existing canonical subsystems — never a second planner,
memory, retrieval, policy, approval, or executor. Phase 7C adds
**orchestration**, not new **authority** — see
[`PHASE7C_JARVIS_BOUNDARY.md`](../security/PHASE7C_JARVIS_BOUNDARY.md) for the
hard line between the two, and
[`PHASE7C_COMPONENT_AUDIT.md`](PHASE7C_COMPONENT_AUDIT.md) for why a canonical
gateway was needed at all (7 duplicate planners, 6+ duplicate approval
mechanisms, 5 independent conversation-memory stores found pre-existing).

## The contract (`server/src/jarvis-gateway/types.ts`)

`RequestType` is one of 11 values, assigned deterministically (never by an
LLM — see "Deterministic classification" below):

`INFORMATION | KNOWLEDGE_SEARCH | TASK_QUERY | PROJECT_QUERY | GOAL_QUERY |
PLANNING | SIMULATION | ACTION_PROPOSAL | CODING | SYSTEM_STATUS |
OPERATOR_QUERY`

`ResponseStatus` is one of 10 values: `ANSWERED | NEEDS_CLARIFICATION |
NO_SUPPORTED_ANSWER | CONFLICT | DEGRADED | SIMULATED | PROPOSAL_READY |
WAITING_APPROVAL | BLOCKED | FAILED`. `EXECUTED` is deliberately not a status
this gateway can ever produce — it has no execution path (point 12 of
`phase7c-acceptance.ts` proves this structurally).

`JarvisResponse` carries `requestId`, `intent`, `projectId`, `status`,
`answer`, `facts`/`inferences` (`TruthStatement[]`, `kind: 'FACT' |
'INFERENCE' | 'ASSUMPTION'`, reusing Phase 6D's truth semantics), `unknowns`/
`conflicts` (`string[]`), `citations` (`CitationRef[]` —
`documentId`/`chunkId`/`sourceUri`/`title`/`headingPath`/`lineStart`/
`lineEnd`, never a free-text citation string), `suggestedNextSteps`,
`simulation`/`proposal`/`approvalRequirement` previews, `healthImpact`,
`evidenceRefs`, and `degradedCapabilities`.

## Deterministic classification (`intent-classifier.ts`)

Pure ordered regex rules, first-match-wins, NFD-normalized (Vietnamese
diacritics stripped) — no LLM involved in deciding request type, and by
extension no LLM ever decides authority, approval, policy, project boundary,
or external-action permission (those stay downstream, in the canonical
subsystems the classification merely routes to). An LLM is used only inside
the `INFORMATION` handler, to answer free-text questions that have no
structured canonical path — never to decide what to do with the answer.

The evaluation harness caught one real classifier bug during development:
the original `SYSTEM_STATUS` rule matched a bare `\bstatus\b`/`\bhealth\b`,
which hijacked "what is the *project* status of X" into `SYSTEM_STATUS`
instead of `PROJECT_QUERY`. Fixed by scoping the rule to genuinely
system-shaped phrasing (`system health`, `health status`, `is ... up/down/
broken/healthy`, etc.) — regression-locked by the 530-fixture evaluation
(see [`PHASE7C_ACCEPTANCE.md`](../roadmap/PHASE7C_ACCEPTANCE.md)).

## Project resolution (`project-resolver.ts`)

Three explicit outcomes — `RESOLVED` / `AMBIGUOUS` / `UNKNOWN` (plus
`NOT_APPLICABLE` for request types that don't need a project) — never a
"closest match" guess. An explicit `projectId` is verified against the
registry; free-text project references are matched only by exact whole-word,
case-insensitive `displayName` substring match. Only `CODING` and
`KNOWLEDGE_SEARCH` require resolution before dispatch
(`PROJECT_REQUIRED_TYPES`); `KNOWLEDGE_SEARCH` was added here specifically
because `KnowledgeRetrievalService`'s own validator structurally refuses to
run without at least one `projectId` — "there is no query mode that searches
all private knowledge."

## Reuse-not-rebuild — what each handler actually calls

`server/src/jarvis-gateway/handlers/*.ts` — one file per request type. None
re-implements logic that already exists canonically:

| Request type | Reuses | Never |
|---|---|---|
| `SYSTEM_STATUS` | `health-truth/aggregate.ts`'s `getSystemHealth()` (Phase 7B) | The legacy jarvis health-center duplicate |
| `KNOWLEDGE_SEARCH` | `personal-os/documents/retrieval.ts`'s `KnowledgeRetrievalService.buildKnowledgePack()` (Phase 6E) | `knowledge-db`/`knowledge-federation`/`knowledge-indexer` |
| `TASK_QUERY` / `PROJECT_QUERY` / `GOAL_QUERY` / `OPERATOR_QUERY` | Direct reads of `TaskStore`/`ProjectRegistry`/`OperatorControl` | Any planning/simulation machinery |
| `PLANNING` | `GovernedOrchestrationService.list()` (Phase 5H), read-only surfacing of existing plans | Fabricating a new structured plan from free text; no `JarvisPlannerV2` |
| `SIMULATION` | `AutomationSimulationService.run()` (Phase 6F), always a `POLICY_WHAT_IF`/`READ_ONLY` step | `ControlledActionService`; never guesses a structured `CONTROLLED_ACTION` payload from free text |
| `ACTION_PROPOSAL` | Nothing execution-capable — always returns `NEEDS_CLARIFICATION` asking for the exact structured fields the 3 governed action types require | `.propose()`/`.approve()`/`.execute()` |
| `CODING` | Nothing execution-capable — a fixed advisory reply pointing to Command Center → Coding | `CodingWorkflow.planTask()`/`.run()` (both create a real task and a real git worktree — see `PHASE7C_JARVIS_BOUNDARY.md`) |
| `INFORMATION` | `services/ai-client.ts`'s `askAi()` (existing canonical multi-provider router) | A second model-routing layer |

## Conversation state — deliberately minimal

`request-store.ts` is a bounded, non-persistent, in-process `Map`
(500-entry cap, 30-minute TTL) that exists only to answer `GET
/jarvis/request/:id` for a request just made. It is **not** a 6th
conversation-memory store — the component audit found 5 pre-existing ones,
and full consolidation is explicitly deferred to Phase 7D. No new database,
no new schema (`personal-os.db` stays v10).

## Canonical read-only/plan-only API

- `POST /jarvis/request` — the single request-creation entrypoint. No
  generic `/execute`.
- `GET /jarvis/request/:id` — retrieves a cached response; `404` if expired
  or never existed.

Mounted in `server/src/index.ts`: `jarvisGatewayRouter` at both
`/api/command-center` (`requireRemoteAuth`) and bare `/api`
(`requireTaskRuntimeAuth`), matching the dual-mount convention established
since Phase 5E and reused by Phase 7B's health routes.

## Command Center

`command-center/src/routes/JarvisPage.tsx`: free-text input + project
selector + "Ask" button, rendering status badge, intent, answer,
facts/inferences/unknowns/conflicts, citations, and links out to
`/simulation`, `/actions`, `/health`, `/approvals` for anything that isn't a
direct answer. Zero mutation buttons, zero `onClick` that calls
`api.post`/`patch`/`del` — verified by both a unit test and a structural
acceptance check, matching the precedent set by `HealthPage.tsx` in Phase
7B.

## Legacy containment — what Phase 7C found and closed

The component audit (`PHASE7C_COMPONENT_AUDIT.md`) found a live, in-process
security bypass: `gstack-orchestrator.processGStackRequest()` and
`coo-v4/coo-orchestrator.ts`'s `cooExecute()`/`handleCeoSignal()` were
`LEGACY_QUARANTINED` and 409-blocked at the HTTP layer, but were still
directly reachable via in-process `require()` + call from
`jarvis/executive/executive-personality.ts` and
`jarvis/phase30-jarvis/jarvis-core.ts` on raw WhatsApp text — completely
bypassing the HTTP quarantine, since Express middleware cannot intercept a
direct function call. Through this path a message could have reached
`execSync('pm2 restart ...')`, a real external website-publish connector, and
an `exec()` call with unescaped content interpolated into a shell command.
Closed using the exact technique Phase 7A established for
`autonomous-task-runner.ts`: the call sites now return a canned
`QUARANTINED_PHASE_7C1` reply instead of ever loading the quarantined module.
Full detail, including the permanent structural regression test that proves
this stays closed, is in
[`PHASE7C_JARVIS_BOUNDARY.md`](../security/PHASE7C_JARVIS_BOUNDARY.md).
