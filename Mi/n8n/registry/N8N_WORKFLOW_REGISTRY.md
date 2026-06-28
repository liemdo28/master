# N8N Workflow Registry

**Version:** 3.0.0
**Date:** 2026-06-28
**Purpose:** Single source of truth for all n8n workflows in the Mi ecosystem

---

## Registry Overview

| Metric | Count |
|--------|-------|
| Total workflows | 22 |
| Approval-gated | 8 |
| Auto-run (no approval) | 14 |
| Department coverage | 11 |

---

## All Workflows

| # | Workflow ID | Department | Domain | Trigger | Schedule | Approval | Owner | Mi-Core Endpoint | Status | Evidence Path |
|---|------------|-----------|--------|---------|---------|---------|-------|----------------|--------|---------------|
| 1 | mi-system-health-check | IT | system | schedule | */5 * * * * | No | IT | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/system/mi-system-health-check.json` |
| 2 | seo-daily-audit | Marketing | seo | schedule | 0 7 * * * | Yes | Marketing | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/seo/seo-daily-audit.json` |
| 3 | seo-weekly-executive-report | Executive | seo | schedule | 0 9 * * 1 | No | Executive | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/seo/seo-weekly-executive-report.json` |
| 4 | review-monitoring | Marketing | reviews | schedule | 0 * * * * | Yes | Marketing | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/reviews/review-monitoring.json` |
| 5 | review-spike-alert | Marketing | reviews | schedule | 0 * * * * | Yes | Marketing | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/reviews/review-monitoring.json` (extended) |
| 6 | food-safety-daily-reminder | Operations | food-safety | schedule | 0 6 * * * | Yes | Operations | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/food-safety/food-safety-daily-reminder.json` |
| 7 | food-safety-missing-submission-alert | Operations | food-safety | schedule | 0 8 * * * | Yes | Operations | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/food-safety/food-safety-daily-reminder.json` (extended) |
| 8 | quickbooks-daily-sync | Finance | finance | schedule | 0 5 * * * | No | Finance | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/quickbooks/quickbooks-daily-sync.json` |
| 9 | quickbooks-freshness-check | Finance | finance | schedule | 0 8 * * * | No | Finance | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/quickbooks/quickbooks-daily-sync.json` (extended) |
| 10 | doordash-weekly-campaign-review | Operations | doordash | schedule | 0 10 * * 1 | Yes | Operations | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/doordash/doordash-weekly-campaign-review.json` |
| 11 | doordash-health-check | Operations | doordash | schedule | 0 6 * * * | No | Operations | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/doordash/doordash-weekly-campaign-review.json` (extended) |
| 12 | gbp-performance-check | Marketing | reviews | schedule | 0 9 * * * | Yes | Marketing | /api/mi/approval/request | ACTIVE | `Mi/n8n/workflows/reviews/review-monitoring.json` (extended) |
| 13 | daily-ceo-brief | Executive | executive | schedule | 0 7 * * * | No | Executive | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/system/mi-system-health-check.json` (extended) |
| 14 | oss-health-check | IT | system | schedule | 0 */2 * * * | No | IT | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/system/mi-system-health-check.json` (extended) |
| 15 | duplicate-task-check | IT | system | schedule | 0 */30 * * * | No | IT | /api/mi/workflows/log | ACTIVE | `Mi/n8n/workflows/system/mi-system-health-check.json` (extended) |
| 16 | exec-daily-brief | Executive | executive | schedule | 0 7 * * * | No | Executive | /api/mi/workflows/log | ACTIVE | Pre-existing |
| 17 | exec-weekly-brief | Executive | executive | schedule | 0 8 * * 1 | No | Executive | /api/mi/workflows/log | ACTIVE | Pre-existing |
| 18 | exec-monthly-report | Executive | executive | schedule | 0 9 1 * * | Yes | Executive | /api/mi/approval/request | ACTIVE | Pre-existing |
| 19 | finance-qb-sync | Finance | finance | schedule | 0 */6 * * * | No | Finance | /api/mi/workflows/log | ACTIVE | Pre-existing |
| 20 | finance-tax-reminder | Finance | finance | schedule | 0 9 1,15 * * | No | Finance | /api/mi/workflows/log | ACTIVE | Pre-existing |
| 21 | finance-payroll-reminder | Finance | finance | schedule | 0 9 25 * * | Yes | Finance | /api/mi/approval/request | ACTIVE | Pre-existing |
| 22 | ops-daily-store-health | Operations | ops | schedule | 0 6 * * * | No | Operations | /api/mi/workflows/log | ACTIVE | Pre-existing |

---

## Workflow Contract (Mandatory)

Every n8n workflow JSON MUST include:

```json
{
  "workflow_id": "unique-id",
  "name": "Human readable name",
  "domain": "domain-name",
  "trigger_type": "schedule|webhook|manual",
  "source": "n8n",
  "mi_required": true,
  "approval_required": true|false,
  "brand_id": "brand-id|all",
  "location_id": "location-id|all",
  "schedule": "cron-expression",
  "schedule_tz": "Asia/Ho_Chi_Minh",
  "owner_department": "DepartmentName",
  "mi_core_endpoint": "/api/mi/workflows/log",
  "evidence_path": "Mi/n8n/evidence/<workflow-id>/"
}
```

**Required Mi-Core endpoints:**
- `POST /api/mi/workflows/log` — log workflow execution
- `POST /api/mi/workflows/evidence` — store workflow evidence
- `POST /api/mi/workflows/heartbeat` — heartbeat ping
- `GET /api/mi/workflows/status` — read workflow status

**Approval-gated workflows:**
- Must call `POST /api/mi/approval/request` before execution
- Must not auto-write to production connectors
- Evidence stored in `Mi/n8n/evidence/<workflow-id>/`
