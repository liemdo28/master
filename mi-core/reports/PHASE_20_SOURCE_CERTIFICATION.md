# Phase 20 — Autonomous Executive OS — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-20-autonomous-executive-os/src/` (`engines.js`, `orchestrator.js`) — reuses Phase 15 `KillSwitch` |
| **Runtime entrypoint** | `src/orchestrator.js` → `class CEOControlPanel` |
| **API route** | `GET /api/agent-os/20` (live summary → `dashboard()`) |
| **OSS used** | Temporal (orchestration), OpenFGA (cross-division authz) — **SELECTED, NOT_INTEGRATED** |
| **Division mapping** | Executive (primary) · All Divisions |
| **Input schema** | `setObjective({ title, budget, divisions[] })`; `runCycle(divisionSignals[])`; `dashboard()`; `haltCompany(reason)`; `resumeCompany()` |
| **Output schema** | `{ objective, plan{ selected[], deferred[], spend, totalExpectedReturn }, posture, killSwitchTripped }` · dashboard `{ posture, escalations, killSwitchTripped, ... }` |
| **Evidence produced** | exec-objective / exec-plan / exec-risk / exec-monitor / exec-optimizer stores |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **25/25 PASS** |
| **Status** | **READY** (engine + runtime) · certification-engine **PARTIAL** · OSS **PARTIAL** |

## Capabilities proven
- autonomous planning (greedy risk-adjusted ROI within budget; defers low-ROI) ✅
- executive risk posture (GREEN / AMBER / RED from worst + average) ✅
- continuous monitoring (ok/watch/alert/escalate verdicts; escalations queryable) ✅
- cross-division optimizer (rebalance within budget; efficiency = return/spend) ✅
- CEO control panel / unified dashboard ✅
- global kill switch (halt/resume company; reused from Phase 15; persists) ✅
- persistence across restart ✅

## Honest notes
- "Executive certification engine" is **PARTIAL**: the dashboard + posture provide the certification signal, but there is no standalone certification engine that emits a signed READY/BLOCKED verdict.
- Capstone reuse of Phase 15 `KillSwitch` is verified by import — one command halts the whole company.
