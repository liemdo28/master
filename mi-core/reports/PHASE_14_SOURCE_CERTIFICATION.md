# Phase 14 — Human-in-the-Loop Autonomy — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-14-hitl-autonomy/src/` (`policy.js`, `engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class HITLAutonomy` |
| **API route** | `GET /api/agent-os/14` (live summary → `pending()`) |
| **OSS used** | Temporal (durable approval workflow), Keycloak (approver identity/RBAC) — **SELECTED, NOT_INTEGRATED** |
| **Division mapping** | Executive (primary) · Operations · Finance |
| **Input schema** | `propose(action{ id?, type, summary, meta, proposedBy, source })`; `approve(approvalId, { approver, reason })`; `reject(approvalId, { approver, reason })` |
| **Output schema** | `{ draft, policy{ tier, gate, why, requiresRollbackPlan }, inboxItem, rollbackPlan, autoApplied }` |
| **Evidence produced** | drafts store, audit-trail store, rejection-learning store, inbox store |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **28/28 PASS** |
| **Status** | **READY** (engine + runtime) · OSS **PARTIAL** |

## Capabilities proven
- approval policy + risk tiers (TRIVIAL/LOW/MODERATE/SEVERE) ✅
- action drafts ✅ · approval inbox (pending/decide) ✅
- rejection learning (a recent rejection re-gates a LOW action to approval) ✅
- audit trail (every row has id+timestamp+draftId; drafted→gated→applied/enqueued/approved/rejected) ✅
- rollback plan required for SEVERE (≥2 steps) ✅
- persistence across restart (drafts, audit, rejections) ✅

## Honest notes
- The orchestrator **never executes** the side effect — it produces a fully audited decision for Phase 15 to act on.
- Identity is modelled in-engine (`proposedBy`/`approver`); Keycloak/Temporal are the governed-but-unwired production substrate.
