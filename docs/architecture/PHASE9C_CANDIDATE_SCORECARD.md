# Phase 9C — Candidate Scorecard (Post-9A/9B)

## Project planning re-evaluation

Independently confirmed via `git diff 8a5f422f..2e86ca0a -- server/src/personal-os/orchestration/ server/src/personal-os/delegation/ server/src/personal-os/automation-simulation/ server/src/personal-os/actions/` (the Phase-9-discovery-merge SHA through current) → **empty output.** Neither Phase 9A nor Phase 9B touched orchestration, delegation, simulation, or the Controlled Action framework at all. Directly re-verified on current master rather than assumed from the zero-diff alone:

- **Delegation wiring**: `grep -n "new GovernedOrchestrationService(" jarvis-gateway/services.ts orchestration/router.ts orchestration/cli.ts` — all 3 still construct with zero arguments. Still disconnected from every live caller.
- **Reconciliation**: `RECONCILIATION_REQUIRED` — 0 matches in `orchestration/service.ts`. `RECOVERY_REQUIRED` — 0 matches in `actions/service.ts`. Still declared, never set.
- **Compensation/rollback**: unchanged — `compensationFor()` still writes static descriptive metadata only, no code path transitions it to `PROPOSED`/`COMPLETED`.
- **Simulation parity**: unchanged — `AutomationSimulationService` still reimplements decision-interpretation and payload construction separately from real `advance()`/`normalizePayload()`.
- **Planning-specific policy**: unchanged — still generic per-action-type, no plan-aware rule dimension.
- **Operator visibility**: unchanged for planning itself (`/operator/authority`, Plans/PlanDetail Command Center pages); Phase 9B added a *separate* visibility surface for background workers, not for orchestration/planning.

**Classification: `READY_FOR_PROPOSAL_ONLY`, unchanged.** Neither improved nor regressed, because nothing touched the code this classification depends on. The same 4 (now well-documented) gaps stand between it and the next tier.

## Candidate re-scoring

| Candidate | Change since Phase 9 discovery/9F | Classification |
|---|---|---|
| **Project planning** | None (zero diff, independently confirmed) | `READY_FOR_PROPOSAL_ONLY` |
| **Proactive operational proposal** | Phase 9B added OBSERVE/ALERT visibility (background-worker status, restart eligibility, kill-switch state) but explicitly no PROPOSE-level capability — confirmed: `operator-control/service.ts`'s new method is read-only, no proposal-creation code path | `READY_FOR_SIMULATION` at best for the *visibility* layer only — no proposal-creation capability exists anywhere to score higher |
| **Service restart** | Phase 9A added real behavioral constraints (intentional-stop exclusion, kill-switch gate) to the one worker that already had this capability (`self-healing-monitor`). This is hardening of an *existing* capability, not new authority, and does not change its classification as a candidate for *expansion* | `NOT_READY` to expand beyond current narrow, fixed-allowlist scope |
| **Orphan-process remediation** | No change. Still deliberately, tested-ly absent (`phase7g-boot-preflight.test.ts:38` still passes, still proves nothing kills the process holding a port) | `DEFAULT_DENY` (as autonomous) |
| **Gmail draft update** | No change — still not implemented (update operation doesn't exist) | `NOT_READY` |
| **Calendar update** | No change — still not implemented (legacy path still dead) | `NOT_READY` |
| **Drive write** | No change — still no `ActionType`, no live code path | `NOT_READY` |
| **Browser write** | No change — still a hard `denyAuthorityMutation` stub | `DEFAULT_DEFER` |
| **Shell/process** | No change to the canonical hard-allowlisted paths. **New finding this phase**: `qb-online-watcher.ts` is a *real*, ungoverned external-mutation path independent of "shell/process" in the traditional sense — a DB-insert-triggers-remote-execution pattern, now classified `QUARANTINED` (see `PHASE9C_BACKGROUND_WORKER_REASSESSMENT.md`) | `NOT_READY` to expand; the qb-online-watcher finding is a *new* risk surfaced, not new authority requested |
| **Git push** | No change — still absent everywhere, regression-locked | `DEFAULT_DEFER` |
| **PR creation** | No change — still absent everywhere | `DEFAULT_DEFER` |
| **Merge/deploy** | No change — still entirely manual, human-run throughout this whole program | `DEFAULT_DENY` |

## Comparison against NO NEW AUTHORITY

Per the required comparison axes (blast radius, reversibility, governance maturity, sandboxability, evidence, reconciliation, operator visibility, failure containment):

No candidate clearly beats `NO NEW AUTHORITY` on this pass either. Project planning remains the closest, unchanged and already discussed at length in Phase 9F/9 discovery. The one genuinely new signal this phase surfaced — `qb-online-watcher`'s idempotency gap — argues in the *opposite* direction from authority expansion: it demonstrates that an *existing*, already-unattended external-mutation path has a real reliability gap, which is evidence *for* hardening existing capability, not for adding new capability. A candidate that would clearly beat `NO NEW AUTHORITY` would need to score better on every one of the 8 axes than Project planning already does while also closing its 4 known gaps — no such candidate exists in this scorecard.

**No candidate outperforms `NO NEW AUTHORITY` this pass.**
