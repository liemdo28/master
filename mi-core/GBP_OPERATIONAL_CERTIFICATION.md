# GBP Operational Certification

Generated: 2026-06-27T04:15:00Z

Certification result: `PARTIAL`

## Real Evidence Collected

Evidence folder: `evidence/phase10-reality-closure/`

| Evidence | File |
| --- | --- |
| GBP status response | `gbp-status.json` |
| GBP locations response | `gbp-locations.json` |
| GBP metrics response | `gbp-metrics.json` |
| Metrics screenshot | `screenshot-gbp-metrics.png` |

## Gate Results

| Requirement | Result | Proof |
| --- | --- | --- |
| Live API access | PASS | `configured=true`, `status=GBP_CONNECTOR_READY`, `source=live_api` |
| Locations | PASS | 2 locations returned: Bakudan Ramen and Raw Sushi Bistro |
| Calls | PARTIAL | `CALL_CLICKS` metric returned but value array is empty |
| Directions | PARTIAL | `BUSINESS_DIRECTION_REQUESTS` metric returned but value array is empty |
| Clicks | PARTIAL | `WEBSITE_CLICKS` metric returned but value array is empty |
| Views | PARTIAL | impression metric keys returned but value arrays are empty |
| Quota handling | PASS | live request no longer returns quota failure |
| Cache/fallback | PASS | snapshot DB path reported |

## Decision

GBP live API access and location access are certified. Performance metric value certification remains partial because the live response returned empty metric arrays.

Final status contribution: `MI_COMPANY_OS_PARTIAL`.
