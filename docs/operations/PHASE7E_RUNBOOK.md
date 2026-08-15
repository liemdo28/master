# Phase 7E — Operator Workspace Runbook

Date: 2026-08-15

## What changed operationally

- `command-center/src/lib/jarvis-workspace.ts` (new) — pure truth-status
  and context-derivation logic: `TruthStatus`, `factTruthStatus`,
  `responseTruthStatus`, `planTruthStatus`, `proposalTruthStatus`,
  `simulationTruthStatus`, `SessionKind`, `sessionKind`, `ContextState`,
  `deriveContextState`, `ParsedEvidenceRef`, `parseEvidenceRef`.
- `command-center/src/components/TruthStatusBadge.tsx` (new).
- `command-center/src/components/jarvis/ContextIndicator.tsx`,
  `EvidenceInspector.tsx`, `PlanInspector.tsx`, `SimulationInspector.tsx`
  (new).
- `command-center/src/routes/JarvisPage.tsx` (rewritten in place — same
  route, no new page): 3-region layout (History / conversation / Inspector
  tabs), session-aware (`GET /jarvis/session/current`), `WAITING_APPROVAL`
  now links to `/actions` (was `/approvals` — see
  `PHASE7E_OPERATOR_WORKSPACE.md`).
- `server/src/personal-os/automation-simulation/router.ts`,
  `server/src/jarvis-gateway/services.ts`,
  `server/src/jarvis-gateway/handlers/simulation.ts` — the simulation-cache
  connectivity fix (see `PHASE7E_ACCEPTANCE.md` for the full root cause).
- `server/src/jarvis-gateway/phase7c-acceptance.ts` — point 14 amended to
  accept `/actions` as well as `/approvals` (the real invariant was always
  "canonical approval-surface page, never inline control," not the literal
  route string).
- New test/eval scripts: `test:jarvis-workspace-evaluation` (778
  scenarios), `test:jarvis-workspace-security` (12), `test:jarvis-workspace-a11y`
  (10) in `command-center/package.json`.
- New standalone performance script:
  `command-center/e2e/phase7e-performance.cjs` (not part of the pass/fail
  gate, same as `phase7b-performance.ts`).
- E2E (`command-center/e2e/command-center.spec.ts`) extended with steps
  15a–15d (context/evidence/simulation inspectors, session continuity) and
  a new dedicated test for cross-session/request ownership + zero-mutation
  proof across the whole workspace flow.

## What did NOT change

No database schema migration — `personal-os.db` stays v10. No new backend
route of any kind (the simulation fix reuses the existing
`GET /simulation/:id` route's own cache, it doesn't add a route). No new
external action type, no Gmail SEND, no financial action, no autonomous
approval/execution path. Authority manifest `mutations` stays `402`,
unchanged from Phase 7D.

## How to use it

Command Center → **Jarvis** in the sidebar (unchanged nav entry, same route
`/command-center/jarvis`). Ask a question in the center panel; use the
right-hand Inspector tabs (Context / Evidence / Plan / Simulation — the
latter two only appear when relevant to the selected exchange) to see the
supporting detail. The left History panel lets you revisit an earlier
exchange in the current session without re-asking.

Nothing on this page executes, approves, or mutates. Every actionable next
step is a link to the canonical page that owns that action:
`/actions` (approve), `/tasks/:id` (task detail), `/orchestration/plans/:id`
(full plan detail).

## Interpreting the truth-status badge

| Badge | Meaning | What to do |
|---|---|---|
| `OBSERVED` | Answer backed by real facts from a canonical source. | Trust it as a fact. |
| `INFERRED` | Answer is a model inference, not a directly-observed fact. | Treat as a suggestion, verify if it matters. |
| `PROPOSED` | A plan, proposal, or simulation result — nothing has run. | Review before acting; follow the link to approve/execute on its canonical page if you want to proceed. |
| `APPROVAL_REQUIRED` | Blocked on a real pending approval. | Go to `/actions` (or the linked canonical page) to decide — this page cannot approve anything. |
| `BLOCKED` | A real blocked/failed/cancelled state. | Investigate on the canonical page; this page only reports it. |
| `EXECUTED` | Real execution evidence was independently fetched and confirmed. | Informational only — this badge can never appear without a matching evidence/execution record, see `PHASE7E_SECURITY_BOUNDARY.md`. |

## Performance (measured, not planned — dev checkout, single machine)

Via `node e2e/phase7e-performance.cjs` (real Chromium + real compiled
server):

| Measurement | n | p50 | p95 |
|---|---|---|---|
| Initial workspace load (`/jarvis`, fresh login each run) | 5 | 84ms | 104ms |
| Simple conversation round trip (`TASK_QUERY`, no external provider) | 8 | 72ms | 76ms |
| Evidence Inspector render | 6 | 32ms | 34ms |
| Simulation Inspector render | 6 | 126ms | 129ms |
| INFORMATION-intent round trip (external-provider-bound, reported separately) | 5 | 77ms | 77ms |

The INFORMATION-intent number is dominated by external model-provider
reachability in this dev checkout (Ollama down, per the standing `DEGRADED`
health baseline) — it is measured and reported on its own line rather than
folded into the other numbers, so provider latency is never hidden inside a
misleadingly-fast local figure. In a production runtime with a reachable
model provider this number reflects real provider round-trip time instead.

## Troubleshooting

- **Evidence Inspector shows "not available (redacted, expired, or not
  found)" for a ref I expect to resolve**: this is the same honest-failure
  behavior `GET /evidence/:id` has always had — check the ref's redaction
  class and TTL on the Evidence page directly.
- **Simulation tab doesn't appear for a `SIMULATION` response I just
  asked**: confirm the server is running the Phase 7E fix (see below) —
  before this phase, a Jarvis-created simulation could 404 against
  `GET /simulation/:id` because of the disconnected-instance bug.
- **`GET /jarvis/session/current` 404s right after a successful ask**: this
  is expected on the very first turn of a brand-new session (Phase 7D
  behavior, unchanged) — `fetchSessionOrNull()` treats a 404 as "no session
  yet," not an error.
- **A past turn's detail shows "This turn's full detail has expired"**: the
  request/response cache is bounded to 30 minutes (Phase 7C behavior,
  unchanged) — the session's own turn summary in History is all that
  remains after that window.
- **Workspace seems to reach `EXECUTED` for something that didn't run**:
  this should be structurally impossible — see
  `PHASE7E_SECURITY_BOUNDARY.md`'s EXECUTED-claim invariant section and
  treat any real occurrence as a Sev-1 regression.

## Rollback

Standard: redeploy the prior `server/dist`/`command-center/dist` snapshot.
The workspace changes are additive to an existing route (`/jarvis`) with no
new backend route and no schema migration — rolling back removes the
enhanced UI and reverts `JarvisPage.tsx` to its Phase 7C/7D shape; nothing
requires a data migration to revert. The simulation-cache connectivity fix
is a one-directional bug fix (an existing route becomes reliable), not a
feature — it should not be reverted independently of a full rollback.
