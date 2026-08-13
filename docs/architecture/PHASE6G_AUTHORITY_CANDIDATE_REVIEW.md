# Phase 6G — Authority Candidate Review

Date: 2026-08-13

Evaluation only. No production code enabling a new external action is introduced
by this document or its PR.

## 1. Reality audit (independently re-verified, not assumed)

| Item | Value |
|---|---|
| `origin/master` | `912e0894d28d8317c33c029da02daa739c5bc56e` (docs-only, matches expected) |
| Functional deployed SHA | `5660c03900dc1b343e4c11cef97ec4abb4860c54` (unchanged — docs-only PR #94 correctly not redeployed) |
| Deploy-owned source snapshot | `F:\Projects\D-root-mi-snapshots\mi-core-deployed-source\5660c03900dc1b343e4c11cef97ec4abb4860c54`, provenance aligned (`.env` `MI_DEPLOYED_SOURCE_SHA`/`_ROOT` match) |
| Production schema | Personal OS **v10** |
| PM2 state | `mi-core` (PID 21728, 0 restarts), `mi-ai-service`, `mi-accounting`, `qb-ops-agent` (1 restart, pre-existing/unrelated), `mi-node-agent` all `online`; `mi-ceo-observer`/`mi-whatsapp-gateway`/`mi-n8n` not running (intentional, unchanged) |
| `mi-core` health | `{"server":"ok","python_ai_service":"ok","ollama":"down"}` |
| **Ollama** | **DOWN.** Not silently claimed recovered. No candidate in this review requires Ollama. |
| Live authority | `unknownMutations: 0`, `unresolvedLegacyMutations: 0`, `total: 1076` |
| DB integrity | `integrity_check=ok`, 0 FK violations, all 3 DBs |
| Current action types | `GMAIL_CREATE_DRAFT`, `GMAIL_SEND_DRAFT` (typed, permanently unimplemented — throws on execute), `CALENDAR_EVENT_PROPOSAL`, `CALENDAR_CREATE_EVENT`, `LOCAL_TASK_DRAFT`, `LOCAL_STATE_UPDATE`, `CODING_TASK_APPROVAL` (`server/src/personal-os/actions/types.ts`) |
| Active policy | `phase5g-default-v1` (`contentHash: ea7382fa...`), status `ACTIVE` |
| Budget state | `GMAIL_CREATE_DRAFT` 0/8 executions used, `CALENDAR_CREATE_EVENT` 0/2 used, `CALENDAR_EVENT_PROPOSAL` 0/20 used (this hour) |
| Kill-switch state | None active (empty table — normal operating mode) |
| **OAuth scopes granted** | **Cannot be read from a live token — see below.** Only `gmail.compose` and `calendar.events` have ever been requested by this codebase's scope list (`assertSandboxGoogleIdentity`, `server/src/personal-os/actions/service.ts:762-784`); `gmail.send`/`drive.*` scopes have never been requested. |
| Provider connector capabilities | See Section 2 inventory below. |

### Critical environmental finding

Google OAuth is **not connected** in this environment, confirmed two independent
ways:

1. `.env`'s `GOOGLE_REFRESH_TOKEN` key exists but is **empty**.
2. The actual token file `getAuthedClient()` reads
   (`.local-agent-global/visibility/google-tokens.json`,
   `server/src/visibility/connectors/google/google-auth.ts:12`) **does not
   exist** on disk.

`getAuthedClient()` throws `'No Google tokens. Visit /api/auth/google/start to
authorize.'` before any Gmail/Calendar/Drive call could ever reach Google's API.
This means **hard prerequisite #17 (safe sandbox identity/environment exists,
Section 5) fails for every candidate that would touch a real Google API**,
regardless of how well-designed the candidate is. This is the dominant factor in
this review's outcome — see Section 6.

## 2. Candidate inventory (repository capability audit)

Full file:line evidence gathered via direct source inspection.

