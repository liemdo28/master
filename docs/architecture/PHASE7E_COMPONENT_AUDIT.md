# Phase 7E — Component Audit

Date: 2026-08-15

## Reality audit (read-only, performed before this document)

Verified independently against live production and current master before any
implementation:

| Check | Result |
|---|---|
| Current master SHA | `91c7e21112ed1fb3d74d59c03406b6889c4d500a` (docs-only, Phase 7D closure) |
| Deployed functional SHA | `6432a034492b89f7d1e97fef21684a5b3b3a3ce6` (Phase 7D) |
| `.env` provenance vs. `snapshot-manifest.json` | Consistent — both report `6432a034...` |
| `GET /api/health` | `{"server":"ok","python_ai_service":"ok","ollama":"down","overall":"DEGRADED"}` |
| `GET /api/authority/status` | `mutations=402`, `unknownMutations=0`, `unresolvedLegacyMutations=0` |
| `personal-os.db` schema version | `10` (unchanged) |
| DB integrity/FK, all 3 DBs | `integrity_check=ok`, `0` FK violations |
| PM2 state | 6 processes, all online, no unexpected restarts |
| Jarvis Gateway live | `POST /api/jarvis/request` → `OPERATOR_QUERY`/`ANSWERED` |
| Phase 7D session endpoint | `GET /api/jarvis/session/current?sessionId=...` → correct 404 for never-created session |
| Command Center reachable | `GET /command-center/` → `200` |

No STOP condition triggered. Proceeding to implementation is authorized.

## Component inventory and classification

Legend: `CANONICAL_OWNER` (this is the system of record, Phase 7E must call
it, never reimplement it) / `REUSE` (existing component/page directly
reusable) / `ADAPT` (existing surface needs a small, additive change) /
`QUARANTINED` (legacy, must stay unreachable) / `LEGACY_READ_ONLY` (legacy,
observation-only access already permitted, unchanged) / `DUPLICATE`
(pre-existing overlap, not caused by 7E, noted not fixed) / `DEAD` (no
longer referenced) / `OUT_OF_SCOPE` (exists, not touched by this phase).

### Backend canonical services (all pre-existing, all read APIs already sufficient)

