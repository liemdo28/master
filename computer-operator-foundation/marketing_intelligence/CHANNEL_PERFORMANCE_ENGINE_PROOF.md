# CHANNEL_PERFORMANCE_ENGINE_PROOF

Status: **PARTIAL (blocked by credentials)**
Date: 2026-06-27
Scope: Phase 4A — Channel Performance Engine Proof
Source: `mi-core/server/src/marketing-intelligence/channel-health.ts`

## Required Channels

| Channel | Required | Status |
|---------|----------|--------|
| Website | ✅ | Bakudan usable, Raw Sushi blocked |
| SEO (GSC) | ✅ | Both blocked (needs_config) |
| GBP | ✅ | Both missing_credentials |
| Social | ✅ | Not implemented (no connectors) |

## Channel Performance Matrix

### Website Channel
- **Bakudan Ramen**: crawler=configured ✅ → 13 pages crawled (bakudanramen.com)
- **Raw Sushi**: crawler=needs_config ❌ → no crawl data

### SEO Channel (GSC)
- **Both brands**: GSC=needs_config ❌ → no keyword/impression/CTR data
- **Unblock**: Configure GSC credentials (SEO Lead, 30 min)

### GBP Channel (Local Search)
- **Both brands**: GBP=missing_credentials ❌ → no calls/directions/reviews data
- **Unblock**: Re-authorize Google OAuth with business.manage scope (CEO, 5 min)

### Social Channel
- **Both brands**: No Facebook/Instagram/TikTok connectors ❌
- **Unblock**: Provision Facebook Page tokens (Marketing, 1 hour)

## What Mi CAN Measure Now
- Website crawl success (Bakudan only)
- Citation scan (Bakudan only)

## What Mi CANNOT Measure Now
- Organic search performance (GSC blocked)
- Local search actions (GBP blocked)
- Social engagement (no connectors)
- Conversion funnel (GA4 blocked)

## Test Assertion
```
PASS: Channel health has Bakudan
PASS: Channel health has Raw Sushi
PASS: GBP missing is explicit
```

## Coordination Integration
- Channel performance feeds into opportunity scoring
- Blocked channels reduce opportunity scores (Bakudan=31, Raw Sushi=11)
- Executive Coordination surfaces channel blockers in dashboard