| Candidate | Canonical (governed) impl. | Legacy impl. | Live-reachable? |
|---|---|---|---|
| A. Gmail draft update/refine | **Does not exist** — no `drafts.update` anywhere | none | n/a |
| B. Calendar controlled update/reschedule | Does not exist | `calendar.events.patch` (`server/src/actions/google-executor.ts:175`) | **No** — `google-executor.ts` has zero importers |
| C. Calendar controlled cancellation | Does not exist | Does not exist (only a dead enum string) | n/a |
| D. Google Drive bounded write | Does not exist | `drive.files.create` (`server/src/actions/drive-action-adapter.ts:73`); `executeDriveUpload`/`executeDriveShare` (`google-executor.ts:214`) | **No** — orphaned, never called; live-mounted Drive routes in the manifest are read/ingest-only |
| E. Narrowly-scoped notification | n/a (not a Gmail/Calendar/Drive provider action; depends on `mi-whatsapp-gateway`, which is intentionally stopped) | n/a | n/a |
| F. Gmail SEND | Does not exist (canonical path has only `drafts.create`) | `messages.send` (`google-executor.ts:56`), `drafts.send` (`server/src/actions/gmail-action-adapter.ts:91`) | **No** — `action-router.ts`'s switch has no `gmail_send` case, and the router mounting it is never imported in `index.ts`; `/api/approval*` (the only other path that could reach `google-executor.ts`) is `LEGACY_QUARANTINED` in the authority manifest |
| G. Browser write | n/a | `browser-operator.ts` (`page.fill`, `login`, `upload`); `routes/browser-agent.ts` | **No** — both `POST /api/coo-v4/execute` and `POST /api/browser/write` are `LEGACY_QUARANTINED` in the manifest |
| H. Shell/process execution | n/a | Present, but backs internal build/coding/ops tooling only — never wired to an external-provider write | n/a — out of scope of this review's provider-action focus |
| I. Git merge/deploy | **Does not exist anywhere in production code** | n/a | n/a |

Canonical (governed, live) provider dispatch today is exactly two calls:
`gmail.users.drafts.create` (`server/src/personal-os/actions/service.ts:463`)
and `calendar.events.insert` (`service.ts:531`, with `sendUpdates: 'none'`
preserved, freebusy-recheck-then-insert pattern). Everything else — SEND,
Drive write, browser write — exists only as orphaned legacy code that the
Phase 6B authority boundary already correctly quarantines and that no live
route reaches.

## 3. Excluded candidates

**Financial actions: NOT ELIGIBLE FOR PHASE 6.** Not scored below. This mirrors
the existing `global-forbid-disallowed-capabilities` policy rule (priority
1000), which already hard-`DENY`s any proposal whose keywords include
`financial` (`server/src/personal-os/actions/governance/schema.ts:154-157`).

## 4. Candidate scorecard

Scored 1–5 (5 = best/safest/most ready) on the merits of each candidate's
*design*, independent of the environmental sandbox blocker (which is recorded
separately in the "Hard prerequisites" row and drives the final DEFERRED status
for every Google-touching candidate this cycle). Browser write, shell/process,
and Git merge/deploy are recorded but not merit-scored — Section 10 places them
under a default program-level defer regardless of design quality.

