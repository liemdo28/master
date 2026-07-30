# N8N Workflow Registry

**Version:** 2.0.0
**Date:** 2026-06-24

---

## Purpose

Single source of truth for all n8n workflows. Every workflow is listed here with its domain, schedule, approval requirement, and multi-brand support.

---

## Core Workflows (7 — Created 2026-06-24)

| # | ID | Domain | Schedule | Approval | Brands |
|---|----|--------|----------|----------|--------|
| 1 | mi-system-health-check | system | */5 * * * * | No | all |
| 2 | seo-daily-audit | seo | 0 7 * * * | Yes | all |
| 3 | seo-weekly-executive-report | seo | 0 9 * * 1 | No | all |
| 4 | review-monitoring | reviews | 0 * * * * | Yes | all |
| 5 | food-safety-daily-reminder | food-safety | 0 6 * * * | Yes | all |
| 6 | quickbooks-daily-sync | quickbooks | 0 5 * * * | No | all |
| 7 | doordash-weekly-campaign-review | doordash | 0 10 * * 1 | Yes | all |

---

## Pre-Existing Workflows (15 — From original registry)

| # | ID | Domain | Schedule | Approval |
|---|----|--------|----------|----------|
| 1 | exec-daily-brief | executive | 0 7 * * * | No |
| 2 | exec-weekly-brief | executive | 0 8 * * 1 | No |
| 3 | exec-monthly-report | executive | 0 9 1 * * | Yes |
| 4 | finance-qb-sync | finance | 0 */6 * * * | No |
| 5 | finance-tax-reminder | finance | 0 9 1,15 * * | No |
| 6 | finance-payroll-reminder | finance | 0 9 25 * * | Yes |
| 7 | ops-daily-store-health | operations | 0 6 * * * | No |
| 8 | ops-compliance-summary | operations | 0 7 * * 1 | No |
| 9 | ops-missed-task-alert | operations | 0 14 * * * | No |
| 10 | mkt-seo-summary | marketing | 0 8 * * 1 | No |
| 11 | mkt-review-summary | marketing | 0 9 * * 1 | No |
| 12 | mkt-campaign-summary | marketing | 0 10 * * 1 | No |
| 13 | eng-pm2-health | engineering | */15 * * * * | No |
| 14 | eng-build-monitor | engineering | on_push | No |
| 15 | eng-error-monitor | engineering | */30 * * * * | No |

---

## Workflow Contract (Phase E)

Every workflow JSON MUST include:

```json
{
  "workflow_id": "",
  "domain": "",
  "trigger_type": "",
  "source": "n8n",
  "mi_required": true,
  "approval_required": true,
  "brand_id": "",
  "location_id": "",
  "task_id": "",
  "status": "",
  "started_at": "",
  "completed_at": "",
  "error": ""
}
```

All workflow logs MUST go to Mi-Core at `/api/mi/workflows/log`.

---

## Adding a New Workflow

1. Create JSON in the correct domain folder under `workflows/`.
2. Add entry to `config/workflow-registry.json`.
3. Add entry to this document.
4. Ensure `brand_id` and `location_id` are configurable (never hardcoded).
5. Every action must call Mi-Core first (`/api/mi/intake/event`).
6. If approval is needed, call `/api/mi/approval/request` before execution.
7. Final status must be logged via `/api/mi/workflows/log`.
