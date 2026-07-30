# N8N WORKFLOW REGISTRY (C3)
**Date:** 2026-06-24  
**Status:** ✅ 15 WORKFLOWS REGISTERED

---

## Registry Location
```
services/n8n-execution-bus/workflows/workflow-registry.json
```

## Registry Schema
Every workflow must contain:
```json
{
  "id": "unique-kebab-id",
  "name": "Human Readable Name",
  "owner_department": "executive|finance|operations|marketing|engineering",
  "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
  "approval_required": false,
  "evidence_required": true,
  "rollback_available": false,
  "schedule": "cron expression or 'on_push'",
  "schedule_tz": "Asia/Ho_Chi_Minh",
  "description": "...",
  "inputs": ["param1"],
  "outputs": ["result1"],
  "dependencies": ["service:endpoint"]
}
```

## Workflow Summary

| ID | Name | Dept | Risk | Approval | Schedule |
|----|------|------|------|----------|----------|
| exec-daily-brief | Daily Executive Brief | executive | LOW | No | 07:00 daily |
| exec-weekly-brief | Weekly Executive Brief | executive | LOW | No | Mon 08:00 |
| exec-monthly-report | Monthly Executive Report | executive | LOW | **Yes** | 1st 09:00 |
| finance-qb-sync | QuickBooks Sync | finance | MEDIUM | No | Every 6h |
| finance-tax-reminder | Tax Reminder | finance | LOW | No | 1st & 15th |
| finance-payroll-reminder | Payroll Reminder | finance | LOW | **Yes** | 25th |
| ops-daily-store-health | Daily Store Health | operations | LOW | No | 06:00 daily |
| ops-compliance-summary | Compliance Summary | operations | LOW | No | Mon 07:00 |
| ops-missed-task-alert | Missed Task Alert | operations | LOW | No | 14:00 daily |
| mkt-seo-summary | SEO Summary | marketing | LOW | No | Mon 08:00 |
| mkt-review-summary | Review Summary | marketing | LOW | No | Mon 09:00 |
| mkt-campaign-summary | Campaign Summary | marketing | LOW | No | Mon 10:00 |
| eng-pm2-health | PM2 Health Monitor | engineering | LOW | No | Every 15m |
| eng-build-monitor | Build Monitor | engineering | LOW | No | On push |
| eng-error-monitor | Error Monitor | engineering | LOW | No | Every 30m |

## Summary Statistics
```
Total workflows: 15
By department:
  Executive:   3
  Finance:     3
  Operations:  3
  Marketing:   3
  Engineering: 3

By risk:
  LOW:    13
  MEDIUM:  1

Requiring approval: 3
With evidence:     15 (100%)
With rollback:      1
```

## Status
**N8N_WORKFLOW_REGISTRY_READY** — 15 workflows defined with full metadata. All require evidence. 3 require CEO approval before execution.
