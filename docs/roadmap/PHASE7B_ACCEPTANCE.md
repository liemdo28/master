# Phase 7B — Acceptance

Date: 2026-08-13

This is the acceptance record for Phase 7B (Health / Dependency Truth Model),
following the same format as
[`PHASE6F_ACCEPTANCE.md`](PHASE6F_ACCEPTANCE.md)/`phase7a-acceptance.ts`: 20
numbered points, each independently checked by `npm run phase7b:acceptance`
(`server/src/health-truth/phase7b-acceptance.ts`), not asserted by prose.

## 20 acceptance points (all passing)

1. `DependencyState` has exactly the 7 required states, never boolean.
2. All 13 core health dimensions declared.
3. Aggregation keys off structured state/criticality fields, not free-text
   matching.
4. 4-value criticality classification present and used in aggregation.
5. AUTHORITY unknown/unresolved mutation forces `BLOCKED`, never averaged
   away — verified both structurally and against the live authority
   manifest (`unknownMutations=0`, `unresolvedLegacyMutations=0`).
6. Provenance mismatch folds into AUTHORITY as `UNAVAILABLE` with an
   explicit, non-empty capability impact, never a silent warning — verified
   live against this checkout's actual (unset `.env`) provenance state.
7. `DATABASE` probe reads cached SelfHeal scan, never opens a DB connection
   or runs a fresh integrity check per request.
8. `KNOWLEDGE` distinguishes `INDEX_EMPTY` (valid empty state) from
   `INDEX_UNAVAILABLE` (failure).
9. Health-truth probes are observational only — no restart/stop/kill call
   anywhere.
10. Configuration health never interpolates a secret value into a detail
    string.
11. `DependencyHealth` carries `lastHealthyAt`/`lastFailureAt`, `null`
    (UNKNOWN) permitted, never fabricated.
12. `ReasonCode` is a closed enum and `computeOverall` keys off it, not a
    free-text field.
13. Capability impact present for every non-healthy, non-disabled *live*
    dependency (checked against a real `getSystemHealth()` call, not a
    synthetic fixture).
14. SelfHeal `evidence-db`/`knowledge-db` probes converted to
    `type: 'internal'` (no more HTTP round-trip through the rate limiter).
15. Health-truth only imports SelfHeal's read-only exports, never
    restart/start functions.
16. `GET /api/health`, `GET /api/health/detail`, `GET /api/health/dependencies`
    all correctly mounted.
17. Detailed health requires auth, liveness does not.
18. Command Center Health page has zero mutation controls.
19. Schema stays v10 — health-truth reuses existing stores, opens no new
    database.
20. Evaluation harness thresholds met (see below).

Full output: `npm run phase7b:acceptance` → `"allPass": true`.

## Evaluation (`npm run health-truth:evaluation`)

802 total scenarios across three families:

- **Family A** — exhaustive single-perturbation sweep: every
  `(DependencyId × DependencyState × Criticality)` combination (364
  combinations), each dependency perturbed against an otherwise-all-healthy
  baseline, expected outcome derived independently from the written rule
  spec (not by re-calling the function under test).
- **Family B** — 30 curated two-dependency-failure priority-ordering pairs
  (AUTHORITY-vs-REQUIRED_FOR_CORE, REQUIRED_FOR_CORE-vs-OPTIONAL_DEGRADED,
  etc.), each run at 3 different concrete state pairings.
- **Family C** — the 14 named scenarios from the governing directive (all
  healthy, Ollama down, Python AI down, Google disconnected, node-agent
  blocked, WhatsApp disabled, n8n disabled, DB unavailable, knowledge
  unavailable, authority mismatch, provenance mismatch, partial degradation,
  plus port-collision/orphan-process — intentionally not a new
  health-truth dimension, reused from Phase 7A's runtime-preflight
  validator and exercised here to prove that coverage still exists).

Results:

```
totalScenarios: 802
determinismChecks: 394, determinismFailures: 0
falseHealthy: 0
falseDown: 0
stateClassificationCorrectness: 1
namedScenarioCorrectness: 1
authorityCriticalityCorrectness: 1
capabilityImpactCorrectness: 1
portCollisionOrphanProcessCoverageReused: true
```

