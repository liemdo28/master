# Phase 7C — Acceptance

Date: 2026-08-14

This is the acceptance record for Phase 7C (Canonical Jarvis Gateway),
following the same format as
[`PHASE7B_ACCEPTANCE.md`](PHASE7B_ACCEPTANCE.md)/`phase7b-acceptance.ts`: 20
numbered points, each independently checked by `npm run phase7c:acceptance`
(`server/src/jarvis-gateway/phase7c-acceptance.ts`), not asserted by prose.

## 20 acceptance points (all passing)

1. Canonical `JarvisGateway` initialized — `handleGatewayRequest()` exists
   and dispatches by classified type.
2. Exactly one canonical request-creation entrypoint (`POST /jarvis/request`)
   plus its `GET` retrieval companion — no generic `/execute`.
3. Dual-mount auth: `requireRemoteAuth` at `/api/command-center`,
   `requireTaskRuntimeAuth` at bare `/api`.
4. Explicit 3-state project resolution (`RESOLVED`/`AMBIGUOUS`/`UNKNOWN`),
   never a fuzzy/best-guess fallback.
5. `KNOWLEDGE_SEARCH` calls `KnowledgeRetrievalService.buildKnowledgePack()`
   exclusively.
6. Response contract carries structured citations
   (`documentId`/`chunkId`/`sourceUri`/`title`/line refs), never a free-text
   citation string.
7. Facts/inferences distinguished by `kind`
   (`FACT`/`INFERENCE`/`ASSUMPTION`); `unknowns`/`conflicts` are separate
   arrays (Phase 6D truth semantics).
8. Read-shaped requests (`TASK_QUERY` et al.) use a direct read path — no
   plan/action machinery.
9. `PLANNING` reuses `GovernedOrchestrationService` — never a second
   planner.
10. `SIMULATION` calls `AutomationSimulationService.run()` only — never
    `ControlledActionService`.
11. `ACTION_PROPOSAL` never calls `.propose()`/`.approve()`/`.execute()` —
    always `NEEDS_CLARIFICATION` for exact fields.
12. No direct execution call anywhere in the Gateway — structural scan
    across `gateway.ts`, `router.ts`, and all handlers for `cooExecute(`,
    `handleCeoSignal(`, `processGStackRequest(`, `createApproval(`,
    `.execute(`.
13. Governance decisions flow through canonical services only — same scan
    as point 12, plus a direct check that `gateway.ts` never imports
    `approval-engine`/`production-governor`.
14. `WAITING_APPROVAL` responses point to the canonical Approvals UI
    (`Link to="/approvals"`), never an inline approve control.
15. `CODING` calls the canonical `CodingWorkflow.planTask()` — never a
    duplicate coding agent.
16. `SYSTEM_STATUS` uses the Phase 7B canonical health-truth model
    exclusively — never the legacy jarvis health-center duplicate.
17. Legacy entrypoint containment proven by a permanent structural
    regression test (`phase7c-legacy-mutation-scan.test.ts`), not just this
    acceptance run.
18. Live authority manifest clean: `unknownMutations=0`,
    `unresolvedLegacyMutations=0`.
19. ≥500-scenario deterministic evaluation passes (routing/citation/
    leakage/synthesis/authority/determinism thresholds) — precondition of
    this acceptance chain (`npm run jarvis-gateway:evaluation` must pass
    first).
20. Determinism proven at scale — every fixture run twice,
    `determinismFailures=0` required by the evaluation's own exit
    condition.

Full output: `npm run phase7c:acceptance` → `"allPass": true`.

## Evaluation (`npm run jarvis-gateway:evaluation`)

530 fixtures across 20 named categories, each run twice (1060 total
scenario-checks): 15 pure-DB categories at `N=34` reps
(`project_lookup`, `task_lookup`, `goal_lookup`, `knowledge_citation`,
`stale_knowledge`, `conflict`, `no_answer`, `ambiguous_project`, `planning`,
`simulation`, `action_proposal`, `approval_required`, `blocked_action`,
`coding_request`, `cross_project_distractor`) plus 5 network/health-probe-
touching categories at `N_SLOW=4` reps (`direct_factual`, `prompt_injection`
— both call `askAi()`; `health_degraded`, `google_disconnected`,
`ollama_unavailable` — all three call `getSystemHealth()`'s real network
probes), plus one real-ingested knowledge document for citation-correctness
proof.