| Subsystem | Router | Classification | Notes |
|---|---|---|---|
| Jarvis Gateway | `jarvis-gateway/router.ts` | `CANONICAL_OWNER` | `POST /jarvis/request`, `GET /jarvis/request/:id`, `GET /jarvis/session/current` (7D) — the workspace's only conversation entrypoint. |
| Evidence | `evidence/router.ts` | `CANONICAL_OWNER` | `GET /evidence`, `/evidence/:id`, `/evidence/conflicts`, `/evidence/health`, `/evidence/digest/:date` — zero mutation routes exist; `redactionClassAtMost` hardcoded server-side. Sufficient as-is. |
| Knowledge | `personal-os/documents/router.ts` | `CANONICAL_OWNER` | `GET /knowledge-documents[/:id][/chunks]`, `POST /knowledge-documents/search` — sufficient for citation/document detail. |
| Simulation | `automation-simulation/router.ts` | `CANONICAL_OWNER` | `GET /simulation/:id` already returns full per-step policy/risk/budget/delegation/kill-switch detail. Sufficient as-is. |
| Orchestration / Action Plans | `orchestration/router.ts` | `CANONICAL_OWNER` | `GET /orchestration/plans`, `/orchestration/plans/:id`, `/orchestration/plans/:id/evidence` — sufficient for plan/step visualization. |
| Controlled Actions / Approvals | `actions/router.ts` | `CANONICAL_OWNER` | `GET /actions`, `/actions/:id`; `POST /actions/:id/approve` is the one true approval mutation — workspace links to it, never reimplements it. |
| Health Truth | `health-truth/*-router.ts` | `CANONICAL_OWNER` | `GET /health/detail` unchanged since Phase 7B. |
| Delegation | `delegation/router.ts` | `CANONICAL_OWNER` | `GET /delegations[/:id]` — sufficient. |
| Authority manifest | `authority-control-plane/router.ts` | `CANONICAL_OWNER` | `GET /authority/status`, `/authority/manifest` — sufficient. |
| Operator Control Center | `operator-control/router.ts` + `OperatorControlPage.tsx` | `REUSE` (already a cross-domain cockpit) | Already aggregates tasks/knowledge/actions/plans/delegations/authority into one triaged view. **Phase 7E must not build a second cross-domain aggregator** — the Jarvis workspace links to `/operator`, it does not duplicate it. |
| `chat/conversation-store.ts` + `routes/chat.ts` | — | `QUARANTINED` (no CC surface, unchanged) | Live legacy `/api/chat` execution path (dangerous-command detection, `executeMultiIntent`, `processCEORequest`) with zero Command Center page attached. Confirmed no page imports it. Out of scope — not touched, not linked to. |
| `gstack/gstack-orchestrator.ts` (`processGStackRequest`) | `routes/gstack.ts` | `QUARANTINED` | `POST /api/gstack/process` — own `requireKey` API-key check **plus** global `legacyAuthorityBoundary` (409-blocks before the handler runs), manifest-classified `LEGACY_QUARANTINED`/`QUARANTINE_ONLY`. Re-verified: no new/unexpected reachable call site found anywhere in `server/src`. |
| `coo-v4/coo-orchestrator.ts` (`cooExecute`/`handleCeoSignal`) | `routes/coo-v4-router.ts` | `QUARANTINED` | `POST /api/coo-v4/execute` — **no auth of its own**, relies solely on the global `legacyAuthorityBoundary` + manifest classification. **Residual risk, pre-existing, not introduced by 7E**: if a future phase ever reclassifies this surface's `phase6bDisposition` away from `QUARANTINE_ONLY`, this route would go live with zero authentication. Named here per directive §19's containment re-scan requirement; not something this phase can or should fix (out of scope — no execution/authority work in 7E). |
| `jarvis-core.ts`'s `getRunningWorkflows(` (coo-v4 read-only) | — | `LEGACY_READ_ONLY` | Explicitly-allowed observation-only exception, re-confirmed present (per the mutation-scan test's own assertion that it must stay present). |

### Frontend (Command Center)

| Component | File | Classification | Notes |
|---|---|---|---|
| `JarvisPage.tsx` | `command-center/src/routes/JarvisPage.tsx` | `ADAPT` | This IS "the existing canonical Jarvis route" the directive says to prefer (§4). Currently minimal: no context indicator, no session use (never sends `sessionId` despite the type already supporting it since 7D), no evidence inspector, no plan/simulation detail beyond one-line embedded summaries, citations not clickable. Phase 7E enhances this page in place — does not create a second Jarvis page. |
| `StatusBadge` | `components/StatusBadge.tsx` | `REUSE` | Already covers every `JarvisResponseStatus` value; extend its `STYLE` map only if a new OBSERVED/INFERRED/PROPOSED/APPROVAL_REQUIRED/BLOCKED/EXECUTED vocabulary badge is needed beyond what response `status` already implies. |
| `CategoryList` | `components/CategoryList.tsx` | `REUSE` | Matches facts/inferences/unknowns shape; `JarvisPage.tsx` currently reimplements this locally as `TruthList`/`StringList` — Phase 7E should switch to the shared component instead of keeping the local duplicate. |
| `EvidenceDrawer` (`EvidenceProvider`/`useEvidence`/`EvidenceButton`) | `components/EvidenceDrawer.tsx` | `REUSE` | App-wide slide-in drawer already used by ~8 pages for "Why?" affordances. Not currently used by `JarvisPage.tsx` — the evidence inspector requirement (§7) should be built as a new drawer-content renderer plugged into this existing provider, not a new drawer mechanism. |
| `DataBoundary`/`States` | `components/States.tsx` | `REUSE` | Standard loading/empty/error wrapper every other page uses; workspace must use the same for consistency with §22's empty/failure-state requirement. |
| `Layout` / `NAV_ITEMS` | `components/Layout.tsx` | `ADAPT` | Needs no new nav entry (the `/jarvis` entry already exists) — only the destination page changes. |
| Plan/simulation visualization component | — | `DEAD` (does not exist) | `PlanDetailPage.tsx` and `SimulationPage.tsx` both render their step/result detail with page-local inline code, not a shared component. Phase 7E needs new, small presentational components for plan-step and simulation-step rendering — reusing the *data* (existing types/endpoints) but adding new *presentation* components, which is not "duplicating a canonical system," it's a UI-only addition. |
| `ApprovalsPage.tsx` | `command-center/src/routes/ApprovalsPage.tsx` | `OUT_OF_SCOPE` (gap noted) | Its `/operating/approvals` feed does **not** include Controlled Action proposals (`/actions?status=WAITING_APPROVAL`) — a pre-existing gap, not caused by or fixed in this phase. The workspace's approval-required state links to `/actions`, not `/approvals`, for proposal-shaped approvals specifically. |
| `GovernancePage.tsx` | `command-center/src/routes/GovernancePage.tsx` | `DUPLICATE` (pre-existing, noted not fixed) | Substantially overlaps `ApprovalsPage.tsx`'s governance data. Pre-existing, out of scope for 7E. |

