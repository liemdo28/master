# Phase 7E — Acceptance

Date: 2026-08-15

This is the acceptance record for Phase 7E (Operator Workspace). Unlike
7B/7C, this phase has no dedicated N-point `phaseXe:acceptance` script — the
component audit's own design conclusion was zero new backend routes, so
there is no new backend contract shaped like 7B/7C's to enumerate points
against. Acceptance here is the union of the dedicated test suites below,
each independently runnable, plus the full regression chain. All results in
this document are measured, not planned.

## Truth-status invariant tests (`test:jarvis-workspace-evaluation`)

778 scenarios (exceeds the 700+ target genuinely — a shared `scenario()`
counter wrapper, not a hardcoded number, gates the final assertion), all
passing:

```
Test Files  1 passed (1)
     Tests  778 passed (778)
```

Coverage: `factTruthStatus` (3), `responseTruthStatus` (40, full status ×
facts × proposal cross-product — includes the structural proof `EXECUTED`
is unreachable), `planTruthStatus` (54 + 1 explicit regression lock: a
`COMPLETED`-looking status with no matching evidence record must not yield
`EXECUTED`), `proposalTruthStatus` (60 + 1 explicit regression lock: a
non-null `executedAt` with no matching `COMPLETED` execution record must
not yield `EXECUTED`), `simulationTruthStatus` (7, including the
`WOULD_EXECUTE` outcome specifically), `deriveContextState` (270, full
session/requested/response cross-product), `sessionKind` (6, including a
forged-prefix case), `parseEvidenceRef` (200+ across canonical-prefix and
evidence-record id variants and edge cases), plus a joint-consistency block
cross-checking `responseTruthStatus` against `deriveContextState` for the
same synthetic response.

**False EXECUTED claims across all 778 scenarios: 0.**

## Dedicated security suite (`test:jarvis-workspace-security`)

12 scenarios, all passing:

```
Test Files  1 passed (1)
     Tests  12 passed (12)
```

Structural scans (no `api.post` beyond `/jarvis/request`, no `api.patch`/
`api.del`, no chain-of-thought/reasoning-trace terms, no hardcoded
secret-shaped regex matches, no approval-by-free-text-match pattern, no
shell/process/direct-provider references, no raw `device_id`/token
rendering, no `redactionClassAtMost` reference outside explanatory
comments) plus live-rendering proofs (`<img onerror>`/`<script>`/`<svg
onload>` payloads in answer/facts/citations/history-turn-text render as
inert text; zero `<img>`/`<script>`/`<svg>` DOM elements created;
`window.__pwned` never set; `document.title` never hijacked) plus
cross-response isolation (switching exchanges never leaves a stale answer
visible).

## Accessibility pass (`test:jarvis-workspace-a11y`)

10 scenarios, all passing:

```
Test Files  1 passed (1)
     Tests  10 passed (10)
```

Accessible labels on the ask textarea/project select; landmark
`aria-label`s present (`Conversation history`, `Current interaction`,
`Inspector`) with **zero nested `<main>`** elements (the page's one `<main>`
comes from `Layout.tsx`; `JarvisPage.tsx`'s own regions are labelled
`<section>`/`<aside>`); `role="tablist"`/`"tab"` with `aria-selected` on the
Inspector; status badges always carry visible text (never color-only);
loading uses `role="status"`/`aria-live`; errors use `role="alert"`; Enter
submits the same single safe action exactly once, Shift+Enter never
submits; Ask is a real `<button type="submit">`; history entries are real
`<button>` elements.

## Command Center regression (`test:command-center` / `-security`)

Both unchanged suites still fully green after the rewrite:

```
test:command-center            21/21 passed
test:command-center-security   21/21 passed
```

## E2E (`test:command-center-e2e`), run against the real compiled server

Run three times across this phase (twice as the directive's explicit item-5
requirement during development, once more as part of the full regression
sweep in item 7) — **6/6 passing every time**:

