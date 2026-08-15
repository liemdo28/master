# Phase 7E — Operator Workspace Security Boundary

Date: 2026-08-15

Phase 7E adds **one page** (`/command-center/jarvis`) composed entirely of
existing canonical read APIs. It adds **zero new backend routes** — the
boundary this document states and proves is therefore almost entirely a
**frontend** boundary: what this page is structurally incapable of doing,
not a new backend authority surface to contain. Matches the pattern
established by [`PHASE6F_SIMULATION_BOUNDARY.md`](PHASE6F_SIMULATION_BOUNDARY.md),
[`PHASE7B_HEALTH_BOUNDARY.md`](PHASE7B_HEALTH_BOUNDARY.md), and
[`PHASE7C_JARVIS_BOUNDARY.md`](PHASE7C_JARVIS_BOUNDARY.md).

## The rule

> `Operator Workspace -> read/compose existing canonical GET APIs only.`

The workspace never calls a mutation endpoint beyond the one it already had
(`POST /jarvis/request`, unchanged since Phase 7C). Every other network call
this page makes is a `GET`. Every mutation-capable action a user might want
next (approve, start, cancel) is a hyperlink to the canonical page that owns
that mutation — never a button on this page.

## No new authority

- No new external action type; no Gmail SEND; no financial action.
- No inline approve control anywhere on the page — structurally verified
  (`jarvis-workspace-a11y.test.tsx` asserts real `<button>` elements exist
  only for "Ask" and history-turn selection; `jarvis-workspace-security.test.tsx`
  and the E2E suite both scan the rendered page for
  `/^approve/i`/`/^execute/i`/`/^send$/i`/`/^force$/i` button names and
  assert zero matches).
- No approval-by-chat — asking Jarvis a question shaped like an approval
  request (`"approve and execute the pending Gmail send"`) cannot produce a
  `WAITING_APPROVAL`→auto-approved flow; the Gateway's own Phase 7C
  boundary already guarantees `ACTION_PROPOSAL` never calls
  `.propose()`/`.approve()`/`.execute()`, and this page adds no code path
  that could bypass that from the client side even if it tried.
- No new provider dispatch, no shell/process path — `jarvis-workspace-security.test.tsx`
  structurally scans every new component's source (comments stripped, to
  avoid a false-positive on an explanatory doc comment) for shell/process/
  direct-provider-reference strings; zero matches.
- No new backend mutation route — the entire component audit's design
  conclusion (`PHASE7E_COMPONENT_AUDIT.md`) was that no panel required one;
  verified after the fact by the authority manifest staying at
  `mutations=402`, unchanged from 7D.

## The EXECUTED-claim invariant (§ dedicated test suite)

The single highest-severity failure mode this phase could introduce is the
UI claiming something executed when it didn't. `jarvis-workspace-evaluation.test.ts`
locks this down structurally, not just by example:

- `responseTruthStatus()` **cannot** return `EXECUTED` for any input — the
  `JarvisResponseStatus` type has no such value, so this is enforced by the
  type system, not a runtime branch that could be forgotten.
- `planTruthStatus()`/`proposalTruthStatus()` require real, independently-
  fetched execution evidence (`STEP_EXECUTED` event / a `COMPLETED`
  `ActionExecution` record), never a single status-field read. A dedicated,
  explicit regression case proves a plan/proposal whose own `status` field
  alone looks execution-shaped, with no matching evidence record, still
  renders `BLOCKED`/`PROPOSED`/`APPROVAL_REQUIRED` — never `EXECUTED`.
- `simulationTruthStatus()` always returns `PROPOSED`, unconditionally,
  including for the `WOULD_EXECUTE` outcome label specifically (the one
  outcome value most likely to be mis-read as "this happened").
- E2E proves it live: after a full conversation flow including a
  `SIMULATION` request, `page.getByText(/EXECUTED/)` (substring match, not
  an exact match that would trivially pass even if the claim were made) has
  zero matches anywhere on the rendered page.

Target across the 778-scenario evaluation and the E2E run: **false EXECUTED
claims = 0**. Measured: 0.

## Caller/session ownership (carried forward from 7D, re-proven through this page)

