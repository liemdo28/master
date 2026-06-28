# Phase 12 — Self-Improving Intelligence — Source Certification

| Field | Value |
|---|---|
| **Source path** | `agent-engine/phase-12-self-improving-intelligence/src/` (`memories.js`, `decision-replay.js`, `root-cause.js`, `recommendation.js`, `playbook.js`, `store.js`, `orchestrator.js`) |
| **Runtime entrypoint** | `src/orchestrator.js` → `class SelfImprovingIntelligence` |
| **API route** | `GET /api/agent-os/12` (live summary → `scorecard()`) |
| **OSS used** | Langfuse (trace/eval memory), Qdrant (replay vector store) — **SELECTED, NOT_INTEGRATED** (engine uses local JsonStore + token match) |
| **Division mapping** | Intelligence (primary) · IT · Engineering |
| **Input schema** | `learn({ actionId, actionType, symptom, signal?, context? })`; `observeOutcome(o)`; `observeApproval(a)` |
| **Output schema** | `{ failure, replay, rca, recommendation, playbook }`; `scorecard()` → `{ failuresAnalyzed, outcomesStored, approvalsLearned, playbooksGenerated, recommendationsGenerated, rcaPatternsFound, replaysRun, topBucket }` |
| **Evidence produced** | `failure-memory.json`, `learning-scorecard.json`, RCA/recommendation/playbook stores (portable JSON, survive restart) |
| **Runtime test file** | `test/runtime-proof.mjs` |
| **Test result** | **26/26 PASS** (verified via `phase12-20-functional-proof-test.mjs`) |
| **Status** | **READY** (engine + runtime) · OSS **PARTIAL** (governed/mapped, not integrated) |

## Capabilities proven (from runtime-proof checks)
- outcome memory ✅ · failure memory ✅ · approval memory ✅
- decision replay (match score ≥70 HIGH) ✅
- root-cause engine (5-Whys, bucketing: external_dependency / data_freshness) ✅
- recommendation engine (confidence-scored, evidence-backed) ✅
- playbook engine (≥2 concrete steps) ✅
- persistence across process restart ✅

## Honest notes
- Phase 12 **only learns and recommends** — it never mutates production (verified: no side-effect handlers in source).
- OSS substrate (Langfuse/Qdrant) is evaluated, licensed, and owner-assigned in `reports/data/phase-12-20-oss-manifest.json` but is **not wired into the engine**. Replay similarity is currently an in-engine token/Jaccard match, not a vector DB.
