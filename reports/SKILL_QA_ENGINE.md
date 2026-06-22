# Skill QA Engine
**Module:** DEV3 Phase 12.1  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-qa-engine.ts`

---

## Objective

Evaluate each skill's quality across 5 dimensions: execution success rate, average duration, failure rate, confidence score, and evidence quality. Produces a structured `SkillQAEvaluation` per skill stored in `.local-agent-global/skills/qa-evaluations.json`.

---

## Evaluation Dimensions

| Dimension | Source | Weight in QA Score |
|-----------|--------|--------------------|
| Success rate | metrics.json | 60% |
| P95 response time | metrics.json | 25% (speed) |
| Duration consistency | avg vs p95 ratio | 15% |
| Confidence | execution count (÷50) | Dampening factor |
| Evidence quality | executions + success rate | Label only |

---

## QA Score Formula

```
qa_score = successRate × 60
         + speedScore   (0–25: full at p95 < 3s, zero at > 30s)
         + consistencyScore (0–15: avg/p95 ratio)

# Confidence dampening (low execution count → score pulled toward 50)
qa_score = qa_score × (confidence/100) + 50 × (1 - confidence/100)
```

**Confidence** = `min(100, execution_count × 2)` — reaches 100% at 50 executions.

---

## QA Grade Table

| Score | Grade | Interpretation |
|-------|-------|---------------|
| ≥95 | **S** | Elite — consistently fast and reliable |
| ≥85 | **A** | High quality |
| ≥75 | **B** | Good — minor issues |
| ≥60 | **C** | Acceptable — needs monitoring |
| ≥45 | **D** | Degraded — investigate |
| <45 | **F** | Failing — disable or fix urgently |

---

## Evidence Quality Labels

| Label | Condition |
|-------|-----------|
| NONE | 0 executions |
| LOW | <5 executions OR <10 with low success |
| MEDIUM | ≥10 executions, success ≥70% |
| HIGH | ≥20 executions, success ≥90% |

---

## Acceptance Test Results (300+ executions accumulated)

| Skill | Grade | Score | Success Rate | P95 | Evidence Quality |
|-------|-------|-------|-------------|-----|-----------------|
| health | **S** | 95 | 98.4% | 598ms | HIGH |
| pm2_status | **S** | 96 | 100.0% | 245ms | HIGH |
| source_scan | **A** | 93 | 93.5% | 1536ms | HIGH |
| dashboard_audit | **A** | 93 | 95.0% | 1112ms | HIGH |
| regression_suite | **A** | 89 | 88.5% | 4042ms | HIGH |

---

## Storage

```
.local-agent-global/skills/qa-evaluations.json
```

Updated on every `evaluateSkill()` call. Downstream consumers: Trust Score engine, dynamic selector.
