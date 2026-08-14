# Phase 7C — Runbook

Date: 2026-08-14

## What changed operationally

- New module `server/src/jarvis-gateway/`: `types.ts`, `intent-classifier.ts`,
  `project-resolver.ts`, `request-store.ts`, `services.ts`, `response.ts`,
  `gateway.ts`, `router.ts`, `handlers/*.ts` (11 files),
  `phase7c-evaluation.ts` (530-fixture evaluation), `phase7c-acceptance.ts`
  (20-point acceptance).
- `server/src/jarvis/executive/executive-personality.ts`: `tryGStack()`
  quarantined (returns `null`, never loads `gstack-orchestrator`).
- `server/src/jarvis/phase30-jarvis/jarvis-core.ts`: two call sites
  (website-publish trigger, "COO V4" autonomous trigger) quarantined to a
  fixed reply; all read-only/advisory coo-v4 call sites in the same file left
  untouched.
- `server/src/index.ts`: new import for
  `jarvisGatewayJsonParser`/`jarvisGatewayJsonErrorHandler`/
  `jarvisGatewayRouter`; mounted twice (Command Center session auth +
  API-key auth), matching the dual-mount convention.
- `server/src/authority-control-plane/registry.ts`: two new method-scoped
  rules (`jarvis-gateway-request` for `POST`, `jarvis-gateway-request-get`
  for `GET`), ordered ahead of the pre-existing `legacy-sensitive-local`
  wildcard.
- `command-center/src/routes/JarvisPage.tsx` (new), `App.tsx` (route added),
  `components/Layout.tsx` (nav item added), `components/StatusBadge.tsx` (6
  new states), `lib/types.ts` (Jarvis type mirrors added).
- New test/eval/acceptance scripts: `test:jarvis-gateway`,
  `test:jarvis-gateway-security`, `jarvis-gateway:evaluation`,
  `phase7c:acceptance`.
- New permanent security regression:
  `server/src/__tests__/phase7c-legacy-containment.test.ts`,
  `server/src/jarvis-gateway/__tests__/phase7c-legacy-mutation-scan.test.ts`.

## What did NOT change

No database schema migration — `personal-os.db` stays v10; the Gateway opens
no new database, `request-store.ts` is a bounded in-process `Map`, not a
persistent store. No new external action type — the governed set stays
frozen at `GMAIL_CREATE_DRAFT`/`CALENDAR_EVENT_PROPOSAL`/
`CALENDAR_CREATE_EVENT`. No Gmail SEND, no financial action. No autonomous
approval, merge, deploy, or shell/process/browser/desktop authority. No
Google OAuth reconnect, no Ollama start, no previously-intentionally-disabled
service started. No redesign of any frozen Phase 5/6 component — every
handler calls an existing canonical service's existing public method.

## Interpreting the response

| `status` | Meaning | What to do |
|---|---|---|
| `ANSWERED` | Direct, supported answer. | Nothing. |
| `NEEDS_CLARIFICATION` | Project reference ambiguous/unknown, or an action proposal is missing required structured fields. | Re-ask with the missing detail (project name, recipient, time, etc.). |
| `NO_SUPPORTED_ANSWER` | No canonical source could answer the question. | Not a bug — an honest "don't know," never a fabricated fact. |
| `CONFLICT` | Two sources disagree (Phase 6D truth semantics). | Check `conflicts[]`; resolve at the source system, not in the Gateway. |
| `DEGRADED` | A dependency (usually a model provider) is unavailable. | Check `degradedCapabilities[]`; try a more specific request type that doesn't need the degraded dependency. |
| `SIMULATED` | A `SIMULATION` request completed via `AutomationSimulationService`. | Read `simulation` preview; link to `/simulation` for full detail. Nothing was executed. |
| `PROPOSAL_READY` | (Reserved — current handlers never emit this; `ACTION_PROPOSAL` always asks for clarification first.) | N/A |
| `WAITING_APPROVAL` | (Reserved — current handlers never emit this; no handler surfaces a real pending-approval read yet.) | N/A today. When wired, this must go to `/approvals` in Command Center — never approve from the Jarvis page itself, which has no approve control. |
| `BLOCKED` | `SYSTEM_STATUS` reflecting a real `BLOCKED` overall health state (see Phase 7B). | Investigate the underlying health dependency, same as the Health page. |
| `FAILED` | An unexpected internal error. | Check server logs; this should be rare — every handler catches its own known failure modes into a more specific status. |