| Dimension | A. Gmail draft-update | B. Calendar update/reschedule | C. Calendar cancellation | D. Drive bounded write |
|---|---|---|---|---|
| User value | 4 | 4 | 3 | 2 |
| Expected frequency | 3 | 3 | 2 | 2 |
| Reversibility | 4 (edit again) | 3 (can re-update) | 2 (cancellation is one-way from the invitee's POV even with `sendUpdates:none`) | 3 |
| Blast radius | 4 (single draft, never sent) | 3 (real calendar mutation) | 2 (removes a real event) | 3 (bounded folder, if scoped) |
| Target scoping | 5 — `action_executions.externalObjectId` already records every Mi-created `draftId`, giving exact provenance | 3 — would need `calendarId`+`eventId` binding; delegation eligibility already anticipates this (`eligibility.ts:73` requires explicit `calendarId`) | 3 — same binding need, no existing scaffolding | 2 — needs an approved root/folder policy that doesn't exist yet |
| Deterministic payload | 4 | 4 | 4 | 3 |
| Provider idempotency | 3 (drafts don't have a native idempotency key; would reuse this system's own `idempotencyKey` pattern) | 3 | 3 | 3 |
| Provider reconciliation | 3 | 3 | 3 | 3 |
| Ambiguous-result handling | 3 (same pattern as existing `AMBIGUOUS_RESULT` scenario, reusable) | 3 | 3 | 3 |
| Policy enforceability | 4 (fits `RISK_BY_ACTION` table cleanly, likely R2 like `GMAIL_CREATE_DRAFT`) | 4 (likely R3 like `CALENDAR_CREATE_EVENT`) | 3 (likely R3, arguably higher) | 3 |
| RiskEvaluator fit | 4 | 4 | 3 | 3 |
| Approval UX | 4 | 4 | 3 | 3 |
| Delegation safety | 3 (defaults to ineligible — not in the hardcoded allowlist at `eligibility.ts:57`) | 3 (same default) | 3 (same default) | 3 |
| Kill-switch coverage | 5 (kill-switch is scope/actionType generic, covers any new type automatically) | 5 | 5 | 5 |
| Budget/rate-limit suitability | 5 (same generic `action_budgets` mechanism) | 5 | 5 | 5 |
| Evidence completeness | 4 | 4 | 4 | 4 |
| Operator preview quality | 4 | 4 | 3 | 3 |
| Phase 6F simulation coverage | 1 — **no scenarios built** (Section 5 gate failed before Section 11 was reached, see below) | 1 | 1 | 1 |
| **Sandbox availability** | **1 — BLOCKED. No Google OAuth token in this environment (see Section 1).** | **1 — same blocker** | **1 — same blocker** | **1 — same blocker** |
| OAuth scope expansion required | 5 — no expansion (`gmail.compose` already covers draft update) | 5 — no expansion (`calendar.events` already covers update) | 4 — `calendar.events` covers delete, but removes a real user-facing event (see reversibility) | 2 — would require a new `drive.file`-scoped grant, not yet requested |
| Rollback/compensation quality | 4 (re-update or delete the draft) | 3 (re-update again) | 1 (no compensation for a cancelled event once notifications would fire — mitigated only by `sendUpdates: none`) | 3 |

**Security/operational blockers (hard, not averaged away):**

- All four: **safe sandbox unavailable** (Section 1) — this alone is sufficient
  to defer every one of them this cycle, per Section 35's explicit stop
  condition ("safe sandbox unavailable for selected write").
- All four: **zero canonical implementation exists today** — none of them are
  "flip a flag" candidates; each requires real new provider-call code, which
  Section 18 requires be added only *after* a formal decision, not before.
- D (Drive): scope-boundary policy (approved root/folder, path allowlist) does
  not exist yet even at the design level — Section 9 requires rejecting any
  candidate whose scope "cannot be strongly bounded," and no such bounding has
  been designed.

**Not scored (Section 10 default-defer, independent of merit):**

- **G. Browser write** — real write-capable Playwright automation exists
  (`browser-operator.ts`, `routes/browser-agent.ts`) but both entry points are
  already `LEGACY_QUARANTINED`. Section 10: "must NOT be selected... unless the
  evidence is exceptionally strong and a separate explicit directive already
  authorizes them... default decision: DEFER BEYOND PHASE 6." No such separate
  directive exists. **DEFERRED BEYOND PHASE 6.**
- **H. Shell/process execution** — exists for internal tooling only, already
  under quarantine review (`legacy-authority-security.test.ts`). Never wired to
  an external-provider write. Same Section 10 default. **DEFERRED BEYOND PHASE
  6.**
- **I. Git merge/deploy** — does not exist in production code at all. Same
  Section 10 default. **DEFERRED BEYOND PHASE 6.**
- **E. Narrowly-scoped notification** — not a Gmail/Calendar/Drive provider
  action; its only plausible transport (`mi-whatsapp-gateway`) is intentionally
  stopped (production-recovery classification, unrelated to this review, not to
  be changed here). **DEFERRED — no live transport to evaluate against.**

## 5. Hard prerequisites (Section 5, all 18 required)

For **every** Google-touching candidate (A, B, C, D), prerequisites 1–16 and 18
are plausibly satisfiable by design (see scorecard above) — **but prerequisite
17, "safe sandbox identity/environment exists," is FALSE for all of them**,
verified two independent ways (Section 1). Per Section 5's explicit rule ("If
any hard prerequisite is missing: candidate = DEFERRED / REJECTED"), **every
Google-touching candidate is DEFERRED** on this prerequisite alone, before any
further scoring would matter.

## 6. Gmail SEND special gate

**GMAIL SEND = NOT APPROVED.**

Independent of the sandbox blocker (which alone would already defer it), Gmail
SEND fails on its own terms:

- OAuth scope `gmail.send` has **never been requested** by this codebase — only
  `gmail.compose` and `calendar.events` appear in the scope list
  (`google-auth.ts`, `service.ts:775`).
- The existing policy engine already contains a highest-priority (1000) GLOBAL
  `DENY` rule specifically naming `GMAIL_SEND_DRAFT`
  (`governance/schema.ts:154-157`) — this is a deliberate, pre-existing product
  decision, not a gap.
- The canonical execute path (`service.ts:641-642`) throws
  `'GMAIL_SEND_DRAFT is documented but not implemented until draft creation is
  proven'` unconditionally.
- Legacy SEND code exists (`google-executor.ts:56`, `gmail-action-adapter.ts:91`)
  but is provably unreachable from any live-mounted route (Section 2).
- None of the 18 Section 6 sandbox-identity/duplicate-prevention/reconciliation
  prerequisites have been built or verified — no sandbox acceptance was faked.

No part of this review changes that. Delegation for Gmail SEND remains
`DISALLOWED` by the existing hardcoded allowlist default.

## 7–9. Calendar / Gmail draft-update / Drive candidates

Evaluated on their merits above (Section 4). All three families are
well-scoped conceptually (especially A, Gmail draft-update, which scores
highest — reuses an existing OAuth scope, has a ready-made provenance
mechanism via `action_executions.externalObjectId`, and needs no new scope
grant) but **all are DEFERRED this cycle purely on the sandbox-availability
hard prerequisite**, not on design merit. This review deliberately avoids
recommending implementation work be started against a candidate that cannot
even reach a real sandbox-acceptance test right now.

`sendUpdates: 'none'` (the existing Calendar invariant) is not weakened or
touched anywhere in this document.

## 10. Browser / shell / Git candidates

Recorded above (Section 4) as DEFERRED BEYOND PHASE 6 per the program's own
default policy — not evaluated further.

## 11. Phase 6F simulation coverage

**No new simulation scenarios were built in this review.** Section 11 requires
100+ deterministic scenarios only "for every serious candidate" — a candidate
becomes "serious" by first clearing the Section 5 hard-prerequisite gate. Since
every Google-touching candidate fails prerequisite #17 (safe sandbox) and
Browser/Shell/Git are excluded by Section 10's default, **no candidate reached
the point where building simulation scenarios would be meaningful evidence**
rather than a wasted exercise. This is a deliberate, documented decision, not an
oversight: Phase 6F's existing 513-scenario suite (policy parity 100%,
authority parity 100%, provider dispatch 0) already proves the simulator itself
is production-safe and ready to cover a new action type the moment one is
formally approved and its `ActionType` contract is defined (Section 16).

