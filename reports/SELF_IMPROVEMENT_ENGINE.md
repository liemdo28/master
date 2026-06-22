# SELF_IMPROVEMENT_ENGINE — Phase 22
**Target:** SELF_IMPROVEMENT_READY ✅

## What It Does
Mi analyzes its own execution history to identify what's working and what isn't.
Answers: "Skill nào hiệu quả nhất?", "Owner nào đang bị overload?", "Flow nào cần cải thiện?"

## Functions

| Function | Returns |
|----------|---------|
| `getSkillEffectiveness(days)` | Per-skill: usage count, pass rate, avg duration, trend |
| `getWorkflowPatterns(days)` | Common action sequences, bottleneck detection |
| `getOwnerPerformance(days)` | Per-owner: actions, pass rate, recent trend |
| `generateInsights(skills, owners)` | Ranked improvement suggestions |
| `generateSelfImprovementReport(days)` | Full report: score 0-100 + all insights |

## Improvement Score (0-100)
- 80-100: Excellent — system is self-optimizing
- 60-79: Good — minor improvements possible
- 40-59: Moderate — several patterns need attention
- <40: Needs attention — significant inefficiencies detected

## Insight Types
- `skill_highly_effective` — skill with >80% pass rate, promote usage
- `skill_needs_review` — skill with <50% pass rate, review logic
- `owner_overloaded` — single owner >70% of all actions
- `workflow_bottleneck` — action type appearing as repeated blocker

## API Routes
```
GET /api/improvement/report?days=30
GET /api/improvement/skills?days=30
GET /api/improvement/owners?days=30
GET /api/improvement/workflows?days=30
```