```
ok 1  login, brief, plan, approvals, goal, project, knowledge, citation,
      calendar, inbox, health, EOD review, refresh, persistence
ok 2  no external writes: reload after approve leaves the task WAITING_APPROVAL
ok 3  Phase 5H: visiting Plans never advances/auto-executes the fixture plan
ok 4  Phase 5I: Delegations renders bounded authority without hidden execution
ok 5  Phase 6F: Simulation runs against the real simulator, zero mutation
ok 6  Phase 7E: cross-session request/session access is denied, zero mutation

  6 passed (27.1s)
```

Test 6 is new this phase: logs in as two distinct callers (a second,
genuinely different `device_id` minted via a distinct `User-Agent` header),
confirms cross-caller 404 on both `GET /jarvis/session/current` and
`GET /jarvis/request/:id`, confirms unauthenticated access is 401, and
snapshots `/actions`, `/orchestration/plans`, `/governance/status`,
`/task-runtime/tasks`, and the authority manifest counts before and after
the entire workspace flow — byte-identical.

### A real, previously-undiscovered bug found by this E2E run

The Simulation Inspector (built this phase) was the first code ever to
fetch a Jarvis-created simulation back through the real, public
`GET /simulation/:id` route. Running the real E2E suite against the real
compiled server (not a mock) exposed a genuine Phase 7C bug:
`jarvis-gateway/services.ts` constructed its own, separate
`new AutomationSimulationService()` instead of reusing the instance
`automation-simulation/router.ts` already owned — since that service's
result cache is deliberately in-memory-only (never a DB table, by Phase 6F
design), two separate instances could never see each other's simulation
runs. A Jarvis-created `simulationId` 404'd against the real route with
`"simulation run not found (ephemeral results are not persisted across
restarts)"`.

**Fixed**: `automation-simulation/router.ts` now exports its `service`
instance and its `cacheResult`/`getCachedResult` functions;
`jarvis-gateway/services.ts` reuses the exported instance instead of
constructing a second one; `jarvis-gateway/handlers/simulation.ts` now
explicitly calls `cacheSimulationResultForPublicRoute(run)` after
`simulation.run()`, since `service.run()` itself never writes to the
cache — only the router's own `POST /simulation/run` handler did, before
this fix. A permanent regression test was added to
`phase7c-jarvis-gateway.test.ts` (now 15/15, was 14/14) proving a
Jarvis-created simulation is retrievable via the exact same
`getCachedResult()` lookup `GET /simulation/:id` uses.

This is the same class of bug this program's "run the real thing, don't
trust mocks" precedent exists to catch (paralleling Phase 7B's aggregation
bugs and Phase 7C's own coding-mutation bug, both found the same way).

### Other real E2E issues found and fixed during this phase (tooling/assertions, not product bugs)

- Playwright's `getByLabel` only matches form controls, not an arbitrary
  `aria-label`'d landmark — switched to `getByRole('region', {name: ...})`
  for the `<section aria-label="Current interaction">` check.
- Two strict-mode ambiguities once real session history existed: a
  History-panel button whose text contained "tasks" (substring "ask")
  matched the non-exact `Ask` button locator — fixed with `exact: true`;
  duplicate task-text matches between the answer and a fact bullet — fixed
  with `.first()`.
- `TruthStatusBadge` renders `"◆ PROPOSED"`/`"✓ EXECUTED"` as one text
  node — an exact-match assertion on the bare word could never succeed
  (false negative) or would trivially always report zero matches even if
  the claim were wrongly made (meaningless check). Fixed to substring/regex
  matches throughout.
- A fixture question containing "deployment" collided with the forbidden-
  button `/deploy/i` regex once the History panel rendered that turn's own
  text inside a `<button>`. Fixed by rewording the fixture question.

## Performance (`node e2e/phase7e-performance.cjs`, measured, not planned)

