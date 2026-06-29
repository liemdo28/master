# N8N Workflow Registry v3.0

**Version:** 3.0.0
**Date:** 2026-06-29
**Purpose:** Single source of truth for all n8n automation workflows

---

## Registry Contract

Every workflow entry MUST include:

```json
{
  "workflow_id": "",
  "workflow_name": "",
  "owner_department": "",
  "business_purpose": "",
  "trigger_type": "cron|webhook|http|manual",
  "schedule": "cron expression",
  "input_schema": {},
  "output_schema": {},
  "Mi-Core_endpoint": "",
  "retry_policy": { "max_retries": 3, "retry_delay_ms": 5000 },
  "dead_letter_policy": true,
  "approval_policy": true,
  "evidence_path": "",
  "status": "ACTIVE|BLOCKED|DISABLED",
  "last_success": "",
  "last_failure": ""
}
```

---

## Required Workflows (11)

These 11 workflows are required by the CEO/CTO directive.

| # | workflow_id | owner_dept | business_purpose | trigger_type | schedule | Mi-Core endpoint | retry | dead_letter | approval | status |
|---|------------|-----------|-----------------|-------------|----------|-----------------|-------|-------------|---------|--------|
| 1 | mi-system-health-check | IT | Check Mi-Core, n8n, agent health every 5min | cron | `*/5 * * * *` | POST /api/mi/workflows/log | 3x/5s | YES | NO | ACTIVE |
| 2 | seo-daily-audit | Marketing | Daily SEO audit via Playwright | cron | `0 7 * * *` | POST /api/mi/tasks/dispatch | 3x/10s | YES | YES | ACTIVE |
| 3 | seo-weekly-executive-report | Executive | Weekly SEO executive brief via DuckDB | cron | `0 9 * * 1` | POST /api/mi/tasks/dispatch | 3x/30s | YES | NO | ACTIVE |
| 4 | doordash-health-check | Operations | DoorDash API + store health via Uptime Kuma | cron | `0 6 * * *` | POST /api/mi/workflows/log | 3x/5s | YES | NO | ACTIVE |
| 5 | quickbooks-freshness-check | Finance | QB data timestamp freshness via DuckDB | cron | `0 8 * * *` | POST /api/mi/workflows/log | 3x/5s | YES | NO | ACTIVE |
| 6 | food-safety-missing-submission-alert | Operations | Alert when food safety submission is missing | cron | `0 8 * * *` | POST /api/mi/tasks/dispatch | 3x/10s | YES | YES | ACTIVE |
| 7 | review-spike-alert | Marketing | Alert when review velocity spikes | cron | `0 * * * *` | POST /api/mi/tasks/dispatch | 3x/10s | YES | YES | ACTIVE |
| 8 | gbp-performance-check | Marketing | Google Business Profile score check | cron | `0 9 * * *` | POST /api/mi/workflows/log | 3x/5s | YES | YES | ACTIVE |
| 9 | daily-ceo-brief | Executive | Daily CEO operating brief via DuckDB | cron | `0 7 * * *` | GET /api/executive/daily-brief | 3x/30s | YES | NO | ACTIVE |
| 10 | oss-health-check | IT | OSS registry health check | cron | `0 */2 * * *` | POST /api/mi/workflows/log | 3x/5s | YES | NO | ACTIVE |
| 11 | duplicate-task-check | IT | Fingerprint-based task dedup via DuckDB | cron | `0 */30 * * *` | POST /api/mi/tasks/dispatch | 3x/5s | YES | NO | ACTIVE |

---

## Owner Mapping

```
seo-daily-audit                   -> Marketing
seo-weekly-executive-report        -> Executive / Marketing
doordash-health-check              -> Operations / Marketing
quickbooks-freshness-check         -> Finance
food-safety-missing-submission-alert -> Operations
review-spike-alert                 -> Customer Experience / Marketing
gbp-performance-check               -> Marketing
daily-ceo-brief                    -> Executive
oss-health-check                   -> IT
duplicate-task-check                -> Executive Coordination / IT
mi-system-health-check              -> IT
```

---

## Department Ownership

| Department | Owns | Can Support |
|-----------|------|------------|
| Executive | daily-ceo-brief, seo-weekly-executive-report | finance-tax-reminder, ops-daily-store-health |
| Finance | quickbooks-freshness-check | |
| Operations | doordash-health-check, food-safety-missing-submission-alert | |
| Marketing | seo-daily-audit, review-spike-alert, gbp-performance-check | |
| IT | mi-system-health-check, oss-health-check, duplicate-task-check | |

---

## Trigger Type Rules

```
Allowed in n8n (trigger layer):
- Cron trigger (schedule)
- Webhook trigger (manual/API)
- HTTP Request (GET/POST to Mi-Core)
- Set / Rename fields
- Basic IF for transport failure routing

NOT allowed in n8n (business logic — must be in Mi-Core):
- business scoring
- revenue logic
- approval decision
- campaign optimization
- finance calculation
- duplicate detection
- department routing
- ranking/sorting beyond simple field mapping
```

---

## Status Definitions

```
ACTIVE     : Workflow imported into n8n, schedule set, retry configured, dead-letter configured
BLOCKED   : Workflow defined but cannot run (missing credential, missing endpoint, missing key)
DISABLED  : Intentionally deactivated (replace with MI_CORE_* blocking)
ARCHIVED  : Superseded by new version
```

---

## Evidence Storage

Evidence per workflow: `Mi/n8n/evidence/<workflow-id>/`

Each run must produce:
- `run-<timestamp>.json` — execution log
- `payload.json` — input payload
- `response.json` — Mi-Core response
- `status.json` — final status

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-24 | Initial registry |
| 2.0.0 | 2026-06-28 | Added all 11 required workflows |
| 3.0.0 | 2026-06-29 | Added retry_policy, dead_letter_policy, full contract fields |