## 12. Formal authority decision

```
PHASE 6G AUTHORITY DECISION:
NO NEW AUTHORITY APPROVED
```

**Rationale, in order of weight:**

1. **Environmental hard blocker (decisive):** Google OAuth is not connected in
   this production environment (empty `GOOGLE_REFRESH_TOKEN`, no
   `google-tokens.json` file — verified two independent ways). Every candidate
   that would touch Gmail/Calendar/Drive fails hard prerequisite #17 (safe
   sandbox) and Section 35's explicit stop condition ("safe sandbox unavailable
   for selected write"). No implementation work can reach real
   sandbox-acceptance verification right now, and Section 21 forbids faking it.
2. **Gmail SEND fails its own special gate independently** (Section 6) —
   scope never granted, policy-level `DENY` already in place, unreachable
   legacy code only.
3. **Browser write / shell-process / Git merge-deploy are excluded by the
   program's own default policy** (Section 10) regardless of any candidate's
   individual merit — no separate authorizing directive exists.
4. **Drive write lacks a bounded-scope design** (Section 9) even before the
   sandbox blocker is considered.
5. Gmail draft-update and Calendar update scored well on design merit (Section
   4) and remain the **best candidates for a future Phase 6G+ cycle once Google
   OAuth is reconnected** — this review deliberately preserves that groundwork
   rather than discarding it.

This is a fully acceptable Phase 6G outcome per the governing directive
("The valid successful result may be: NO NEW AUTHORITY APPROVED. That is a
fully acceptable Phase 6G outcome.").

Per Section 12: proceeding directly to Phase 6 program closure (Section 32),
skipping Sections 14–30 (Option-B-only implementation/deploy work).

Final external action set remains exactly:

```
GMAIL_CREATE_DRAFT
CALENDAR_EVENT_PROPOSAL
CALENDAR_CREATE_EVENT
```

**PHASE 6 COMPLETED WITH NO NEW EXTERNAL AUTHORITY.**
