# Phase 9 — Roadmap Decision

## Section 25 — Proposed roadmap

Evidence does not justify a forced seven-phase sequence. Two phases are justified; the rest of the lettered structure is explicitly not proposed because there is no candidate ready to carry it.

**9A — Governance / Security Prerequisites & Hardening (proposed, docs+code, no authority expansion)**
- Purpose: close the gaps found in this discovery that block Project planning from ever progressing past proposal-only, and reconcile the two manifest-vs-enforcement drifts found (self-healing quarantine label; `coo-v4` SSRF gap).
- Authority delta: **zero**. No new `ActionType`, no policy/risk/budget/kill-switch semantic change.
- Source changes expected: implement `RECONCILIATION_REQUIRED`/`RECOVERY_REQUIRED` for at least one real failure scenario; route `coo-v4/agents/browser-operator.ts`'s `navigate()` through `security/ssrf-policy.ts`; either wire `DelegationService` into the live orchestration singleton or explicitly document its dormancy; reconcile `self-healing-monitor.ts`'s `SERVICES_TO_MONITOR` against `runtime-preflight`'s `INTENTIONALLY_STOPPED`; correct `authority-manifest.json`'s self-healing-monitor entry to accurately describe enforcement (or actually wire real enforcement) for `BACKGROUND`-kind surfaces; add input validation to `company-os/tool-registry.ts`'s `git` tool.
- Schema impact: none expected (v10 unchanged).
- Production impact: likely requires a deploy (real `server/src` changes), following this program's established predeploy-backup/deploy/production-acceptance discipline.
- Test requirements: full frozen regression + new negative tests for each closed gap (specifically: a reconciliation-path test, an SSRF-coverage test for the newly-gated `navigate()`, a manifest-consistency test that would fail if a `BACKGROUND`-kind surface claims `governanceRequired:true` without a real enforcement call site).
- Explicit exclusions: no new `ActionType`, no expansion of what Project planning or any candidate is *allowed* to do — this phase only closes gaps in what already exists.
- Stop conditions: same standing list as every prior phase in this program (authority drift, provenance mismatch, DB integrity failure, production outage, unexpected PM2 behavior, any change expanding recovery authority beyond reviewed design).

**9B — Operator Observability / Proactive Proposals (proposed, docs+code, no authority expansion)**
- Purpose: convert the currently pull-only governance signals (budget exhaustion, kill-switch state, policy drift, approval-waiting, delegation expiry, restart-storm/legacy-quarantine counts) into push/proactive **OBSERVE and ALERT** surfaces, and give SelfHeal's restart actions evidence-store-grade audit trail instead of console/in-memory only.
- Authority delta: **zero**. This phase is explicitly capped at OBSERVE/ALERT — no PROPOSE, no SIMULATE, no EXECUTE, per the directive's own stated preference order.
- Source changes expected: a notification/alert dispatch layer reading from `EvidenceService.health()` and `OperatorControlService`; persistent evidence recording for SelfHeal's restart attempts.
- Schema impact: possibly additive-only (a new evidence-adjacent table for SelfHeal actions) — to be scoped precisely if this phase is authorized, not assumed here.
- Production impact: requires a deploy.
- Test requirements: full frozen regression + coverage proving the new alert layer never triggers a mutation, only a notification.
- Explicit exclusions: no PROPOSE-level automation (nothing in this phase creates a new Controlled Action proposal on its own initiative), no autonomous execution.
- Stop conditions: same standing list.

No 9C–9G is proposed. The directive's letters are a template, not a requirement — there is no candidate today that justifies a "sandbox/credential readiness" phase (existing sandbox infrastructure for the 3 live-capable ActionTypes is already solid), no "one narrowly-selected capability implementation" phase (Section 26 selected NO NEW AUTHORITY, precisely because nothing outperforms it), and re-evaluating autonomy again immediately after 9A/9B would be premature — a future 9-series phase to re-run this same discovery process against whatever 9A/9B actually land as should be proposed *then*, with its own fresh audit, not pre-committed to here.

## Section 28/35 — Final required decision

```
PHASE 9 RECOMMENDATION:
NO NEW AUTHORITY
```

Reasoning, stated plainly: every one of the 19 scored candidates is either `NOT_READY`, `DEFAULT_DEFER`, or `DEFAULT_DENY`, except Project planning, which is `READY_FOR_PROPOSAL_ONLY` — and is *already operating at exactly that level in live production today*. There is nothing to implement to reach proposal-only; there is only a well-evidenced list of gaps (reconciliation, rollback, simulation fidelity, delegation disconnection) standing between proposal-only and the next tier, and closing those gaps is hardening work, not authority expansion. Two genuinely valuable, evidence-backed, zero-authority-delta phases (9A, 9B) are proposed above should the operator choose to authorize them; neither is started by this discovery, and neither is implied to be pre-approved.

## Section 36 — Principle check

What the system can do: propose (not execute) 3 governed external action types, entirely under human approval, with real policy/risk/budget/kill-switch/idempotency/evidence coverage. What it cannot do: send Gmail, write to Calendar outside sandbox mode, touch Drive at all, execute a financial transaction, write to a browser, control the desktop, push/merge/deploy code, or reconcile a failed mid-write action. What it is allowed to do today in production, unrelated to the governed framework: restart 5 named PM2 services, capped, under a manifest label that claims more governance than is actually enforced for that specific surface — now documented honestly rather than left as an unexamined assumption. Where authority begins and ends: begins at `ControlledActionService.propose()`, ends at `execute()` requiring a real human `approve()` in between, with the one narrow, pre-existing, non-`ActionType` exception of SelfHeal's PM2 restarts. How failure is contained: mostly well (fail-closed budgets, defense-in-depth policy re-checks, regression-locked quarantines for the legacy orchestration clusters) with one real, evidenced hole (reconciliation is unimplemented, both at the proposal and orchestration-step level). Whether one additional capability is genuinely worth trusting: no — not because nothing is close, but because the closest candidate is already running at the level the evidence supports, and pushing it further without first closing the reconciliation gap would be trusting a system to recover from a failure mode it currently has no code path to handle. **NO NEW AUTHORITY** is the evidence-driven answer, not a default.
