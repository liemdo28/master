# Phase 13 — Multi-Agent Workforce — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-13-multi-agent-workforce/src/` (`team.js`, `engines.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class MultiAgentWorkforce` |
| **API route** | `GET /api/agent-os/13` (live summary → `scorecard()`) |
| **OSS used** | LangGraph (multi-agent orchestration / handoff graph) — **SELECTED, NOT_INTEGRATED** |
| **Division mapping** | Engineering (primary) · Operations · Marketing · Creative |
| **Input schema** | `dispatch(task{ id, capability, ... })`; `peerReview({ taskId, workAgentId, reviewerAgentId, score, verdict, notes })`; `escalateAfterFail(task, failedAgentId, reviewerAgentId, notes)`; `resolveResourceConflict(claims[])` |
| **Output schema** | `{ routed, agent, reason }` · review record · `{ reDispatch, handoff }` · conflict resolution (`winner`, `losers`) |
| **Evidence produced** | team registry store, review store, handoff store (JSON, survive restart) |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **19/19 PASS** |
| **Status** | **READY** (engine) · evidence-chain **PARTIAL** · OSS **PARTIAL** |

## Capabilities proven
- agent team registry (4 agents) ✅ · capability+load routing ✅
- handoff engine (re-dispatch to a different free agent) ✅
- conflict engine (priority winner, recorded loser) ✅
- review engine (peer review recorded, scorecard updated) ✅
- performance scorecard ✅ · persistence across restart ✅

## Honest notes
- "Evidence chain" is **PARTIAL**: review + handoff records exist and persist, but there is no cryptographically-signed chain — that would arrive with the LangGraph/observability integration.
- Phase 13 models assignment/review/handoff only; safe execution is Phase 14/15 (verified: no production side-effects in source).
