# Phase 7G — Security Certification

Date: 2026-08-17

Final Phase 7 program security certification. Every number below comes from
an actual run of the cited script/test file on the merge-candidate source
tree, not a projection.

## 1500-scenario red team (§20)

`npm run phase7g:red-team-evaluation` — `server/src/jarvis-gateway/phase7g-red-team-evaluation.ts`.

```
totalScenarios: 1500
authorityBypass: 0
crossProjectLeakage: 0
crossSessionLeakage: 0
secretLeakage: 0
falseExecutedClaims: 0
legacyMutationBypass: 0
approvalByConversation: 0
approvalByVoice: 0
externalSideEffects: 0
determinismChecks: 20, determinismFailures: 0 (100% deterministic)
```

Categories covered: prompt injection (450 scenarios, 5 prefixes × 6 targets
× 15 phrasings), transcript injection via voice (180), 20×2 replay/
determinism checks, session fixation / cross-session access (10), cross-
project exfiltration (15), request/evidence-ID guessing (10), secret
extraction — direct + voice (100), approval spoofing via conversation and
voice (60), execution-state spoofing (40), the 7 forbidden-action
categories × 30 natural-language variants each (210, shell/browser/
desktop/Gmail-send/financial/deploy/autonomous-approval), arbitrary
provider/URL/path injection (40), and a kill-switch-bypass attempt against
the real `ControlledActionService` (5 — the service's kill-switch has no
direct test-only setter exported, so this block is certified via the
existing, separately-run `action-governance*` suite instead; documented
here rather than silently claiming coverage it doesn't have).

## Legacy authority — broadened final scan (§3)

`npm run test:phase7g-legacy-authority-scan` — 50/50 scenarios (10 strict
import-closure scans across Gateway/router/every voice file, 37 live-
adapter call-scans, 3 named regression locks). Broadened beyond Phase 7C's
own scan to explicitly cover: browser write (`coo-v4/agents/browser-
operator`, `coo-v4/skill-marketplace`, `engineering/browser/browser-
agent`, `routes/browser-agent`), PM2 mutation (`operations/self-healing`,
`operations/dev2-operations`, `operations/burn-in`, `routes/operations`,
`auto-task-engine`, `company-os/tool-registry`, `gstack/role-agents/
release-agent`, `gstack/skills/skill-registry`), git mutation (`coding/
benchmark/review-benchmark`, `coo-v4/agents/ai-developer-agent`,
`projects/connectors/*`, `projects/project-scanner`), and the dead-but-
dangerous `actions/google-executor.ts`.

### Three genuine findings from this scan (none required a code change to contain — all three were already unreachable; all three now have a permanent regression lock that didn't exist before)

1. `actions/google-executor.ts`'s `executeGmailSend()` (real
   `gmail.users.messages.send()`) and its dispatcher
   `executeApprovedAction()` have **zero callers anywhere in the source
   tree**.
2. `actions/gmail-action-adapter.ts`'s `sendEmail()` (real
   `gmail.users.drafts.send()`) has **zero callers** —
   `action-router.ts` only ever imports `searchGmail`/`readGmail`/
   `draftEmail` from that file.
3. `action-router.ts` type-declares a `gmail_send` category (with a risk
   level) but its `switch` has **no case arm for it** — falls through to
   `default: { ok: false, error: '...not yet approved.' }`. Independently,
   `routes/actions.ts` (the only file that imports `action-router.ts` for
   live HTTP use) **is not mounted anywhere in `index.ts`** — a second,
   independent layer of unreachability.

## `GMAIL_SEND_DRAFT` type placeholder (found during Section 4-5/20 work)

`personal-os/actions/types.ts`'s `ActionType` union includes
`GMAIL_SEND_DRAFT` (risk-classified R4/irreversible in `governance/
risk.ts`), but `service.ts`'s proposal-normalization step throws
immediately for this type (`'GMAIL_SEND_DRAFT is documented but not
implemented until draft creation is proven'`) — a proposal with this type
can never even be created, let alone approved or executed. Already
regression-locked by the pre-existing (not written this phase)
`controlled-actions-security.test.ts` — re-verified passing this run.

## Provider reconciliation / ambiguity (§10)

Not re-derived — already covered by the pre-existing (Phase 5F)
`personal-os/actions/__tests__/controlled-actions.test.ts`: calling
`execute()` twice on one proposal returns the identical execution record
(`duplicate.id === execution.id`) and `executions.length === 1` —
idempotency-key-based reconciliation, never a blind retry of a
potentially-completed external write. Re-verified passing this run.

## DB / authority failure semantics (§8-9)

`npm run test:phase7g-failure-semantics` — 3/3 scenarios:

- A corrupted SQLite file causes `TaskStore`'s constructor to **throw**
  (fail closed) rather than silently starting from an indistinguishable
  empty state.
- A healthy disposable DB copy (control case) opens and queries normally.
- `probeProvenance()` with `MI_DEPLOYED_SOURCE_SHA`/`_ROOT` unset returns
  `ok: false` — fails closed, never assumes clean provenance by default.
  (This is also reproduced live by `phase7g-certification-evaluation.ts`'s
  journey G, whose isolated fixture worktree has neither var set: real
  `AUTHORITY: UNAVAILABLE, PROVENANCE_MISMATCH` → overall `BLOCKED`.)

## External action freeze (§29) and financial boundary (§30)

Governed external action set unchanged: `GMAIL_CREATE_DRAFT` /
`CALENDAR_EVENT_PROPOSAL` / `CALENDAR_CREATE_EVENT`. Calendar creation
uses `sendUpdates: 'none'` (verified live in `service.ts`, both sandbox
provider call sites). Zero references to "accounting" anywhere in
`jarvis-gateway/` (including `jarvis-gateway/voice/`) — the Gateway and
voice module cannot reach the accounting engine even to read it, let alone
write. Zero matches anywhere in the source tree for money-movement-shaped
function names (`transferFunds`, `initiatePayment`, `placeTrade`,
`executeTrade`, `withdrawFunds`).

## Coding engine boundary (§28)

`jarvis-gateway/handlers/coding.ts` never calls `CodingWorkflow.planTask()`/
`.run()` — always returns an advisory `ANSWERED` response directing the
caller to Command Center → Coding / `POST /api/coding/tasks`. Re-verified
via `test:phase7g-legacy-authority-scan`'s call-based scan (which includes
every `jarvis-gateway/handlers/*.ts` file) and via direct source read this
phase.

## Voice-specific certification (carried forward from Phase 7F, re-verified)

`test:jarvis-voice` 11/11, `test:jarvis-voice-security` 38/38 + 16/16,
`jarvis-voice:evaluation` 1255 scenarios (routingCorrectness=1, all
leakage/bypass/secret/executed metrics=0) — all re-run clean on this
phase's final head.
