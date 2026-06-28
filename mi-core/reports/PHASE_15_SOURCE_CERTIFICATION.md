# Phase 15 — Safe Autonomous Business Ops — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-15-autonomous-ops/src/` (`engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class AutonomousOps extends SafeActionExecutor` |
| **API route** | `GET /api/agent-os/15` (loadable; summary = API surface) |
| **OSS used** | OPA (guardrail policy), Vault (secrets), OpenObserve (autonomy log) — **SELECTED, NOT_INTEGRATED** |
| **Division mapping** | IT (primary) · Operations · Executive |
| **Input schema** | `execute(approved{ signature, tier, ctx, run, rollbackPlan, onRollback, verify })`; `tripKillSwitch(reason)`; `clearKillSwitch()` |
| **Output schema** | `{ executed, reason?, guardResult?, rollbackResult? }` |
| **Evidence produced** | autonomy-log store, action-registry store, kill-switch state (persist across restart) |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **26/26 PASS** |
| **Status** | **READY** (engine) · autonomy-scorecard **PARTIAL** · OSS **PARTIAL** |

## Capabilities proven (enforcement order)
1. kill switch OFF (else block + log) ✅
2. action whitelisted in registry (else `not-whitelisted`) ✅
3. all guardrails pass (else `guardrail-failed` + failing guard listed) ✅
4. tier cap enforced ✅
5. run() throws → rollback engine invoked + verifier + `rolled-back` log ✅
- autonomy log (every row id+timestamp+event), persistence across restart ✅

## Honest notes
- The executor is a pure **choke point**: it only orchestrates handlers the operator injects (`run`, `onRollback`, `verify`) — it never reaches into real systems itself (verified in source).
- "Autonomy scorecard" is **PARTIAL**: the autonomy **log** is complete and queryable, but there is no aggregate scorecard method yet.
