# Phase 5G — Action Policy & Governance Engine: closure record

## Result

Deployed to production 2026-08-10.

## SHAs

- Security remediation PR: [#72](https://github.com/liemdo28/master/pull/72), merge SHA `fc59682daaea19c3650cbb387d75c4710b2ac697`
- Phase 5G PR: [#71](https://github.com/liemdo28/master/pull/71), merge SHA `36c77fa945337f1f4dcf8afd24a3dd66dbe6762b`
- Final master SHA / deployed SHA: `36c77fa945337f1f4dcf8afd24a3dd66dbe6762b`

## Credential remediation chain (predates Phase 5G, resolved before this deploy)

7 real-format credentials were found tracked in the repository's root publish commit
(`c1e0b423`, 2026-07-30) by a broad diagnostic scan — unrelated to and untouched by
Phase 5G's own diff. Full sanitized classification and remediation detail:
[`docs/security/PHASE5G_CREDENTIAL_REMEDIATION.md`](../security/PHASE5G_CREDENTIAL_REMEDIATION.md).

| # | Finding | Status |
|---|---|---|
| 1,2 | opusmax API keys | USER_ATTESTED_ROTATED_OR_REVOKED |
| 3 | Anthropic API key | USER_ATTESTED_ROTATED_OR_REVOKED |
| 4 | OpenAI API key | USER_ATTESTED_ROTATED_OR_REVOKED |
| 5 | Google OAuth (payroll) | USER_ATTESTED_ROTATED_OR_REVOKED |
| 6,7 | Stale `MI_CORE_API_KEY` literals | VERIFIED_STALE_AND_REMOVED (config-proven non-functional against the live server; no third-party provider involved) |

**HISTORICAL EXPOSURE: YES.** All 7 credentials existed in a public GitHub repository's
tracked history from 2026-07-30 until removal on 2026-08-10. Removing the credential
material from the current tracked tree does not undo that historical exposure — git
history on `master` was not rewritten and was not force-pushed, per repository policy.
Provider-side rotation/revocation for findings #1–#5 is owner-attested; this agent had
no independent, authenticated access to the opusmax, Anthropic, OpenAI, or Google
consoles to verify rotation directly, and did not test the old credentials against any
provider.

## Schema

`personal-os.db` migrated v7 → v8 on first live request to `/api/governance/status`
(lazy migration, matching the established pattern from Phase 5D-3's v5→v6 migration).
Verified: `integrity_check=ok`, `foreign_key_check=0`, `journal_mode=wal`, all 33
pre-v8 tables' row counts preserved exactly, migration rerun is idempotent (no
duplicate `policy_sets` row on a second lazy-migration trigger). 7 new tables:
`policy_sets`, `policy_rules`, `policy_decisions`, `action_budgets`, `kill_switches`,
`governance_anomalies`, `governance_events`. `tasks.db` and `projects.db`:
`integrity_check=ok`, `foreign_key_check=0`, unaffected by this deploy.

## Backup

`D:\mi-core-pm2-backups\phase5g-predeploy-20260810-193610\` — pre-deploy `server/dist`,
`.env` marker-before snapshot, online SQLite backups of all three live databases
(`personal-os.db`, `tasks.db`, `projects.db`) with integrity verified before backup.

## Policy

- Active policy: `policy-set-phase5g-default-v1`, version `phase5g-default-v1`
- Policy content hash: `ea7382fa364268cf12d8cdb32e4cdc1ae3e21f2eea1da524f3efb0141a613531`
  — reproduced identically across the fresh-worktree acceptance run, the clean-master
  build verification, and live production (`/api/governance/status`), confirming the
  deployed policy is byte-identical to what was reviewed and tested.
- 100-action evaluation: 100/100 correct, `unauthorizedAllow=0`, `deniedExecuted=0`,
  `killSwitchBypass=0`, `budgetBypass=0`, `deterministicDecisions=true`.
- 3 live budgets confirmed configured and persisted across a `mi-core` restart with
  identical `resetsAt` timestamps (not regenerated): `budget-calendar-create-hour`,
  `budget-calendar-proposal-hour`, `budget-gmail-draft-hour`.
- Kill switch: inactive by default, state confirmed persisted across restart.

## Supported Phase 5F action types (governed by Phase 5G policy)

`CALENDAR_CREATE_EVENT`, `CALENDAR_EVENT_PROPOSAL`, `GMAIL_CREATE_DRAFT` — all
proposal/approval/execution/evidence flows pre-date Phase 5G (Phase 5F) and were
confirmed unchanged across this deploy (`action_proposals`, `action_approvals`,
`action_executions`, `action_evidence`, `action_compensations` row counts identical
before and after deploy and after restart — no duplicate or automatic execution).

## Phase 5G governance guarantees

- Deterministic `ActionPolicyEngine` / `RiskEvaluator` — same input always produces
  the same decision (`deterministicDecisions: true` in the 100-action evaluation).
- Every proposed action is evaluated against the active policy and current budget
  state before approval is even possible; denied actions are never executed.
- A global kill switch can halt all controlled-action execution; state persists
  across restart.
- Per-action-type budgets (proposals/approvals/executions/external targets, hourly)
  enforced before execution; budget state persists across restart.
- Anomaly detection records surfaced via `/api/governance/anomalies` (audit trail via
  `/api/governance/audit`).
- Gmail SEND is absent from the entire governed Controlled Actions path
  (`server/src/personal-os/actions/`) — confirmed via source scan, zero matches.
  A separate, pre-existing, unrelated legacy module (`server/src/actions/`, part of
  the original CEO-OS "Phase 20 Autonomous" subsystem that predates this whole 5-series
  of work) does contain a real, approval-gated Gmail-send capability — Phase 5G's own
  diff does not touch it, and it is out of this phase's scope.
- Calendar event creation in the governed path always sets `sendUpdates: 'none'`
  (unconditional, confirmed via source scan of `server/src/personal-os/actions/service.ts`).

## Rollback

Additive on the backend (new governance tables + routes only; no existing table or
route was altered or removed). To roll back:
1. Restore `server/dist` from the predeploy backup above.
2. Restore root `.env`'s `MI_DEPLOYED_SOURCE_SHA` from
   `deployed-source-marker.before.txt` in the same backup directory.
3. Restart only `mi-core`.
4. The v8 schema tables remain present but unused by pre-5G code — no destructive
   downgrade migration exists or is needed; pre-5G functionality does not read the
   new tables.

## Explicitly forbidden capabilities (unaffected by this deploy — none exist in this diff)

Controlled Actions autonomous execution, Gmail SEND (within the governed path),
financial actions, autonomous approval, autonomous merge/deploy, voice, desktop
control, multi-agent orchestration, Phase 5H. No code path for any of these exists
anywhere in the Phase 5G diff.

## Tag / release convention

Existing tags: `v1.0.0`, `v1.1.0` (both 2026-08-05, predating Phase 5A). No
phase-specific tag exists for any of Phase 5A through 5F, despite all being merged and
deployed — the established convention does not tag individual phases. Following that
same convention, **no new tag is proposed or published for Phase 5G**. If a version
tag is wanted at a future consolidated release point, `v1.2.0` would be the next
sequential value, but publishing it is not authorized by this closure and was not done.
