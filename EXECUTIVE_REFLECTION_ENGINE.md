# EXECUTIVE REFLECTION ENGINE — Phase 21C

## Purpose
Question conclusions BEFORE reporting to CEO. Never report with false confidence.

## Architecture
- Evidence quality assessment (strong/moderate/weak/absent)
- Assumption identification and impact analysis
- Alternative explanation generation
- Risk identification per assumption
- Missing evidence detection
- Blind spot enumeration
- Confidence calculation with penalties

## Confidence Calculation
```
base_score (from evidence quality)
- assumption_penalty (0.05 per assumption, max 0.30)
- alternative_penalty (0.07 per alternative, max 0.20)
- risk_penalty (0.03 per risk, max 0.15)
= final_confidence (min 0.05)
```

## Confidence Levels
- very_high: ≥ 85%
- high: ≥ 70%
- moderate: ≥ 50%
- low: ≥ 30%
- very_low: < 30%

## Reflection Questions Bank
4 categories × 5 questions each:
1. **Evidence**: source quality, freshness, corroboration
2. **Assumptions**: taken-for-granted, past patterns, causation vs correlation
3. **Alternatives**: opposite scenarios, simpler explanations, confirmation bias
4. **Impact**: cost of being wrong, reversibility, urgency

## Output
```typescript
interface ReflectionResult {
  overall_confidence: number;
  assumptions: ReflectionAssumption[];
  risks: ReflectionRisk[];
  alternative_explanations: AlternativeExplanation[];
  recommendation_to_ceo: {
    should_act: boolean;
    urgency: 'immediate' | 'can_wait' | 'needs_more_info';
  };
}
```

## Files
- `server/src/executive-intelligence/executive-reflection.ts`

## Status: IMPLEMENTED ✅