`EXECUTED` is never produced — the Gateway has no execution path.

## How to use it

```bash
curl -X POST -H "x-api-key: $MI_CORE_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"what tasks are waiting on me","projectId":"proj-123"}' \
  http://localhost:4001/api/jarvis/request

curl -H "x-api-key: $MI_CORE_API_KEY" http://localhost:4001/api/jarvis/request/<requestId>
```

Or via Command Center: **Jarvis** page in the sidebar (`g j` shortcut),
session-token gated like every other Command Center screen.

## Performance

Measured against the isolated-tmpdir evaluation harness in this dev
checkout:

- Direct-read paths (`TASK_QUERY`/`PROJECT_QUERY`/`GOAL_QUERY`/
  `OPERATOR_QUERY`/`PLANNING`/`CODING`): low-millisecond — `CODING` never
  calls into the Coding Engine at all (see below), so it's a fixed-cost
  advisory response, not a workflow call.
- `KNOWLEDGE_SEARCH`/`SIMULATION`: bounded by the canonical subsystem they
  call (`KnowledgeRetrievalService`, `AutomationSimulationService.run`).
- `SYSTEM_STATUS`: inherits Phase 7B's `getSystemHealth()` cost — ~2.6-4.3s
  in this sandboxed dev environment where the Python AI service and Ollama
  are not reachable (each probe pays the connection-refused/timeout cost).
  In a production runtime where those are actually running, this drops to
  near-zero.
- `INFORMATION`: bounded by `askAi()`'s real provider round-trip; no
  additional timeout was added at the Gateway layer beyond what
  `provider-router.ts` already has.

## Troubleshooting

- **A request returns `NEEDS_CLARIFICATION` for a project I expected to
  resolve**: `resolveProject()` only matches an exact whole-word,
  case-insensitive `displayName` substring — check the project's exact
  registered display name, or pass `projectId` explicitly.
- **`KNOWLEDGE_SEARCH` always returns `NEEDS_CLARIFICATION`**: this request
  type requires a resolved project — `KnowledgeRetrievalService` has no
  "search everything" mode by design (Phase 6E boundary). Supply a project
  reference or `projectId`.
- **`SYSTEM_STATUS` is slow**: expected in an environment where Python
  AI/Ollama aren't reachable — see Performance above and Phase 7B's own
  runbook for the underlying probe timeouts.
- **A response's `unknowns[]` text differs between two otherwise-identical
  calls**: only possible today for `INFORMATION`/`DEGRADED` responses, where
  the embedded text is `provider-router.ts`'s raw upstream error — it can
  legitimately vary with real network/circuit-breaker timing between calls.
  Every governance-relevant field (`status`, `intent`, `answer`, `facts`,
  `citations`) stays deterministic; only this diagnostic string doesn't, by
  design (see the evaluation's `normalize()` function in
  `phase7c-evaluation.ts` for the exact exclusion and why).
- **A live conversational path seems to reach a legacy engine**: this should
  be structurally impossible — run `npm run test:jarvis-gateway-security`
  and check the `phase7c-legacy-mutation-scan` output for which forbidden
  fragment/call matched, then treat it as a Sev-1 regression of the Phase
  7C boundary.

## Rollback

Standard: redeploy the prior `server/dist`/`command-center/dist` snapshot.
The Gateway is additive — rolling it back removes `/jarvis/request` and the
Command Center Jarvis page; nothing it touches requires a data migration to
revert, since it opens no database of its own. The
`executive-personality.ts`/`jarvis-core.ts` quarantine changes are a
one-directional security fix (closing a bypass), not a feature — rolling
back the Gateway does not need to reopen them, and they should not be
reverted independently of a full rollback.