Results:

```
totalScenarios: 1060
networkTimeouts: 0
fixtureCount: 530
categories: 20
determinismChecks: 530, determinismFailures: 0
routingCorrectness: 0.9924528301886792
citationCorrectness: 1
citationChecks: 34
crossProjectLeakage: 0
unsupportedFactualSynthesis: 0
authorityBypass: 0
externalSideEffects: 0
```

All thresholds met: routing correctness ≥99% (target), citation correctness
100%, cross-project leakage 0, unsupported factual synthesis 0, authority
bypass 0, external side effects 0, determinism 100%.

### Bugs the evaluation harness caught (and fixed)

Three real, independently-verified bugs were found by actually running the
evaluation against real services, not by trusting a passing typecheck:

1. **`KnowledgeQuery` field-name/scoping mismatch.**
   `handleKnowledgeSearch` originally called `buildKnowledgePack({query:
   text, projectIds})`; the real validator reads `text`, not `query`, and
   requires `projectIds.length >= 1`. Fixed by correcting the field name and
   adding `KNOWLEDGE_SEARCH` to `PROJECT_REQUIRED_TYPES`.
2. **Classifier's overly-broad `status`/`health` keywords.** The original
   `SYSTEM_STATUS` rule matched bare `status`/`health`, misrouting
   `project_lookup` fixtures ("what is the status of project X") into
   `SYSTEM_STATUS`. Fixed by scoping the rule to genuinely system-shaped
   phrasing — see `PHASE7C_CANONICAL_JARVIS_GATEWAY.md`.
3. **`ambiguous_project` fixture category/type mismatch.** Originally
   classified as `PROJECT_QUERY`, which isn't in `PROJECT_REQUIRED_TYPES`,
   so `resolveProject()` was never called and the `AMBIGUOUS` code path was
   never actually exercised — a silent coverage gap, not a runtime bug.
   Fixed by changing the fixture to `KNOWLEDGE_SEARCH`-shaped text
   mentioning both project names.

A fourth apparent problem — the evaluation appearing to hang for
30-45 minutes across several attempts — turned out to be two combined,
non-bug causes: (a) `getSystemHealth()`'s own real network probes each
taking 2.6-4.3s in this sandboxed dev environment, multiplied across the
original fixture counts; fixed by moving the three health-probing
categories into the same small-`N`, slow tier as the two `askAi()`
categories; (b) piping a long-running background process's output through
`tail`/`head` fully buffers it until the process exits, making an
actively-progressing run look falsely stuck — fixed by redirecting to a
real file and `cat`-ing it directly.

### The determinism-comparison bugs (in the evaluation script, not the Gateway)

Two normalization gaps in the evaluation's own `normalize()` comparison
function produced false determinism failures, tracked down and fixed rather
than the threshold being loosened:

1. `AutomationSimulationService.run()` mints a fresh, unique
   `simulationId` (and internal timestamps) on every call by design — the
   34 `simulation`-category fixtures always differed between the two runs
   on this field alone (35 of 35 initial failures). Fixed by stripping any
   UUID-shaped substring before comparison.
2. One remaining failure traced to `provider-router.ts`'s
   `` `${operation} failed across providers: ${lastError}` `` embedding the
   raw upstream network/circuit-breaker error text — on run A the network
   call itself failed, by run B (a few hundred ms later) the Ollama circuit
   breaker had already tripped OPEN, producing a different error string.
   Every governance-relevant field (`status`, `intent`, `answer`, `facts`,
   `citations`) was byte-identical between the two calls; only this
   diagnostic upstream-error string varied. Fixed by excluding that
   specific substring from the comparison, the same way `simulationId` is
   excluded.

