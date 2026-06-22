# MI Store Intelligence Report — Dev 3 Phase 2
**Date:** 2026-06-12 | **Phase:** Dev 3 Phase 2 — Mi Executive Assistant Intelligence

## Status: PASS ✅

## Module: Store Intelligence

**Location:** `mi-core/server/src/intelligence/store-intelligence.ts`

### Stores

| Store ID | Name | Location | Type |
|----------|------|----------|------|
| `bakudan` | Bakudan Ramen | San Antonio, TX | ramen |
| `raw-sushi` | Raw Sushi Bar | Stockton, CA | sushi |

### Health Scoring

| Dimension | Weight | Source |
|-----------|--------|--------|
| Operational score | 40% | POS baseline (95 default) |
| Food safety score | 40% | `.local-agent-global/visibility/food-safety/data.json` |
| Compliance score | 20% | Derived from issues count |

### Skills

#### `store-intelligence` — Full Report
- Trigger: `/store.*intelligence|so sánh.*store|compare.*store|store.*health|tất cả.*cửa hàng|all.*store/i`
- Returns comparison + compliance for all stores

#### `store-compare` — Side-by-side Comparison
- Trigger: `/so sánh.*bakudan.*raw|compare.*bakudan.*raw|bakudan vs raw|which store|store.*compare/i`

### Live Response (2026-06-12 snapshot)

```
🏪 *Store Comparison*

*Bakudan Ramen* (San Antonio, TX)
  Overall:    ████████░░ 77/100
  Operations: ██████████ 95/100
  Food Safety:██████░░░░ 60/100
  Compliance: ████████░░ 75/100
  Issues: Food safety pilot not started

*Raw Sushi Bar* (Stockton, CA)
  Overall:    ████████░░ 77/100
  Operations: ██████████ 95/100
  Food Safety:██████░░░░ 60/100
  Compliance: ████████░░ 75/100
  Issues: Food safety pilot not started

🏆 Leading store: *Bakudan Ramen*

📋 *Improvement areas*
Bakudan Ramen: Food safety checks, Compliance documentation
Raw Sushi Bar: Food safety checks, Compliance documentation

📋 *Compliance Status*
⚠️ *Bakudan Ramen* — San Antonio, TX
  Food Safety: Pilot pending
  Health Code: Monitoring active
  Employee Records: On file
  Equipment Checks: Scheduled
  Overall: NEEDS ATTENTION
  Notes: Critical: food safety score below threshold

⚠️ *Raw Sushi Bar* — Stockton, CA
  Food Safety: Pilot pending
  Health Code: Monitoring active
  Employee Records: On file
  Equipment Checks: Scheduled
  Overall: NEEDS ATTENTION
  Notes: Critical: food safety score below threshold
```

### Current Findings

- Both stores at 77/100 overall — tied (Bakudan wins tiebreaker as first defined)
- Food safety score is 60/100 on both — pilot not yet active
- **Action required:** Start Food Safety OCR pilot for both stores to improve score baseline
- Operational score at 95 — no POS issues reported

### Test Results

```
PASS P4: store-intelligence               | intent: skill_store-intelligence
PASS P4: store-compare                    | intent: skill_store-compare
PASS P4: compliance report includes both stores (Bakudan in reply)
```