The workspace's own `GET /jarvis/session/current` and `GET
/jarvis/request/:id` calls inherit every Phase 7D ownership guarantee
unchanged: `remote_session` callers are isolated by server-derived
`device:<deviceId>`, `api_key` callers only get continuity via an explicit
client-supplied id, and `GET /jarvis/request/:id` enforces `sameCaller()`
ownership (device B gets a 404 for device A's request, same as "not found").
Phase 7E's own E2E test (`Phase 7E: cross-session request/session access is
denied...`) drives this through the real page/browser rather than a raw
HTTP client, using a second caller with a distinct `User-Agent` (which mints
a genuinely different `device_id` via `remote-auth.ts`'s `(ip, user_agent)`
keying) to prove denial end-to-end, not just at the route-handler level.

## Cross-project isolation

`ContextIndicator` never resolves or displays a project the caller didn't
either explicitly request or already have an active session pointing at.
`deriveContextState()` is a pure function evaluated in
`jarvis-workspace-evaluation.test.ts` across the full cross-product of
session/requested/response project combinations (270 of the 778 scenarios);
zero cases produce a project leak into the indicator. Evidence, plan, and
simulation inspectors all key strictly off the selected response's own
`evidenceRefs`/plan id/simulation id — never a project-wide or global query.

## Malicious prior-turn content

Session continuity (Phase 7D) already guarantees stored turn text is inert
data, never re-interpreted as an instruction, server-side. This page adds a
second surface where that same text is rendered: the History panel. Proven
inert here too — `jarvis-workspace-security.test.tsx` renders history turns
containing `<img onerror>`/`<script>`/`<svg onload>` payloads and asserts
zero `<img>`/`<script>`/`<svg>` DOM elements are created, `window.__pwned`
is never set, and `document.title` is never hijacked.

## Evidence redaction

`EvidenceInspector` never touches or reimplements `redactionClassAtMost` —
it renders exactly what `GET /evidence/:id` already decided to return.
(A structural-scan false positive was found and fixed during this phase:
the component's own explanatory doc comment mentions
`redactionClassAtMost` by name to describe *why* it isn't touched; the
security test now strips comments before scanning so this documentation
doesn't itself trip the "never references redaction internals" check.)

## No chain-of-thought UI

No workspace component renders model reasoning, a thinking trace, or
step-by-step justification text — only the structured response fields
(`answer`, `facts`, `citations`, `unknowns`, `conflicts`) Phase 6D/7C's own
truth-semantics contract already defines. Structurally scanned for
reasoning/chain-of-thought terminology; zero matches.

## No secret leakage

No `device_id`, session token, or API key is ever rendered as visible text
— `ContextIndicator` shows only the derived `sessionKind`
(`device`/`explicit`/`none`), never the underlying value. Structurally
scanned for raw `device_id`/token rendering and secret-shaped regex
patterns across every new component; zero matches. (Every response field
still passes through the Phase 7C `scrubReply()` pipeline before it ever
reaches the client, unchanged.)

## No legacy mutation reachability

The Phase 7C permanent `phase7c-legacy-mutation-scan.test.ts` gate
(transitive import-closure + forbidden-call scan) now auto-discovers every
top-level `jarvis-gateway/*.ts` file, so it continues to cover this phase's
work without needing a hand-maintained file list update. Phase 7E adds no
new file under `jarvis-gateway/` — only Command Center components and one
backend fix (below) — so this gate's coverage is unchanged and still
passing (32/32 scenarios, 29 adapters scanned).

## The one backend change this phase made, and why it's not new authority

`automation-simulation/router.ts` privately constructed its own
`AutomationSimulationService` instance, disconnected from the separate
instance `jarvis-gateway/services.ts` constructed for its own `SIMULATION`
handler — both instances' result caches are deliberately in-memory-only
(never a DB table, by Phase 6F design), so a Jarvis-created simulation could
never be found by the real public `GET /simulation/:id` route. This is a
**connectivity bug fix**, not a new capability: it makes an existing,
already-authorized read path (`GET /simulation/:id`, unchanged route,
unchanged auth, unchanged response shape) actually work for a simulation the
Gateway itself created, rather than introducing anything new. Found by the
Simulation Inspector being the first code to ever exercise this path — see
`docs/releases/PHASE7E_ACCEPTANCE.md` for the full root-cause writeup and
the permanent regression test added to `phase7c-jarvis-gateway.test.ts`.

## Stop conditions this document exists to make checkable

- A false `EXECUTED` claim rendered anywhere in the workspace — targeted at
  0, measured at 0 across 778 evaluation scenarios and 3 full E2E runs.
- A cross-project or cross-session data leak into the context indicator,
  evidence inspector, or history panel — targeted at 0, measured at 0.
- An inline approve/execute control appearing on this page — structurally
  scanned for on every relevant test run; 0 found.
- The authority manifest's `mutations` count changing as a result of this
  phase — checked live; stayed at `402`, unchanged from 7D.