Both fixes are documented inline in `phase7c-evaluation.ts`'s `normalize()`
function with the reasoning for why each exclusion is legitimate rather than
a loosened check.

## Security (`npm run test:jarvis-gateway-security`)

Three-file chain, 51 scenarios total:

- `phase7c-legacy-containment.test.ts` — 4/4: structural + functional proof
  that `executive-personality.ts`/`jarvis-core.ts` never load the quarantined
  gstack/coo-v4 modules, even when fed GStack-triggering WhatsApp text.
- `phase7c-legacy-mutation-scan.test.ts` — 24/24 (21 adapters scanned): the
  permanent transitive-import-closure + forbidden-call structural gate — see
  [`PHASE7C_JARVIS_BOUNDARY.md`](../security/PHASE7C_JARVIS_BOUNDARY.md).
- `phase7c-jarvis-gateway-api-security.test.ts` — 23/23: auth
  bypass/wrong-key rejection, malformed JSON, missing/oversized text,
  nonexistent project handled honestly, cross-project leakage proof
  (Project A task text never appears in a Project B response),
  prompt-injection zero-effect proof, field-smuggling ignored
  (provider/url/command extra JSON fields), invalid `requestType` rejected,
  secret/path/token-shape leakage scan, `GET /request/:id` auth+404+
  round-trip.

## Core (`npm run test:jarvis-gateway`)

13/13 scenarios against real isolated-tmpdir canonical services: every
request type's happy path (including honest-empty and honest-no-answer
cases), an ambiguous-project clarification case, and a determinism check.

## Command Center (`npm run test:command-center` / `-security` / `-e2e`)

21/21 unit (3 new: initial-state render with no dangerous buttons,
structured-response render with facts/citations, `WAITING_APPROVAL` links to
`/approvals`), 21/21 security (1 new: a prompt-injection-shaped answer
renders as inert text, zero `<img>` elements, zero mutation buttons). E2E
suite extended with a new Jarvis flow step (health question → project
select → task question → knowledge question → confirm zero
execution/mutation buttons) — verified live in-browser against the real
fixture server as well as via Playwright.

## Independent review

*To be completed before merge — see task #71.*

## Full regression

- `server/`: clean `npm run build`, clean `npx tsc --noEmit`, clean
  `npm run test:ci` (30+ suites), and all 13 prior phase acceptance chains
  (5A, 5B, 5C, 5D2, 5D3, 5F, 5G, 5H, 5I, 6A, 6B, 6C, 6D, 6E, 6F, 7A, 7B)
  re-run end-to-end, all clean.
- `command-center/`: clean `tsc -b && vite build`; `oxlint` clean (3
  pre-existing warnings unrelated to Phase 7C's changes); `test:command-center`
  21/21; `test:command-center-security` 21/21.

## Authority manifest impact

Before Phase 7C (post-7B): 1086 surfaces, 400 mutations,
`unknownMutations=0`, `unresolvedLegacyMutations=0`.
After Phase 7C: 1092 surfaces (net +6 — 2 new routes (`POST`/`GET`) across
both mount points, minus the wildcard-classification correction),
**mutations 402** (exactly the 2 new `POST` routes across both mount
points), `unknownMutations=0`, `unresolvedLegacyMutations=0`, `forbidden=0`.
Zero unaccounted-for mutation surface introduced.

## Schema

`personal-os.db` stays at v10 — Phase 7C opens no new database and adds no
migration. `request-store.ts` is a bounded in-process `Map`, not a
persistent store.

## Hygiene scans

No hardcoded secret-shaped strings in any new Phase 7C file (one test-only
fixture API key, `phase7c-gateway-security-test-key`, matching the naming
convention of every prior phase's test-only credentials). No TODO/FIXME/XXX
markers. No stray `console.log` outside the acceptance script's own intended
output (matching `phase7b-acceptance.ts`'s precedent).

## Production acceptance (post-deploy)

*To be completed after merge/deploy — primarily READ/PLAN/SIMULATE
verification, no live Gmail draft/Calendar event/Gmail SEND. See task #72.*
