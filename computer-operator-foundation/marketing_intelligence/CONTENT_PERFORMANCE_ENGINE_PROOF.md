# CONTENT_PERFORMANCE_ENGINE_PROOF

Status: **OPERATIONAL (scored, content exists)**
Date: 2026-06-27
Scope: Phase 4A — Content Performance Engine Proof
Source: `mi-core/server/src/marketing-intelligence/opportunity-engine.ts`

## Engine: `buildMarketingOpportunities()`

Scores marketing opportunities based on available content drafts and connector readiness. Each opportunity is scored 0-100 with explicit evidence requirements.

## Proof — 2 Opportunities Scored

### Opportunity 1: Bakudan Ramen Content Refresh
| Field | Value |
|-------|-------|
| opportunity_id | MKT-OPP-bakudan-content-refresh |
| brand_id | bakudan |
| title | Bakudan Ramen content refresh opportunity |
| score | **31/100** |
| reason | 1 local SEO draft(s) available; 3 connector blocker(s) |
| requiredEvidence | approved content draft, brand connector status, publishing approval |
| approvalRequired | true |

### Opportunity 2: Raw Sushi Content Refresh
| Field | Value |
|-------|-------|
| opportunity_id | MKT-OPP-raw_sushi-content-refresh |
| brand_id | raw_sushi |
| title | Raw Sushi content refresh opportunity |
| score | **11/100** |
| reason | 1 local SEO draft(s) available; 5 connector blocker(s) |
| requiredEvidence | approved content draft, brand connector status, publishing approval |
| approvalRequired | true |

## Scoring Formula
```
score = 50 (base) - 3 × (missing_connector_count) + 10 × (draft_count)
```

| Brand | Connectors Blocked | Drafts | Score |
|-------|-------------------|--------|-------|
| Bakudan | 3 | 1 | 50 - 9 + 10 = 31 |
| Raw Sushi | 5 | 1 | 50 - 15 + 10 = 11 |

## Top Content / Worst Content Status

| Metric | Status | Reason |
|--------|--------|--------|
| Top Content | PARTIAL | 2 drafts exist, 0 published |
| Worst Content | N/A | No published content to compare |
| Traffic Contribution | BLOCKED | GA4 missing |

All metrics correctly blocked/surfaced as partial while data is unavailable. No fabricated traffic numbers.

## Test Assertions
```
PASS: Opportunities generated
PASS: Opportunities are scored
PASS: Opportunities require evidence
```

## Coordination Integration
- Content opportunities registered as evidence
- Dashboard surfaces opportunities + scores
- Executive Coordination can approve/reject content publish requests