# Phase 6F — Simulation Boundary

Date: 2026-08-13

Phase 6F's entire security surface reduces to one invariant: **a simulation run can
never produce a real external side effect, and can never mutate any store other
than its own per-run, disposable one.** This document states how that is enforced,
and how it is proven — not just documented.

## The hard boundary is structural, not an env flag (§33)

Directive §33 explicitly warns against relying on `SIMULATION=true`-style env
flags — "a casual env mistake must not turn a fake provider into a real one." This
codebase enforces the boundary structurally instead:

1. **No reference path exists.** `AutomationSimulationService` never imports
   `googleapis`, `../../visibility/connectors/google/*`, or any real provider
   writer. The only two functions in the entire repository that ever dispatch to a
   real Google API (`runSandboxGmailDraft()` / `runSandboxCalendarCreate()`, both
   private methods on `ControlledActionService` in `actions/service.ts`) are never
   called from anywhere in `automation-simulation/`.
2. **A capability token, not a boolean.** `fake-providers.ts` mints a
   `SimulationCapabilityToken` (`{ readonly __simulationOnly: true }`) that only its
   own module can construct, and `runFakeProvider()` requires one as its first
   argument. This is a type-level proof: nothing outside `fake-providers.ts` can
   satisfy that parameter, so there is no code path — accidental or otherwise —
   that reaches the fake provider without having gone through the one module that
   is itself proven to import nothing real.
3. **Read-only governance access.** `AutomationSimulationService` imports
   `ControlledActionService` for exactly one reason: to get a correctly-bootstrapped
   `.policyEngine` (real policy/risk/kill-switch/budget evaluators) against a
   disposable store. It never calls `.propose()`, `.approve()`, `.execute()`,
   `.reject()`, or `.cancel()` — enforced by an automated source-text scan (below),
   not just a code review promise.

## Automated proof (`automation-simulation-security.test.ts`)

Three groups, all currently passing:

1. **Import-graph scan.** Reads the actual source of `fake-providers.ts`,
   `types.ts`, `router.ts`, `service.ts`, strips comments (so a file's own
   documentation of what it must *not* import can never false-positive the check),
   extracts every real `import`/`require` specifier, and asserts none of them
   reference `googleapis`, `google-auth`, or `child_process`. Separately confirms
   `service.ts`'s compiled code (post comment-strip) never contains a call to
   `.propose(`, `.approve(`, `.execute(`, `.reject(`, or `.cancel(`.
2. **Store-isolation proof.** An independent, real `ControlledActionService`
   fixture stands in for "production." Its four governance tables
   (`action_proposals`, `action_executions`, `action_budgets`, `kill_switches`) are
   snapshotted, 20 varied simulation runs execute (covering every provider
   scenario, kill-switch/budget/delegation what-ifs, forbidden candidates), and the
   snapshot is re-taken and asserted byte-identical. The simulator has no
   reference to this fixture at all — it is architecturally impossible for it to
   reach it — and this proves that empirically, not just by inspection.
3. **API-level security.** Unauthenticated requests → 401. More than 100 steps or
   an empty `steps` array → 400. A payload with extra unknown fields shaped like a
   code-injection attempt (`module`, `providerModule`, `shellCommand`,
   `providerClass`, `url`) is still simulated normally (200) with every unknown
   field silently dropped — never echoed back into the response. A payload
   containing `__proto__`/`constructor` keys anywhere in the tree is **rejected
   outright** (400) by `assertPlainPayload()`, not silently sanitized — the
   stronger of the two defensible behaviors. A malformed simulation id is
   rejected before any cache lookup. Two runs with different `projectId`s never
   cross-contaminate when fetched back by id.

## Provider dispatch count, across the full evaluation

`simulation-evaluation.ts` (513 deterministic scenarios, run twice each for
determinism) additionally asserts, for every scenario: every simulated object id
carries the `sim-` prefix (never shaped like a real provider id), no scenario ever
lets a `BLOCK_*`/`DENY` policy decision resolve to `WOULD_EXECUTE` (policy bypass),
no scenario with an active kill-switch override resolves to anything but
`WOULD_BLOCK` (kill-switch bypass), and no step ever reports an authority surface
other than the one real, manifest-verified execute surface (authority bypass). All
four counts: 0/513.

## API surface (§31/§32)

`POST /simulation/run`, `GET /simulation/:id`, `POST /simulation/compare` — mounted
identically to every other Controlled-Action-adjacent route
(`rateLimiter, applyIpGuard`, then `requireRemoteAuth` under `/api/command-center`
or `requireTaskRuntimeAuth` under bare `/api`). `simulationJsonParser` bounds the
request body to 256kb. `parseSimulationInput()` does strict allowlist-only parsing:
`actionType`/`type`/`kind`/`providerScenario` are each checked against a fixed
`Set` of known-good string values before being trusted — there is no field
anywhere in the input shape that names a module, class, function, shell command,
or URL, so a hostile body can shape a bad *simulation input*, but it can never make
the simulator load or call anything beyond what is already coded here.

## What did NOT change

No new schema (v10 unchanged). No new external action type. No change to Phase
5F/5G/5H/5I execution/approval/budget/delegation semantics. No change to Phase
6A/6B/6C/6D/6E. Gmail SEND remains absent. Financial actions remain absent.
`unknownMutations`/`unresolvedLegacyMutations` remain 0 (verified via the same
authority manifest this simulator itself reads).
