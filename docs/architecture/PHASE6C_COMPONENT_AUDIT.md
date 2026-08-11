# Phase 6C Component Audit

Phase 6C adds an Operator Control Center as a read-only aggregation layer. It does not replace, approve, execute, schedule, delegate, or mutate any existing Phase 5, Phase 6A, or Phase 6B authority semantics.

## Baseline

- Production functional SHA: `73422465bd8e994d6f0d368b9ed7d907196bcc30`
- Master documentation SHA: `dc880d73ba7a58494ab72a3cd032c86c132ddbeb`
- Personal OS schema: `10`
- Frozen externally writable canonical actions:
  - `GMAIL_CREATE_DRAFT`
  - `CALENDAR_EVENT_PROPOSAL`
  - `CALENDAR_CREATE_EVENT`

## Component Decisions

| Component | Decision | Reason |
| --- | --- | --- |
| Task Runtime (`server/src/task-runtime`) | ADAPT | Source of waiting task approvals and blocked task state. Use existing store reads only. Do not add approval transitions here. |
| Operating approvals (`server/src/personal-os/operating/approvals.ts`) | MERGE | Existing read-only pending approvals already merge Task Runtime and knowledge confirmations. Phase 6C extends the same concept across all canonical authority surfaces. |
| Personal OS knowledge store (`server/src/personal-os/store.ts`) | ADAPT | Source of `NEEDS_CONFIRMATION` knowledge items. Only title, summary, scope, project links, and evidence references are surfaced. |
| Controlled Actions (`server/src/personal-os/actions`) | KEEP | Canonical one-action approval/execution boundary. Phase 6C may list proposals and latest stored evidence, but all approve/reject/cancel/execute behavior remains here. |
| Governance policy engine (`server/src/personal-os/actions/governance`) | KEEP | Canonical evaluator for policies, budgets, and kill switches. Phase 6C derives summaries from stored decisions, budgets, kill switches, and active policy metadata without re-evaluating proposals. |
| Governed orchestration (`server/src/personal-os/orchestration`) | KEEP | Canonical action-plan DAG and step lifecycle. Phase 6C may show plans/steps that wait, block, or need reconciliation, but cannot resume, validate, cancel, or advance plans. |
| Delegated authority (`server/src/personal-os/delegation`) | KEEP | Canonical delegation approval and authorization layer. Phase 6C reads latest delegation rows and stored decisions only; it never calls authorization/evaluation methods that can reserve quota or persist decisions. |
| Authority Control Plane (`server/src/authority-control-plane`) | KEEP | Canonical authority manifest and Phase 6B legacy adapter/quarantine state. Phase 6C may summarize manifest counts and selected surfaces; it must not scan into a new authority engine. |
| Legacy authority adapter (`server/src/authority-control-plane/legacy-adapter.ts`) | KEEP | Canonical compatibility/quarantine behavior. Phase 6C surfaces counts and warnings only. |
| Existing Command Center Authority screen (`command-center/src/routes/AuthorityPage.tsx`) | ADAPT | Remains detailed authority inventory. Phase 6C adds a cockpit screen and links back to the existing authority inventory for surface-level inspection. |
| Existing Command Center Actions screen (`command-center/src/routes/ActionsPage.tsx`) | KEEP | Existing place for exact-payload action review. Phase 6C links to it and does not introduce bulk approval or alternate approval controls. |
| Existing Command Center Governance screen (`command-center/src/routes/GovernancePage.tsx`) | KEEP | Existing policy/budget/kill-switch screen. Phase 6C summarizes active authority and blocked reasons only. |
| Existing Command Center Delegations screen (`command-center/src/routes/DelegationsPage.tsx`) | KEEP | Existing delegation detail/review screen. Phase 6C links to it and does not add new delegation mutations. |
| Existing Command Center Plans screen (`command-center/src/routes/PlansPage.tsx`) | KEEP | Existing action-plan screen. Phase 6C surfaces waiting/blocked plan and step items only. |
| Legacy `/api/*` route set after the canonical Phase 5/6 mounts | IGNORE | Out of Phase 6C scope except through the Phase 6A/6B manifest and quarantine summaries. |

## Required Phase 6C Additions

- Add `OperatorControlService` as a read-only aggregation layer.
- Add authenticated GET-only APIs:
  - `/api/operator/overview`
  - `/api/operator/pending`
  - `/api/operator/authority`
  - `/api/operator/blocked`
  - `/api/operator/item/:id`
  - `/api/command-center/operator/*` bridge equivalents
- Add an Operator Control Center Command Center page with:
  - Overview
  - Waiting on Me
  - Active Authority
  - Blocked
  - Expiring / Needs Attention
  - Legacy / Quarantined
- Add deterministic evaluation, security tests, acceptance tests, and docs.

## Non-Goals

- No schema version bump.
- No new approval engine.
- No new authority engine.
- No generic mutation endpoint.
- No bulk approval.
- No execution shortcut.
- No expansion beyond the frozen externally writable canonical actions.