Two real bugs in `aggregate.ts` were caught and fixed during this evaluation
(not left as known issues) — see
[`PHASE7B_HEALTH_TRUTH_MODEL.md`](../architecture/PHASE7B_HEALTH_TRUTH_MODEL.md#bugs-the-evaluation-harness-caught-and-fixed)
for the specifics. Both are now regression-locked in
`phase7b-health-truth-model.test.ts`, and the metrics above are from the
**post-fix** run.

## SelfHeal rate-limit regression (`npm run test:selfheal-rate-limit-regression`)

3/3 scenarios: both probes are structurally `type: 'internal'` with no
`health_url`; neither ever calls `fetch()` (proven by making `fetch` throw
and confirming it's never invoked); 150 back-to-back calls (exceeding the
120-req/60s global limiter's window) all resolve deterministically, proving
no rate-limiter interaction is possible.

## Security (`npm run test:health-truth-security`)

16 scenarios: no client-controllable input reaches the computed state; both
routers structurally free of `req.query`/`req.body`/`req.params` reads and
of mutation-capable imports; index.ts mount wiring matches the required auth
middleware exactly; live 401 on unauthenticated and wrong-key requests to
both detailed routes; live confirmation that query-string injection has zero
effect on the response; live scan of the full detailed-health response body
for the actual values of `MI_CORE_API_KEY`/`AGENT_CODING_API_KEY`/
`GOOGLE_CLIENT_SECRET`/`JWT_SECRET`/`SESSION_SECRET`, for local absolute
paths, and for known secret-token shapes — zero matches; intentionally-
disabled and disconnected-connector misclassification proofs.

## Model (`npm run test:health-truth-model`)

43 scenarios covering aggregation priority ordering, the exhaustive
`stateBlocksOverall()` table (28 state×criticality combinations), fixture-
based `probeIntentionallyDisabled()` behavior, `probeCore()` determinism, and
the two evaluation-caught bug regressions.

## Full regression

- `npm run build` (server): clean.
- `npm run test:ci` (server, 30+ suites): clean on the second run — the
  first run surfaced one real, expected regression
  (`test:selfheal-probe`, a pre-existing Phase 6-era test that directly read
  `knowledge-db`'s HTTP-specific `validateBody`/`health_url`/`authenticated`
  fields, which no longer exist now that it's `type: 'internal'`); fixed by
  updating that test to assert the new internal-check shape and by exporting
  `personalOsIntegrityIsHealthy` so its body-validation logic (corrupt
  integrity report, FK violations) is tested directly rather than via a
  now-nonexistent HTTP round-trip. Re-run: clean.
- Phase 5A, 5B, 5C, 5D2, 5D3, 5F, 5G, 5H, 5I, 6A, 6B, 6C, 6D, 6E, 6F, 7A
  acceptance chains: all re-run end-to-end, all clean (`allPass: true` /
  `PASS` on every one).
- Command Center: `tsc -b && vite build` clean; `test:command-center` 18/18
  (one pre-existing test rewritten to match the new Health page — old
  fixture/assertions referenced retired endpoints); `test:command-center-security`
  20/20; `test:command-center-e2e` 5/5 Playwright scenarios against a real
  server (one selector fixed for Playwright's case-insensitive substring
  `getByText` matching against the new page's own criticality text).

## Authority manifest impact

Before Phase 7B (post-7A): 1079 surfaces, 400 mutations, `unknownMutations=0`,
`unresolvedLegacyMutations=0`.
After Phase 7B: 1086 surfaces (net +7 read-only health routes across both
mount points, minus the deleted `routes/health.ts`'s own entry), **mutations
unchanged at 400**, `unknownMutations=0`, `unresolvedLegacyMutations=0`,
`forbidden=0`. Zero new mutation surface introduced. A duplicate-attribution
scanner artifact (`/api/health/health/detail`,
`/api/health/health/dependencies` — caused by both new routers initially
living in one file, which the scanner attributes at file granularity) was
found and fixed by splitting into `public-router.ts`/`detail-router.ts`,
matching this codebase's one-router-per-file convention — confirmed absent
from the final manifest.

## Hygiene scans

No conflict markers, no secret-shaped strings, no forbidden action-type
references (`GMAIL_SEND`/`GMAIL_REPLY`/`FINANCIAL_TRANSFER`/`SHELL_EXEC`/
etc.), no local absolute-path leakage, in every new/changed Phase 7B file. No
stray database or test-artifact files introduced into git tracking. Final
`git status` for this phase's diff: 10 modified files, 1 deleted
(`server/src/routes/health.ts`), 3 new top-level additions
(`docs/architecture/PHASE7B_HEALTH_AUDIT.md`,
`server/src/company-os/__tests__/selfheal-rate-limit-regression.test.ts`,
`server/src/health-truth/`).

## Production acceptance (post-deploy)

To be completed after merge/deploy — expected states: `CORE=HEALTHY`,
`PYTHON_AI` per actual reachability, `LOCAL_MODEL=UNAVAILABLE` (Ollama not
running in production per the standing safety boundary),
`GOOGLE_CONNECTORS=DISCONNECTED` (OAuth intentionally not reconnected, per
Phase 6G), `NODE_AGENT=BLOCKED` (known registration gap),
`WHATSAPP`/`N8N`/`CEO_OBSERVER=INTENTIONALLY_DISABLED`. Per the governing
directive: **report actual reality, do not force results to match this
expectation** — any divergence from the above must be investigated and
reported honestly, not silently reconciled.
