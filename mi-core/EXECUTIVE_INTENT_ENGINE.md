# EXECUTIVE INTENT ENGINE — Phase 21A

## Purpose
Understand what the CEO actually wants, even from ambiguous statements.

## Architecture
- Keyword lexicon covering 12 intent categories (Vietnamese + English)
- Ambiguity detection via pattern matching
- Confidence scoring per hypothesis
- Alternative intent ranking

## Intent Categories
1. `operational_concern` — system issues, service problems
2. `revenue_concern` — financial drops, cost increases
3. `risk_concern` — compliance, legal, security threats
4. `service_degradation` — slow performance, latency
5. `strategic_question` — expansion, investment decisions
6. `compliance_concern` — licenses, permits, regulations
7. `people_concern` — staffing, HR issues
8. `technology_concern` — server, database, code issues
9. `marketing_concern` — campaigns, SEO, reviews
10. `general_status_check` — health, status queries
11. `urgent_intervention` — emergency situations
12. `performance_review` — KPIs, evaluations

## Ambiguity Detection
Handles vague CEO messages like:
- "Something feels wrong today"
- "Are we okay?"
- "What should I focus on?"

## Output Format
```typescript
interface IntentAnalysis {
  raw_message: string;
  is_ambiguous: boolean;
  primary_intent: IntentHypothesis;
  alternatives: IntentHypothesis[];
  recommended_entry_point: string;
  confidence_threshold_met: boolean;
}
```

## Files
- `server/src/executive-intelligence/executive-intent-engine.ts`

## Status: IMPLEMENTED ✅