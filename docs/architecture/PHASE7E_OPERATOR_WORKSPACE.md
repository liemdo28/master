# Phase 7E — Operator Workspace

Date: 2026-08-15

Phase 7E builds the canonical human-facing Operator Workspace for Jarvis —
the `/command-center/jarvis` page — as a **thin composition layer** over the
Phase 7C Gateway, the Phase 7D SessionStore, and the existing canonical
read APIs the component audit
([`PHASE7E_COMPONENT_AUDIT.md`](PHASE7E_COMPONENT_AUDIT.md)) inventoried.
It introduces zero new backend mutation routes and zero new backend routes
of any kind — every panel renders data an existing `GET` endpoint already
returns.

## The locked invariants (carried forward, not reopened)

> `SessionStore != memory. JarvisResponse != execution evidence. Simulation
> != execution. Approval != execution. UI != authority. Frontend composition
> != new backend mutation surface.`

Phase 7E adds a UI. It does not grant Jarvis, or this page, any authority
Phase 5–7D hadn't already independently decided to grant. Every mutation the
workspace can reach is a hyperlink to a canonical page (`/actions`,
`/tasks/:id`, `/orchestration/plans/:id`) that already has its own approval
gate — never an inline control on this page itself.

## Truth-status vocabulary

`command-center/src/lib/jarvis-workspace.ts` defines one closed vocabulary,
rendered by `TruthStatusBadge`:

```ts
type TruthStatus = 'OBSERVED' | 'INFERRED' | 'PROPOSED' | 'APPROVAL_REQUIRED' | 'BLOCKED' | 'EXECUTED';
```

Four pure functions derive it, each with a distinct evidentiary bar:

- **`responseTruthStatus()`** — a Jarvis conversational response can never
  produce `EXECUTED`: the `JarvisResponseStatus` type itself has no such
  value, so this is a structural guarantee, not a runtime check.
  `WAITING_APPROVAL` → `APPROVAL_REQUIRED`, `BLOCKED` → `BLOCKED`,
  `SIMULATED`/`PROPOSAL_READY`/a non-null `proposal` → `PROPOSED`,
  `ANSWERED` → `OBSERVED` if it carries facts, else `INFERRED`.
- **`planTruthStatus()`** — requires **real fetched evidence**
  (`ActionPlanEvidence.eventType === 'STEP_EXECUTED'`) to ever return
  `EXECUTED`. A plan's own `status` field is never trusted alone for this —
  see the regression-locked case below.
- **`proposalTruthStatus()`** — requires a non-null `executedAt`
  **combined with** a fetched `ActionExecution` record whose `status ===
  'COMPLETED'`. A `COMPLETED`-looking status string on the proposal itself,
  without a matching execution record, is explicitly **not** sufficient —
  this exact case is a locked regression test in
  `jarvis-workspace-evaluation.test.ts`, added per the user's explicit
  request to "turn that into its own test invariant" after reviewing the
  design.
- **`simulationTruthStatus()`** — always returns `PROPOSED`, unconditionally,
  even for a `WOULD_EXECUTE` outcome label. A simulation is never execution
  evidence, by construction, not by convention.

### Why this matters

A prior-phase-style bug class this design specifically forecloses: a stale
or partially-updated record (e.g. a plan whose `status` field says something
execution-shaped but whose actual step evidence never landed) rendering as
`EXECUTED` in the UI when nothing actually ran. Every one of the four
functions requires either a structural impossibility (response) or a second,
independently-fetched evidence source (plan/proposal) before claiming
`EXECUTED` — never a single optimistic field read.

## Component map

| Component | File | Data source |
|---|---|---|
| Conversation panel + History | `routes/JarvisPage.tsx` | `POST/GET /jarvis/request[/:id]` (existing) |
| Context indicator | `components/jarvis/ContextIndicator.tsx` | `deriveContextState()` over `JarvisResponse`/`GET /jarvis/session/current` (existing 7D route) |
| Evidence inspector | `components/jarvis/EvidenceInspector.tsx` | `GET /evidence/:id` (existing, Phase 6D), keyed by `evidenceRefs` |
| Plan inspector | `components/jarvis/PlanInspector.tsx` | `GET /orchestration/plans/:id[/evidence]` (existing) |
| Simulation inspector | `components/jarvis/SimulationInspector.tsx` | `GET /simulation/:id` (existing, Phase 6F) |
| Truth-status badge | `components/TruthStatusBadge.tsx` | Pure function of already-fetched data — no new fetch |

