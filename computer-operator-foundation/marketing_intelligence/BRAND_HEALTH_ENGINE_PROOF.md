# BRAND_HEALTH_ENGINE_PROOF

Status: **OPERATIONAL (with credential gaps)**
Date: 2026-06-27
Scope: Phase 4A — Brand Health Engine Proof
Source: `mi-core/server/src/marketing-intelligence/channel-health.ts`

## Engine: `buildChannelHealth()`

Reads brand connector status from `SEO/shared/config/brands.json` and produces per-brand channel health.

## Proof — 2 Brands Evaluated

### Bakudan Ramen (`bakudan`)
| Channel | Status | Usable for Planning | Usable for Publishing |
|---------|--------|---------------------|----------------------|
| crawler | configured | ✅ | ✅ |
| gsc | needs_config | ❌ | ❌ |
| ga4 | missing_credentials | ❌ | ❌ |
| gbp | missing_credentials | ❌ | ❌ |
| citation_scan | configured | ✅ | ✅ |

Brand Health: PARTIAL — 2/5 channels usable, 3 blocked.

### Raw Sushi (`raw_sushi`)
| Channel | Status | Usable for Planning | Usable for Publishing |
|---------|--------|---------------------|----------------------|
| crawler | needs_config | ❌ | ❌ |
| gsc | needs_config | ❌ | ❌ |
| ga4 | missing_credentials | ❌ | ❌ |
| gbp | missing_credentials | ❌ | ❌ |
| citation_scan | needs_config | ❌ | ❌ |

Brand Health: BLOCKED — 0/5 channels usable.

## Test Assertion (from phase4a test)
```
PASS: Channel health has Bakudan
PASS: Channel health has Raw Sushi
PASS: GBP missing is explicit
```

## No Fake Metrics
- GBP status explicitly surfaced as `missing_credentials` (not hidden or defaulted)
- No review rating/volume/sentiment fabricated when data is missing
- Each channel's usability is derived from real connector status

## GBP Health Detail
GBP is the critical brand health signal (reviews, rating, local actions). It is explicitly marked `missing_credentials` for both brands until CEO re-authorizes Google OAuth with business.manage scope.

## Coordination Integration
- Engine output registered as evidence via `runMarketingIntelligenceBootstrap()`
- Dashboard exposes channel health in `buildMarketingIntelligenceDashboard()`
