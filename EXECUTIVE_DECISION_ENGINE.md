# EXECUTIVE DECISION ENGINE — Phase 21F

## Purpose
Prioritize issues and recommend decisions based on multi-factor impact analysis.

## Architecture
- 7 impact dimensions with weighted scoring
- Time sensitivity multipliers
- Effort penalties for resource allocation
- Reversibility bonus for safe-to-act decisions

## Impact Dimensions & Weights
| Dimension | Weight |
|-----------|--------|
| revenue | 0.25 |
| operational | 0.20 |
| customer | 0.20 |
| compliance | 0.15 |
| strategic | 0.10 |
| technical | 0.05 |
| reputational | 0.05 |

## Scoring Model
```
weighted_sum = Σ(impact_score × dimension_weight)
base = weighted_sum / total_weight
× time_sensitivity_multiplier (immediate: 1.5, this_week: 1.2, this_month: 1.0, whenever: 0.8)
× (1 - effort_penalty) (trivial: 0, small: 0.05, medium: 0.10, large: 0.20, massive: 0.35)
× data_confidence
× (1.1 if reversible)
= composite_score (capped 0-1.0)
```

## Priority Levels
- critical: ≥ 70% — CEO must handle immediately
- high: ≥ 50% — Should handle this week
- medium: ≥ 30% — Schedule this month
- low: < 30% — Handle when free, or delegate

## Output
DecisionMatrix with prioritized issues, recommended CEO focus areas, and formatted brief.

## Files
- `server/src/executive-intelligence/executive-decision-engine.ts`

## Status: IMPLEMENTED ✅
