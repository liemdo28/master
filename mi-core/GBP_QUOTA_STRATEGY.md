# GBP Quota Strategy

Generated: 2026-06-27T03:30:00Z

Status: `REQUIRED_FOR_CERTIFICATION`

## Strategy

1. Cache successful GBP location and performance responses with timestamps.
2. Retry quota/resource failures with exponential backoff.
3. Separate access proof from performance proof.
4. Do not promote stale cached performance metrics to live certification.
5. Keep dashboard status partial when performance calls fail.

## Operational Rule

GBP can only contribute to `MI_COMPANY_OS_OPERATIONAL` when the latest performance call returns live views, calls, directions, and website clicks for the configured business profile.
