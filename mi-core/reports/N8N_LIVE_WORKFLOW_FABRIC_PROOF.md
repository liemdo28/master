# N8N Live Workflow Fabric Proof

**Version:** 1.0.0
**Date:** 2026-06-28

## Registry Path

`Mi/n8n/registry/N8N_WORKFLOW_REGISTRY.md`

## Workflow Registry Proof

All 11 required workflows mapped:

| # | workflow_id | owner_department | trigger | schedule | inputs | outputs | mi_core_endpoint | approval_gate | duplicate_policy | evidence_path | last_run | health | status |
|---|------------|-----------------|---------|---------|--------|---------|-----------------|---------------|------------------|---------------|----------|--------|--------|
| 1 | mi-system-health-check | IT | schedule | */5 * * * * | mi_core_url, n8n_health | health_report | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/mi-system-health-check/ | 2026-06-28 | PASS | ACTIVE |
| 2 | seo-daily-audit | Marketing | schedule | 0 7 * * * | gsc_api, brand_id, location_id | audit_report | /api/mi/approval/request | YES (SAFE_WRITE) | fingerprint_dedup | Mi/n8n/evidence/seo-daily-audit/ | 2026-06-28 | APPROVAL_GATED | ACTIVE |
| 3 | seo-weekly-executive-report | Executive | schedule | 0 9 * * 1 | seo_data, duckdb | executive_report | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/seo-weekly-executive-report/ | 2026-06-28 | PASS | ACTIVE |
| 4 | doordash-health-check | Operations | schedule | 0 6 * * * | doordash_api | health_status | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/doordash-health-check/ | 2026-06-28 | PASS | ACTIVE |
| 5 | quickbooks-freshness-check | Finance | schedule | 0 8 * * * | qb_timestamp | freshness_status | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/quickbooks-freshness-check/ | 2026-06-28 | PASS | ACTIVE |
| 6 | food-safety-missing-submission-alert | Operations | schedule | 0 8 * * * | food_safety_submissions | missing_alert | /api/mi/approval/request | YES (PRODUCTION_WRITE) | fingerprint_dedup | Mi/n8n/evidence/food-safety-missing-submission-alert/ | 2026-06-28 | APPROVAL_GATED | ACTIVE |
| 7 | review-spike-alert | Marketing | schedule | 0 * * * * | review_velocity_data | spike_alert | /api/mi/approval/request | YES (SAFE_WRITE) | fingerprint_dedup | Mi/n8n/evidence/review-spike-alert/ | 2026-06-28 | APPROVAL_GATED | ACTIVE |
| 8 | gbp-performance-check | Marketing | schedule | 0 9 * * * | gbp_api | gbp_score | /api/mi/approval/request | YES (SAFE_WRITE) | fingerprint_dedup | Mi/n8n/evidence/gbp-performance-check/ | 2026-06-28 | APPROVAL_GATED | ACTIVE |
| 9 | daily-ceo-brief | Executive | schedule | 0 7 * * * | all_connector_data | ceo_brief | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/daily-ceo-brief/ | 2026-06-28 | PASS | ACTIVE |
| 10 | oss-health-check | IT | schedule | 0 */2 * * * | oss_registry | oss_health_report | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/oss-health-check/ | 2026-06-28 | PASS | ACTIVE |
| 11 | duplicate-task-check | IT | schedule | 0 */30 * * * | task_fingerprints | dedup_report | /api/mi/workflows/log | NO | fingerprint_dedup | Mi/n8n/evidence/duplicate-task-check/ | 2026-06-28 | PASS | ACTIVE |

## Mi-Core Logging Endpoints (All 4)

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/mi/workflows/log | Log workflow execution |
| POST | /api/mi/workflows/evidence | Store workflow evidence |
| POST | /api/mi/workflows/heartbeat | Heartbeat ping |
| GET | /api/mi/workflows/status | Read workflow status |

## Evidence Files

- `Mi/n8n/evidence/n8n-live-health.json` — n8n instance health
- `Mi/n8n/evidence/workflow-registry.json` — workflow registry JSON
- `Mi/n8n/evidence/workflow-run-samples/` — sample workflow runs

## Test Results

`mi-core/tests/n8n-live-workflow-fabric-test.mjs`: **22 passed, 0 failed**

## Status: PROVEN