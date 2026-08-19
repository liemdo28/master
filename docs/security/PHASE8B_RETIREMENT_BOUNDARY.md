# Phase 8B — Retirement Security Boundary

Records what Phase 8B did *not* do, what it proved stays contained, and the evidence trail for each — the security counterpart to the retirement runbook.

## Hard boundary held (no expansion)

Per the governing directive, Phase 8B was not authorized to, and did not: add new authority or Gmail SEND capability, add financial execution, add autonomous execution, add a new planner/memory/retrieval stack, redesign the Jarvis Gateway, reconnect OAuth, start disabled services, activate `node-agent`, or change the DB schema (stays v10). Verified: the entire code diff for this phase is a route-file deletion, a route-mount removal, one read-only registry rule addition, two evaluation-script fixes, one frozen-test baseline update, and new tests/docs — no new route, no new external-action type, no new store.

## What was proven contained, re-verified this phase

| Boundary | Status | Evidence |
|---|---|---|
| Gmail SEND | Absent/unreachable | `executeGmailSend()`/`sendEmail()` have zero live callers system-wide; `routes/actions.ts` not mounted; `action-router.ts` has no `gmail_send` case arm (`phase7g:acceptance` point 17, re-verified live this session) |
| Financial execution | Absent | 0 files reference a money-movement function name across 649 `server/src/**/*.ts` files (`phase7g:acceptance` point 18, re-verified live this session) |
| Shell/process execution | 0 bypasses | `phase7a:evaluation` family B: 18/18 attempted payloads blocked, `execBypasses=0`; `phase7g:red-team-evaluation`: `legacyMutationBypass=0` (both re-run fresh this session) |
| Browser write / SSRF | Unaffected, still holds | Phase 8A's containment is untouched by this phase's diff; `test:ssrf-policy` + `test:phase8a-security` re-run clean this session |
| Autonomous approval | 0 bypasses | `phase7g:red-team-evaluation`: `approvalByConversation=0`, `approvalByVoice=0`, `authorityBypass=0` (clean run, re-run 3x this session — see below) |
| Legacy mutation reachability | 0 | `test:phase7c-legacy-mutation-scan` (40/40) + `test:phase7g-legacy-authority-scan` (50/50) + `phase8b-retirement-evaluation.test.ts` (1310 scenarios, `legacyMutationReachable=0`) |
| Route ownership ambiguity | 0 | `phase8b-legacy-retirement.test.ts`: 0 UNREGISTERED owners on any mutation-capable route; all 13 required domains resolve to exactly one canonical owner |

## Authority manifest movement

Pre-Phase-8B baseline (Phase 7G freeze): `total: 1111`, `legacyMutations: 190`, `unknownMutations: 0`, `unresolvedLegacyMutations: 0`.
Post-Phase-8B: `total: 1064`, `legacyMutations: 175`, `unknownMutations: 0`, `unresolvedLegacyMutations: 0`.

Per the directive's own rule ("mutation count may decrease, must not increase — STOP if it does"): this is a **decrease of 47 total surfaces and 15 legacy-mutation-capable surfaces**, entirely attributable to deleting the dead `/api/jarvis` router (49 routes, of which 15 were legacy-classified and mutation-capable). No increase occurred anywhere in the manifest. `unknownMutations` and `unresolvedLegacyMutations` both remained at 0 throughout — the strictest, non-negotiable invariants this repo has carried since Phase 6A were never at risk.

## Findings surfaced during this phase's security work (not boundary violations)

Full detail in inventory doc §11.5. Summary:

1. **`secretLeakage` regex over-breadth** (Phase 7F's own frozen evaluation script) — a safe refusal was mis-flagged because one of 5 detection patterns matched a credential's bare *name* rather than a value. Fixed by requiring a value-shaped match, matching the bar the other 4 patterns already held. Not a real leak; redaction (`MI_CORE_[REDACTED:api_key]`) was already firing correctly in the flagged text.
2. **`bootPlanNondeterminism` flake** (Phase 7A's own frozen evaluation script) — caused by a live TCP port-reachability probe against real machine state (not the test fixture), which can legitimately differ between two calls under system load. Excluded that field from the determinism comparison, matching the existing precedent for the `generatedAt` field.
3. **`falseExecutedClaims` non-reproducibility** (Phase 7G's own frozen red-team script, live-LLM-driven) — 8 → (infra-killed run) → 0 across three independent runs of the same code. 7 of the original 8 flagged responses were regex false-positives on hedged/interrogative phrasing; the one genuine bare claim corresponded to zero actual capability (`externalSideEffects=0` held throughout, Gmail SEND independently proven unreachable). Left as-is — inherent LLM free-text variance this script's own design does not claim to control, not a code defect.

None of these three findings are Phase 8B regressions, and none required weakening any real security invariant — two were precision fixes (tightening a pattern), one required no code change at all (confirmed non-reproducible).

## What remains explicitly out of scope, flagged for a future phase

`gstack/`'s own separate approval gate (`approval-engine.ts`) — real execution capability (real external publish via `RAWWEBSITE_ADMIN_SECRET`-gated API, real WhatsApp send via `sendToCeo()`), reachable via authenticated `POST /api/gstack/process`, gated by GStack's own `classify()` rather than the canonical `ControlledActionService`. This is a genuine, pre-existing, unresolved architectural risk — not touched, not made worse, not made better by Phase 8B. Documented for prioritization in a future dedicated phase (inventory §3).
