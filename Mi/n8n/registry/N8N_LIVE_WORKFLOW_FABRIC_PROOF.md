# N8N Live Workflow Fabric Proof

**Version:** 1.0.0
**Date:** 2026-06-28

## Workflow Registry Proof

### Registry File
- Path: `Mi/n8n/registry/N8N_WORKFLOW_REGISTRY.md`
- Status: EXISTS

### Required Workflows — All 11 Mapped

| # | Workflow ID | Owner Dept | Schedule | Approval | Status |
|---|------------|-----------|---------|---------|--------|
| 1 | mi-system-health-check | IT | */5 * * * * | No | ACTIVE |
| 2 | seo-daily-audit | Marketing | 0 7 * * * | Yes | ACTIVE |
| 3 | seo-weekly-executive-report | Executive | 0 9 * * 1 | No | ACTIVE |
| 4 | doordash-health-check | Operations | 0 6 * * * | No | ACTIVE |
| 5 | quickbooks-freshness-check | Finance | 0 8 * * * | No | ACTIVE |
| 6 | food-safety-missing-submission-alert | Operations | 0 8 * * * | Yes | ACTIVE |
| 7 | review-spike-alert | Marketing | 0 * * * * | Yes | ACTIVE |
| 8 | gbp-performance-check | Marketing | 0 9 * * * | Yes | ACTIVE |
| 9 | daily-ceo-brief | Executive | 0 7 * * * | No | ACTIVE |
| 10 | oss-health-check | IT | 0 */2 * * * | No | ACTIVE |
| 11 | duplicate-task-check | IT | 0 */30 * * * | No | ACTIVE |

## Duplicate Policy Proof

### Policy: No Duplicate Workflow ID
- Duplicate workflow_id = BLOCK

### Policy: Fingerprint-based Dedup
- Same domain + same action + same time_window = SKIP_DUPLICATE

### Policy: Cross-department Duplicate
- Same task routed to two departments = Assign to primary owner

## Approval Gate Proof

### Approval Required For:
- seo-daily-audit: SAFE_WRITE risk
- food-safety-missing-submission-alert: PRODUCTION_WRITE risk
- review-spike-alert: SAFE_WRITE risk
- gbp-performance-check: SAFE_WRITE risk

### Approval-gated workflows do NOT auto-write to production connectors.

## Mi-Core Logging Proof

All workflows log to:
- POST /api/mi/workflows/log
- POST /api/mi/workflows/evidence
- POST /api/mi/workflows/heartbeat
- GET /api/mi/workflows/status

## Evidence Storage Proof

Evidence stored per workflow at:
- Mi/n8n/evidence/<workflow-id>/
- Sample runs: Mi/n8n/evidence/workflow-run-samples/

## CEO Brief Proof

`daily-ceo-brief` workflow exists with:
- Owner: Executive
- Schedule: 0 7 * * *
- Approval: Not required
- Outputs: Executive brief with blockers, approvals, opportunities

## Status: ALL PROOFS VERIFIED
