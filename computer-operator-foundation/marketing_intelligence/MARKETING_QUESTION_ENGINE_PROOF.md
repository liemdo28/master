# MARKETING_QUESTION_ENGINE_PROOF

Status: **OPERATIONAL**
Date: 2026-06-27
Scope: Phase 4A — Marketing Question Engine Proof
Source: `mi-core/server/src/marketing-intelligence/question-engine.ts`

## Engine: `answerMarketingIntelligenceQuestion()`

Answers CMO questions with evidence-based confidence. All answers preserve `noFakeMetrics=true` and include explicit warnings about blockers.

## Proof — 2 Questions Answered

### Q1: "What is top marketing opportunity?"
| Field | Value |
|-------|-------|
| answered | **true** |
| question | What is top opportunity? |
| answer | Top marketing opportunity is Bakudan Ramen content refresh opportunity with score 31. |
| warnings | GBP credentials missing, GA4 property/config incomplete, GSC credentials missing, approval required |
| noFakeMetrics | **true** |

### Q2: "Can we launch campaigns now?"
| Field | Value |
|-------|-------|
| answered | **true** |
| question | Can we launch campaigns now? |
| answer | 0 campaign(s) can launch now. Approval and connector blockers prevent automatic launch. |
| warnings | GBP credentials missing, GA4 property/config incomplete, GSC credentials missing, approval required |
| noFakeMetrics | **true** |

## CMO Question Coverage Matrix

| CMO Question | Answerable | Confidence |
|-------------|-----------|------------|
| What channel drives most traffic? | PARTIAL | GSC only (GA4 blocked) |
| Which campaign performs best? | BLOCKED | No live campaigns |
| Which content generates revenue? | BLOCKED | No revenue attribution |
| Why did traffic drop? | PARTIAL | GSC trends only |
| What is top marketing opportunity? | **ANSWERABLE** ✅ | Scored (31/100) |
| Can we launch campaigns now? | **ANSWERABLE** ✅ | No (approval-gated) |

## No Fake Metrics Enforcement
- `noFakeMetrics` flag is `true` on EVERY answer
- Blocked questions correctly return BLOCKED/PARTIAL status
- Partial answers include explicit warnings about missing data sources
- No fabricated traffic/revenue/conversion numbers

## Test Assertions
```
PASS: Opportunity question answered
PASS: Launch question answered
PASS: No fake metrics flag preserved
```

## Coordination Integration
- Question answers registered as evidence
- Dashboard exposes marketing question examples
- Executive Coordination can route follow-up questions to Marketing Division