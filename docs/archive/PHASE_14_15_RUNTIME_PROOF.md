# PHASES 14 & 15 — HITL AUTONOMY + SAFE AUTONOMY: RUNTIME PROOF (REAL CODE)

**Generated:** 2026-06-28
**Status:** PHASE_14_EXECUTABLE · PHASE_15_EXECUTABLE
**Test results:** Phase 14 **28/28** · Phase 15 **26/26** · exit 0

---

## Phase 14 — Human-in-the-Loop Autonomy

Location: `agent-engine/phase-14-hitl-autonomy/`

| Module | Role |
|--------|------|
| RiskTierModel + ApprovalPolicy | Classifies an action into tier 0-3 → gate auto/approval (rules-driven, auditable) |
| ActionDraftEngine | Captures every proposed action before gating |
| ApprovalInbox | Pending/approved/rejected queue with approver + reason |
| RejectionLearning | Records rejections; recent rejection escalates LOW→approval |
| RollbackPlanEngine | Mandatory rollback plan for SEVERE actions |
| AuditTrail | Append-only per-draft event chain |
| HITLAutonomy (orchestrator) | propose → gate → enqueue/apply → approve/reject cycle |

6 directive scenarios proved: trivial auto-apply, low auto (unless recent rejection), moderate approval, severe + rollback plan, severe rejected→learned, learned gating forcing approval on a previously-rejected LOW type.

## Phase 15 — Safe Autonomy

Location: `agent-engine/phase-15-autonomous-ops/`

| Module | Role |
|--------|------|
| AutonomousActionRegistry | Whitelist of signatures Mi may run autonomously (with maxTier cap) |
| GuardrailEngine | Hard invariants (business hours, rate limit, maintenance) |
| KillSwitch | Global halt; when tripped, NO action executes |
| RollbackEngine | Runs a Phase 14 rollback plan + verifier on failure |
| AutonomyLog | Append-only execute/blocked/rolled-back/kill event log |
| SafeActionExecutor (orchestrator) | kill switch → whitelist → guardrails → run → on-throw rollback |

6 directive scenarios proved: happy-path execute, kill-switch halt, non-whitelisted block, guardrail (maintenance) block, tier-cap block, run-throws→rollback-invoked-and-verified.

---

## The full autonomy chain now exists (real code)

```
Phase 12  Self-Improving Intelligence   →  learns + recommends + playbooks
   │                                           (26/26)
   ▼
Phase 13  Multi-Agent Workforce          →  routes + reviews + hands off
   │                                           (19/19)
   ▼
Phase 14  HITL Autonomy                  →  risk gate + approval + rollback plan
   │                                           (28/28)
   ▼
Phase 15  Safe Autonomy                  →  whitelist + guardrails + kill switch
                                               (26/26)
```

All four share one portable persistence layer (`phase-12-.../src/store.js`).

## How to reproduce

```bash
node agent-engine/phase-14-hitl-autonomy/test/runtime-proof.mjs   # 28/28
node agent-engine/phase-15-autonomous-ops/test/runtime-proof.mjs  # 26/26
```

## Maturity impact

- **Autonomy (CTO score 25%):** now backed by a complete, audited, deterministic
  autonomy chain. The score is no longer "architecture on paper."
- **Operational Loop (CTO 65%):** the loop is now closed end-to-end in code.
- These four phases are the foundation the CTO required before 16-20 are anything
  more than paper.
