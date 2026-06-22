# BUSINESS REASONING ENGINE \u2014 Phase 21D

## Purpose
Think like a business operator. Not just report data \u2014 analyze causes and recommend actions.

## Architecture
- Signal-based hypothesis generation
- 14 business dimensions analyzed
- Multi-dimensional probability ranking
- Evidence-backed recommendations

## Business Dimensions
1. traffic \u2014 website/app visitor volume
2. conversion \u2014 visitor-to-customer rate
3. aov \u2014 average order value
4. reviews \u2014 customer feedback quality
5. campaigns \u2014 marketing campaign performance
6. competition \u2014 competitor activities
7. operations \u2014 supply chain, inventory, fulfillment
8. labor \u2014 staffing, scheduling, training
9. seasonality \u2014 time-based demand patterns
10. pricing \u2014 price competitiveness and margins
11. product \u2014 product quality and appeal
12. location \u2014 geographic factors
13. technology \u2014 system reliability and UX
14. compliance \u2014 regulatory adherence

## Signal Types
### Revenue Drop
10 hypotheses: traffic, conversion, AOV, seasonality, competition, reviews, operations, pricing, marketing, labor

### Complaint Spike
3 hypotheses: service quality, product quality, technology issues

### Cost Increase
3 hypotheses: ingredient costs, labor costs, waste/inefficiency

## Probability Model
- Dynamic probability based on signal magnitude
- Weighted by dimensional relevance
- Ranked by composite score

## Output
- Ranked hypotheses with probability scores
- Top 3 recommended actions
- Data needed to verify each hypothesis

## Files
- `server/src/executive-intelligence/business-reasoning-engine.ts`

## Status: IMPLEMENTED \u2705
