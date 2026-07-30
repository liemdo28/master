# N8N Workflow Mapping

**Version:** 3.0.0
**Date:** 2026-06-28
**Purpose:** Maps every workflow to its OSS worker, department, brand, and Mi-Core endpoint

---

## Workflow to OSS Worker Mapping

| Workflow | OSS Worker | Department | Brand | Location | Phase | Inputs | Outputs |
|---------|-----------|-----------|-------|---------|-------|--------|---------|
| mi-system-health-check | Uptime Kuma | IT | all | all | 23 | Mi-Core health, n8n health | Health report, alert |
| seo-daily-audit | Playwright | Marketing | all | all | 26 | GSC API, site crawl | Audit report, action items |
| seo-weekly-executive-report | DuckDB | Executive | all | all | 16 | SEO data, DuckDB | Executive report |
| review-monitoring | Playwright | Marketing | all | all | 26 | Review sites, GSC | Review summary, alerts |
| review-spike-alert | Playwright | Marketing | all | all | 26 | Review velocity data | Spike alert, action |
| food-safety-daily-reminder | Uptime Kuma | Operations | all | all | 23 | Food safety schedule | Reminder, checklist |
| food-safety-missing-submission-alert | Uptime Kuma | Operations | all | all | 23 | Food safety submissions | Missing alert |
| quickbooks-daily-sync | DuckDB | Finance | all | all | 16 | QuickBooks API | Sync report |
| quickbooks-freshness-check | DuckDB | Finance | all | all | 16 | QB data timestamp | Freshness status |
| doordash-weekly-campaign-review | Playwright | Operations | all | all | 26 | DoorDash API, site | Campaign review |
| doordash-health-check | Uptime Kuma | Operations | all | all | 23 | DoorDash API | Health status |
| gbp-performance-check | Playwright | Marketing | all | all | 26 | GBP API | GBP score, alerts |
| daily-ceo-brief | DuckDB | Executive | all | all | 16 | All connector data | CEO brief |
| oss-health-check | Uptime Kuma | IT | all | all | 23 | OSS registry | OSS health report |
| duplicate-task-check | DuckDB | IT | all | all | 16 | Task fingerprints | Dedup report |
| exec-daily-brief | DuckDB | Executive | all | all | 16 | All sources | Daily brief |
| exec-weekly-brief | DuckDB | Executive | all | all | 16 | All sources | Weekly brief |
| exec-monthly-report | DuckDB | Executive | all | all | 16 | All sources | Monthly report |
| finance-qb-sync | DuckDB | Finance | all | all | 16 | QB API | Financial sync |
| finance-tax-reminder | Uptime Kuma | Finance | all | all | 23 | Tax schedule | Reminder |
| finance-payroll-reminder | Uptime Kuma | Finance | all | all | 23 | Payroll schedule | Approval request |
| ops-daily-store-health | Uptime Kuma | Operations | all | all | 23 | Store connectors | Store health report |

---

## Workflow to Department Ownership

| Department | Owns Workflows | Can Support |
|-----------|--------------|-------------|
| Executive | daily-ceo-brief, exec-daily-brief, exec-weekly-brief, exec-monthly-report, seo-weekly-executive-report | finance-tax-reminder, ops-daily-store-health |
| Finance | quickbooks-daily-sync, quickbooks-freshness-check, finance-qb-sync, finance-tax-reminder, finance-payroll-reminder | |
| Operations | doordash-weekly-campaign-review, doordash-health-check, food-safety-daily-reminder, food-safety-missing-submission-alert, ops-daily-store-health | |
| Marketing | seo-daily-audit, review-monitoring, review-spike-alert, gbp-performance-check | |
| IT | mi-system-health-check, oss-health-check, duplicate-task-check | |

---

## Required Workflow Properties

Each workflow definition must include:
- `workflow_id` — unique identifier
- `owner_department