`InspectorPanel` (in `JarvisPage.tsx`) is a `role="tablist"` switcher over
these four; which tabs are available depends on what the selected response
actually contains (`plan`/`simulation` tabs only appear when the response
has a plan id / simulation result).

## Context indicator (§5)

`deriveContextState(latest, requestedProjectId)` returns
`{ sessionKind, explicitThisTurn, contextReused, clarificationRequired }`.
`explicitThisTurn` is computed directly from what the caller passed this
turn — it always outranks session-derived context by construction, the same
"explicit always wins" rule Phase 7D's `gateway.ts` itself enforces
server-side; the indicator only *displays* that outcome, it cannot
override it. Session kind (`device` vs `explicit` vs `none`) is shown, never
a raw `device_id`, API key, or session token.

## Evidence Inspector (§7)

Reuses Phase 6D's `EvidenceService` exclusively via its existing
`GET /evidence/:id` route, which itself hardcodes
`redactionClassAtMost` server-side — the component never bypasses that, it
only renders whatever the router already decided is operator-safe.
`evidenceRefs` may also contain Jarvis Gateway's own short-prefix pointers
(`task:<id>`, `goal:<id>`, `plan:<id>`, `project:<id>`), which are not real
Evidence Service ids; `parseEvidenceRef()` routes those to a direct link to
the canonical page instead of an Evidence fetch.

## Plan / Simulation Inspector (§9/§10)

Both are strictly observational. `PlanInspector` renders steps sorted by
`stepIndex` and links to the full plan detail page — no approve/start/cancel
control exists here. `SimulationInspector` always renders the mandatory
**"SIMULATION — NO LIVE EXECUTION"** banner before any other content, and
`simulationTruthStatus()` guarantees the badge next to it can never say
anything but `PROPOSED`.

## Approval surface (§11)

`ResponseDetail`'s `WAITING_APPROVAL` case links to **`/actions`**, not
`/approvals`. This is a deliberate correction, not an inconsistency with
Phase 7C precedent: the component audit found `/approvals`'
(`/operating/approvals`) feed does not include Controlled Action proposals
at all — a real proposal-shaped `WAITING_APPROVAL` response would link to a
page that can never show it. `/actions` is `POST /actions/:id/approve`'s own
canonical page. No inline approve control exists on the Jarvis page in
either case.

## Session rules (§13, carried forward from 7D)

The workspace only *reads* `GET /jarvis/session/current` — it introduces no
second session store, no client-side session cache beyond React Query's
normal per-request caching, and never writes session state directly. Every
Phase 7D invariant (ephemeral, bounded, `explicit:`/`device:` prefix
isolation, explicit-always-wins) is unchanged and unre-touched by this
phase; Phase 7E's own dedicated E2E test (`Phase 7E: cross-session
request/session access is denied...`) re-proves the ownership boundary at
the HTTP layer specifically through this new page's own request shape.

## Request trace (§15)

Reconstructed entirely from fields `JarvisResponse` already carries
(`intent`, `projectId`, `citations`, `evidenceRefs`, `simulation`,
`proposal`, `status`) — no new backend concept, no chain-of-thought or
model-reasoning text is ever rendered (`jarvis-workspace-security.test.tsx`
structurally scans for and asserts the absence of reasoning-trace
terminology in every workspace component's source).

## What this phase deliberately did not build

Per the component audit's design conclusion and the directive's explicit
NOT-authorized list: no second cross-domain cockpit (`/operator` already is
one — the workspace links to it), no second conversation/session store, no
new external action type, no autonomous approval/execution path reachable
from this page, no chain-of-thought UI, no durable conversational memory.
