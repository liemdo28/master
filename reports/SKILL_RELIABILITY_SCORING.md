# Skill Reliability Scoring
**Module:** DEV3 Phase 11.6  
**Date:** 2026-06-13  
**Status:** PRODUCTION_READY  
**File:** `mi-core/server/src/gstack/skills/skill-reliability-tracker.ts`

---

## Objective

Every skill execution is recorded. From the execution history, a reliability score (0–100) is computed per skill. This score feeds into the Dynamic Skill Selector — skills with low reliability are ranked lower and may be replaced by alternatives.

---

## Score Formula

```
score = (success_rate × 80) + speed_bonus

speed_bonus = 20 × max(0, 1 - max(0, avg_duration_ms - 2000) / 28000)
            = 20pts  if avg < 2s
            = 0pts   if avg > 30s
```

| Component | Weight | Meaning |
|-----------|--------|---------|
| Success rate | ×80 | Primary signal — does the skill work? |
| Speed bonus | up to 20 | Secondary signal — is it fast? |

---

## Scores from First Run (WO-20260613-027)

| Skill | Executions | Pass Rate | Avg Duration | Score |
|-------|-----------|-----------|-------------|-------|
| health | 2/2 | 100% | ~921ms | **100** |
| source_scan | 2/2 | 100% | ~0ms | **100** |
| pm2_status | 1/1 | 100% | ~0ms | **100** |
| regression_suite | 1/1 | 100% | ~0ms | **100** |

**Note:** Duration recorded as 0ms for skills executed within the engineering manager (duration not separately tracked per-task). Health skill duration captured accurately at 921ms — 3 HTTP checks in parallel.

---

## Execution Record Schema

```json
{
  "skill_id": "health",
  "version": "1.0.0",
  "work_order_id": "WO-20260613-027",
  "executed_at": "2026-06-13T10:30:00Z",
  "success": true,
  "duration_ms": 921
}
```

---

## ReliabilityScore Object

```typescript
{
  skill_id: "health",
  score: 100,
  execution_count: 2,
  success_count: 2,
  failure_count: 0,
  success_rate: 1.0,
  avg_duration_ms: 921,
  last_executed: "2026-06-13T10:30:00Z",
  last_success: "2026-06-13T10:30:00Z",
  last_failure: undefined
}
```

---

## Default Score for Unexecuted Skills

Skills with no execution history get a default score of **75** — above the mid-point to avoid penalizing new skills before they've been tested.

---

## Storage

```
.local-agent-global/skills/metrics.json
```

Keeps last 1000 execution records. Older records are pruned automatically.

---

## Integration with Dynamic Selector

When ranking skills for an intent, the selector adds `reliability_score / 10` to the match score. A skill with score 100 gets +10 bonus; a skill with score 40 gets +4. Over time, unreliable skills naturally rank lower and are replaced by working alternatives in the skill chain.