See `PHASE7E_RUNBOOK.md`'s Performance section for the full table.
Summary: initial workspace load p50=84ms/p95=104ms (n=5); simple
conversation round trip (no external provider) p50=72ms/p95=76ms (n=8);
Evidence Inspector render p50=32ms/p95=34ms (n=6); Simulation Inspector
render p50=126ms/p95=129ms (n=6); INFORMATION-intent round trip
(external-provider-bound, reported separately per the directive's explicit
instruction not to hide that latency) p50=77ms/p95=77ms (n=5).

## Full regression

- `server/`: clean `npx tsc --noEmit`, clean `npx tsc -p .`, clean
  `npm run test:ci` (30+ suites). All prior phase acceptance chains re-run
  end-to-end and clean: 5A, 5B, 5C, 5D2, 5D3, 5F, 5G, 5H, 5I, 6A, 6B, 6C,
  6D, 6E, 6F, 7A, 7B, 7C. `test:jarvis-gateway` 15/15 (+1 new regression
  lock this phase), `test:jarvis-gateway-security` 4/4 + 32/32 (29 adapters
  scanned) + 23/23, `jarvis-gateway:evaluation` PASS, `test:jarvis-session`
  41/41, `test:jarvis-session-security` 19/19 + 36/36.
  `test:tracked-credential-scan` PASS, `test:external-content-security`
  PASS.
- `command-center/`: clean `tsc -b && vite build`, `oxlint` clean (4
  pre-existing warnings, unrelated to Phase 7E); `test:command-center`
  21/21; `test:command-center-security` 21/21;
  `test:jarvis-workspace-evaluation` 778/778;
  `test:jarvis-workspace-security` 12/12; `test:jarvis-workspace-a11y`
  10/10; E2E 6/6 (three full runs this phase, see above).
- **One real failure found and fixed during this sweep** (not a 7E
  regression, a stale assertion): `phase7c:acceptance` point 14 hardcoded
  `Link to="/approvals"`. Phase 7E deliberately changed
  `JarvisPage.tsx` to link to `/actions` instead (the component audit found
  `/approvals` doesn't include Controlled Action proposals at all — see
  `PHASE7E_OPERATOR_WORKSPACE.md`'s Approval surface section). The check
  hardcoded UI structure, not the actual security semantic — amended to
  accept either canonical target and to explicitly assert the absence of
  an inline Approve button, which the previous version never actually
  verified. Documented inline in `phase7c-acceptance.ts` and in
  `PHASE7E_RUNBOOK.md`.
- **One expected, pre-existing, environment-only non-pass**:
  `agentic-coding:acceptance` fails with `MODEL_UNAVAILABLE` because Ollama
  is not running in this dev checkout — matches the standing `DEGRADED`
  health baseline confirmed at the start of this phase's reality audit.
  Unrelated to any Phase 7E change: the Jarvis Gateway's `CODING` handler
  has never called this workflow, since Phase 7C's own independent review
  fixed that (see `PHASE7C_ACCEPTANCE.md`).

## Authority manifest impact

Before Phase 7E (post-7D): `mutations=402`, `unknownMutations=0`,
`unresolvedLegacyMutations=0`.
After Phase 7E: `total=1096`, **`mutations=402` — unchanged** — net total
growth vs. 7C's `1092` is entirely read-only surface accumulated since
Phase 7D (the `GET /jarvis/session/current` route and its dual mount), not
anything new from this phase. `unknownMutations=0`,
`unresolvedLegacyMutations=0`, `forbidden=0`. Zero unaccounted-for mutation
surface introduced — matches this phase's own design conclusion exactly.

## Schema

`personal-os.db` stays at v10. Phase 7E opens no new database and adds no
migration.

## Hygiene scans

No hardcoded secret-shaped strings in any new Phase 7E file. No TODO/FIXME/
XXX markers. `test:tracked-credential-scan` and `test:external-content-security`
both clean.

## Independent review

*To be completed before merge — see task tracking. This section will record
the review's findings and their resolution once run.*

## Production acceptance (post-deploy)

*To be completed after merge/deploy — primarily READ/PLAN/SIMULATE
verification through the live workspace, no live Gmail draft/Calendar
event/Gmail SEND, session/context continuity re-proven against the real
`mi-core` project.*
