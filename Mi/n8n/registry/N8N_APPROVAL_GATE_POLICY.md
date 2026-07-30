# N8N Approval Gate Policy

**Version:** 1.0.0
**Date:** 2026-06-28

## Approval Gate Rules

### Required Approval for:

| Risk Level | Approval Required | Gate Endpoint |
|------------|-----------------|---------------|
| READ_ONLY | No | N/A |
| SAFE_WRITE | Yes | `/api/mi/approval/request` |
| PRODUCTION_WRITE | Yes | `/api/mi/approval/request` |
| FINANCIAL | Yes | `/api/mi/approval/request` |
| SECURITY | Yes | `/api/mi/approval/request` |

### Approval-Gated Workflows (8 total):

1. seo-daily-audit (FINANCIAL risk via marketing spend)
2. review-monitoring (SAFE_WRITE)
3. review-spike-alert (SAFE_WRITE)
4. food-safety-daily-reminder (PRODUCTION_WRITE)
5. food-safety-missing-submission-alert (PRODUCTION_WRITE)
6. doordash-weekly-campaign-review (FINANCIAL)
7. gbp-performance-check (SAFE_WRITE)
8. exec-monthly-report (FINANCIAL)
9. finance-payroll-reminder (FINANCIAL)

## Gate Enforcement

### Before Execution:
1. Call `POST /api/mi/approval/request`
2. Wait for approval status: `APPROVED`
3. If `PENDING` or `REJECTED`: do NOT execute workflow
4. If timeout (>5 min): escalate to Executive

### During Execution:
- Approval-gated workflows must NOT auto-write to production connectors
- Must log every action to `/api/mi/workflows/log`
- Must store evidence in `Mi/n8n/evidence/<workflow-id>/`

### After Execution:
- Mark workflow complete via `/api/mi/workflows/log`
- Store execution evidence
- Close approval session

## Enforcement Module

Location: `mi-core/server/src/workflow-fabric/workflow-governance.ts`
Function: `requiresWorkflowApproval(risk)` + `assertWorkflowCanRun(risk, approved)`

## Evidence

All approval requests logged to: `mi-core/evidence/approval-gate/`