## What Phase 7E must NOT duplicate

- A second Jarvis Gateway, planner, task engine, knowledge store, evidence
  store, approval engine, execution engine, health model, or authority
  registry — none of these exist in Phase 7E; every panel reads from the
  table above's `CANONICAL_OWNER` row via its existing HTTP API.
- A second cross-domain operator cockpit — `/operator` already is one;
  the Jarvis workspace is conversation-centric and links to `/operator`
  for the broader triage view, per directive §4's explicit preference for
  "the existing canonical Jarvis route."
- A second conversation/session store — Phase 7D's `SessionStore` remains
  the only one; the workspace only *reads* it via the existing
  `GET /jarvis/session/current`.

## Design conclusion: no new backend mutation routes, likely no new backend routes at all

Every panel required by directive §4–§15 can be built by composing
already-existing `GET` endpoints:

| Panel | Data source |
|---|---|
| Conversation panel | `POST /jarvis/request` (existing, `sessionId` now actually sent) |
| Context indicator | `JarvisResponse.projectId`/`sessionId` (this turn) + `GET /jarvis/session/current` (session's `activeProjectId`, existing 7D route) |
| Evidence inspector | `GET /evidence`/`/evidence/:id` (existing), keyed by `JarvisResponse.evidenceRefs` |
| Knowledge explanation | `JarvisResponse.citations` (already present) + optionally `GET /knowledge-documents/:id` for deep-link |
| Plan visualization | `GET /orchestration/plans/:id` (existing), keyed by a plan id surfaced through `PLANNING`'s response |
| Simulation visualization | `GET /simulation/:id` (existing), keyed by `JarvisResponse.simulation.simulationId` |
| Approval surface | Link only to `/actions` (existing `POST /actions/:id/approve`) |
| Health integration | `JarvisResponse.healthImpact` + link to `/health` (existing) |
| Request trace | Reconstructed entirely from existing `JarvisResponse` fields (`intent`, `projectId`, `citations`, `evidenceRefs`, `simulation`, `proposal`, `approvalRequirement`, `status`) — no new backend concept needed |

**Expected authority manifest impact: none.** `mutations` should remain
exactly `402`. Schema stays v10 — this is a read-model/UI composition
phase; per directive §29, if implementation reveals a genuine need for a
new backend route or schema change, that requires an explicit STOP and
justification before proceeding, not a silent addition. The only
anticipated *frontend-only* addition is a `JarvisSession`/`ConversationTurn`
type mirror in `command-center/src/lib/types.ts` (no such mirror exists
today, confirmed by audit), since the frontend needs to render session
state `GET /jarvis/session/current` already returns.
