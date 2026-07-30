# EXECUTIVE INTELLIGENCE BENCHMARK — Phase 21I

## Purpose
Validate Mi’s executive intelligence across 50 scenarios in 8 business categories.

## Categories (50 Scenarios)
| Category | Scenarios | Coverage |
|----------|-----------|----------|
| Operations | 7 | System health, service status, errors, emergencies |
| Finance | 7 | Revenue drops, costs, margins, investment decisions |
| Engineering | 7 | API errors, deployments, databases, code quality |
| Infrastructure | 6 | PM2, connectors, nodes, disk, SSL |
| Restaurant | 6 | Food safety, staffing, reviews, inventory, expansion |
| Marketing | 6 | SEO, social, campaigns, reviews, brand |
| Compliance | 6 | Licenses, insurance, inspections, regulations |
| Strategy | 5 | Focus, trends, expansion, priorities |

## Scoring Dimensions
1. **Intent Understanding** (30%) — Correct intent category identified
2. **Planning Quality** (20%) — Correct processing mode selected
3. **Reasoning Quality** (20%) — Brief has sections, actions, risks, adequate length
4. **Reflection Quality** (15%) — Confidence meets minimum threshold
5. **Decision Quality** (15%) — Required content present in brief

## Certification Thresholds
- **EXECUTIVE_INTELLIGENCE_OPERATIONAL**: Overall >= 75%, Pass rate >= 80%
- **EXECUTIVE_INTELLIGENCE_PARTIAL**: Overall >= 50%
- **EXECUTIVE_INTELLIGENCE_INSUFFICIENT**: Overall < 50%

## Test Cases Include
- Vietnamese ambiguous messages: "Có vế chạm quá", "Mối lo lộn nhất?"
- English ambiguous: "Something feels wrong today", "Are we okay?"
- Specific technical: "API is returning 500 errors"
- Business signals: "Revenue down 12%", "Lố quá nhiều tiển"
- Strategic: "Should we expand to new city?"
- Emergency: "Process crashed紧急"

## Files
- `server/src/executive-intelligence/executive-intelligence-benchmark.ts`

## Status: IMPLEMENTED ✅
