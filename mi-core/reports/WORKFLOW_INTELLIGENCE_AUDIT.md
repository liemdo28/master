# Workflow Intelligence Audit

Test: `node mi-core/tests/workflow-intelligence-proof-test.mjs` → **16/16 PASS** (runs the real Executive-Coordination functions for the CEO scenario).

## Capability checklist (against real source)

| Capability | Real implementation | Proven |
|---|---|---|
| receive objective | `objective-registry.createRegisteredObjective` | ✅ |
| classify objective | `priority-engine.autoClassify(title, desc)` | ✅ (priority + reason) |
| route to division | `division-router.routeTask(title, desc)` | ✅ (deterministic) |
| assign workforce | Phase 13 `MultiAgentWorkforce.dispatch` | ✅ (Phase 13, 19/19) — referenced |
| select OSS worker | — | ⚠️ **PARTIAL** — OSS not integrated (see OSS audit) |
| create task | `task-registry.createTask` | ✅ |
| detect duplicate | `duplicate-detector.detectDuplicates` | ✅ |
| detect dependency | `dependency-graph.buildEdges` / `topologicalOrder` / `getDownstream` | ✅ (no cycle, ordered) |
| require approval | `approval-registry` + Phase 14 + Phase 2D/2D+ | ✅ |
| store evidence | `evidence-registry.addEvidenceRecord` / `task.evidenceRefs` | ✅ |
| generate report | `executive-dashboard.buildDashboard` | ✅ |
| learn from result | Phase 12 `SelfImprovingIntelligence.learn` | ✅ (Phase 12, 26/26) — referenced |

## Runtime scenario: "Increase Raw Sushi online revenue 10%"

Executed end-to-end on real compiled code:

```
Executive Objective ("Increase Raw Sushi online revenue 10%")
  → autoClassify → priority + reason
  → Finance baseline      (routeTask → finance)      [FIN-1]
  → Marketing traffic     (routeTask → marketing)    [MKT-1, depends FIN-1]
  → DoorDash campaign     (routeTask → marketing*)   [OPS-1, depends MKT-1]
  → Creative asset request(routeTask → marketing)    [CRE-1, depends MKT-1, approvalRequired]
  → detectDuplicates      → re-submitted CRE task blocked as duplicate
  → topologicalOrder      → FIN-1 before MKT-1, no cycle
  → getDownstream(FIN-1)  → ≥2 dependent tasks (impact understood)
  → approval policy        → creative task gated; read-only analyses auto
  → evidence              → finance task carries an api-output evidence ref
  → executive report      → buildDashboard(tasks, objective)
  → learning memory       → Phase 12 records the outcome (referenced)
```

## Honest findings
- **Workflow intelligence = PARTIAL (real components, assembled).** Every step is a real, individually-proven function; this test wires the *coordination* steps (classify → route → dedup → dependency → approval → evidence → report) into one live run. The two cross-module steps (workforce assignment = Phase 13, learning = Phase 12) are proven in their own runtime tests and referenced, not re-executed in-process here.
- **Routing is keyword/heuristic, not semantic.** `routeTask` sent "DoorDash campaign performance" to **marketing** (campaign keyword) rather than operations. Acceptable but worth noting — true semantic routing is a future upgrade (the LangGraph/Phase 13 substrate).
- **"Select OSS worker" is not real yet** — OSS is governed but not integrated, so the workflow cannot pick an OSS worker at runtime. This is the same gap recorded in the OSS audit.
- **Not unattended.** By design, approval-gated steps stop for a human (Phase 14 / 2D). The workflow is intelligent and orchestrated, but not fully autonomous end-to-end without human approval — which is the intended safety posture, not a defect.

**Verdict: WORKFLOW_INTELLIGENT = PARTIAL (orchestration real and proven; OSS-worker selection and semantic routing pending).**
