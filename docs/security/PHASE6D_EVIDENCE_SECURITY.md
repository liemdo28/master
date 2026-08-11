# Phase 6D Evidence Security

**Facts must not be represented as inference. Inferences must not be represented as
facts. Unknown must not become false certainty. No evidence API/UI may leak tokens,
API keys, refresh tokens, client secrets, or private raw credential payloads.**

## No New Database, No New Attack Surface

The canonical evidence contract (`server/src/evidence/`) never writes anywhere. It is a
deterministic read-through/normalization layer over the six evidence-log tables
identified in `docs/architecture/PHASE6D_EVIDENCE_AUDIT.md` — `action_evidence`,
`policy_decisions`/`governance_events`/`governance_anomalies`, `action_plan_evidence`,
`delegation_decisions`/`delegation_events`, `knowledge_documents`/`knowledge_conflicts`,
and `task_events`. `EvidenceService` has zero mutation methods — verified structurally
in `__tests__/security.test.ts` by asserting no method name matches
`/^(create|update|delete|resolve|dismiss|approve|revoke|mutate|write|save)/i`.

## Fact/Inference/Unknown Separation Is Source-Driven, Never Inferred

Every category/confidence assignment in `normalize.ts` is a fixed lookup keyed on an
explicit enum value the source system itself already emitted (an `eventType`, a
`decision` result, a `FactType`) — never a heuristic over free text, and never an LLM
call. A `policy_decisions` row is always `DECISION`/`CERTAIN`; nothing in this codebase
can cause it to render as `FACT` or `LIKELY`. This is what makes the hard rule
enforceable: a claim can never be represented above the certainty its own
source-of-truth already committed to. Proven exhaustively by
`evidence-evaluation.ts`'s 444-scenario run (100% classification correctness).

## Redaction

Four classes: `PUBLIC_SAFE` < `OPERATOR_SAFE` < `SENSITIVE` < `SECRET_NEVER_RENDER`.

- **Default by (sourceSystem, category)**: plain health counters are `PUBLIC_SAFE`;
  governance anomalies (their free-text `description` can reference proposal/payload
  specifics) are `SENSITIVE`; everything else defaults `OPERATOR_SAFE`.
- **Content-driven upgrade**: `baseRecord()` in `normalize.ts` runs `containsSecret()`
  (the same pattern set as Phase 5I's delegation eligibility scan — `sk-`, `AIza`,
  `BEGIN ... KEY`, `refresh_token`, `client_secret`, `api_key=`, `password=`) against
  the **raw, pre-sanitization** claim and canonicalReference. Any match unconditionally
  upgrades the record to `SECRET_NEVER_RENDER`, overriding whatever the
  (sourceSystem, category) default was. A prior version of this code pre-sanitized the
  claim in two call sites (`normalizeGovernanceAnomaly`, `normalizeConflict`) before
  passing it to `baseRecord()`, which meant the secret-detection check ran against
  already-redacted placeholder text and could never see the original secret — found and
  fixed by `security.test.ts`; see the fix commit for detail.
- **Enforcement**: every route in `evidence/router.ts` filters at
  `redactionClassAtMost: 'OPERATOR_SAFE'` — an authenticated Command Center caller never
  receives a `SENSITIVE`/`SECRET_NEVER_RENDER` record over this API, regardless of what
  it asks for. `GET /evidence/:id` additionally 403s outright rather than serving one.
  `EvidenceService.get()` itself has no such gate (it is a data layer, not a policy
  layer) — the gate belongs to, and is exercised at, the router.

## Independent Defense-in-Depth Discovery

Phase 5F's pre-existing `sanitizeText()`/`rejectSecret()` (`personal-os/actions/policy.ts`)
already refuses to store an `sk-`/`BEGIN KEY`/`bearer `/`password=`/`token=`-bearing
reject or cancel reason at the Controlled Actions layer itself, before evidence is ever
recorded — the same "second independent protection layer" pattern discovered during
Phase 5I's recurrence-stripping investigation. `security.test.ts` documents this
discovery explicitly and then tests evidence's own redaction as genuine defense-in-depth
by feeding a synthetic raw row directly to the normalize layer (bypassing the already-
blocking upstream guard on purpose), proving the guard here is real and not merely
inherited.

## Conflict Visibility

A conflict record's visibility is governed exclusively by its own source's `status`
field (`OPEN`/`NEEDS_CONFIRMATION` → visible; anything else → not) — evidence never
"resolves" a conflict itself and never silently prefers one disagreeing source over
another. Proven in `conflicts.test.ts` (cross-project isolation, immediate reflection of
a source-side resolution, no leakage of an already-resolved conflict).

## No New External Authority

Phase 6D introduces zero new external action types, zero new mutation surfaces, zero
change to Phase 5F/5G/5H/5I's approval/policy/kill-switch/budget/delegation semantics.
It is a pure read/observability layer.

## Security Tests

- `npm run test:evidence-contract` — full integration coverage across all 6 in-scope
  source systems.
- `npm run test:evidence-security` — the discovery above, redaction-upgrade proof,
  router-gate proof, structural no-mutation-method proof.
- `npm run test:evidence-conflicts` — visibility lifecycle, cross-project isolation.
- `npm run test:evidence-redaction` — every secret-pattern class, `classifyRedaction`
  determinism.
- `npm run test:evidence-freshness` — missing/invalid/future-dated timestamp handling,
  every per-category TTL.
- `npm run evidence:evaluation` — 444-scenario classification-correctness proof.
