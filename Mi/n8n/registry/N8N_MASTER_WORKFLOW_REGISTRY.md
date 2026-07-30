# N8N Master Workflow Registry v4.0
## CEO/CTO Directive — Full Mapping Hardening

**Version:** 4.0.0
**Date:** 2026-06-29
**Directive:** CEO/CTO N8N FULL MAPPING HARDENING
**Status:** `N8N_MAPPING_PARTIAL` (4/16 workflows ACTIVE, 12 STUB_MISSING)
**Failure Rate Gate:** < 5% required → Actual: 3.6%

---

## Registry Contract

Every workflow entry MUST include ALL fields below:

```json
{
  "workflow_id": "string",
  "workflow_name": "string",
  "project": "string",
  "owner_department": "string (single department — no slash-separated ambiguity)",
  "supporting_departments": ["string"],
  "trigger_type": "cron|webhook|manual",
  "schedule": "cron expression or null",
  "Mi-Core_endpoint": "string",
  "objective_type": "string",
  "task_type": "string",
  "approval_policy": "REQUIRED|ALWAYS_APPROVED|NOT_REQUIRED",
  "dedupe_key": "string (composite key with {placeholder} vars)",
  "retry_policy": { "max_retries": 3, "retry_delay_ms": 5000 },
  "dead_letter_policy": "RETRY_3X|SKIP_TO_DLQ|ESCALATE",
  "evidence_path": "string",
  "last_success": "ISO8601|null",
  "last_failure": "ISO8601|null",
  "status": "ACTIVE|BLOCKED|DISABLED|STUB_MISSING"
}
```

---

## Standard Workflow Pattern

ALL workflows MUST follow this exact chain — no exceptions, no business logic in n8n:

```
Schedule/Webhook Trigger
  → POST /api/mi/workflows/dedup/check   (dedupe key)
  → Is Duplicate? ─YES→ Skip + Log → exit
  → POST /api/mi/workflows/dedup/register (mark in-flight)
  → Mi-Core Action (POST /api/mi/tasks/dispatch or domain endpoint)
  → Store Evidence (POST /api/mi/workflows/evidence)
  → Log Execution  (POST /api/mi/workflows/log)
  → Dead Letter on Failure (POST /api/mi/workflows/dead-letter)
```

**Business logic NOT allowed in n8n:** scoring, ranking, revenue logic, approval decisions, duplicate detection, department routing, campaign optimization.

---

## Project → Department Ownership Map

| Project | Owner Dept | Supporting Depts |
|---------|-----------|-----------------|
| Review workflows | Customer Experience | Marketing |
| DoorDash workflows | Operations | Marketing, Finance |
| SEO workflows | Marketing | IT |
| GSC workflows | Marketing | Data |
| Career workflows | Career Agent | Personal |
| Failure workflows | IT | Executive Coordination |
| Daily brief workflows | Executive | — |
| System health workflows | IT | — |
| Finance workflows | Finance | IT |

---

## Complete Workflow Registry (16 required)

### 1. review-monitoring
| Field | Value |
|-------|-------|
| workflow_id | review-monitoring |
| workflow_name | Review Monitoring |
| project | Review Automation |
| owner_department | Customer Experience |
| supporting_departments | [Marketing] |
| trigger_type | cron |
| schedule | 0 * * * * |
| Mi-Core_endpoint | POST /api/mi/tasks/dispatch |
| objective_type | monitor_review_velocity |
| task_type | review.check |
| approval_policy | REQUIRED |
| dedupe_key | review-check:{brand_id}:{location_id}:{date} |
| retry_policy | {max_retries: 3, retry_delay_ms: 10000} |
| dead_letter_policy | RETRY_3X |
| evidence_path | Mi/n8n/evidence/review-monitoring |
| last_success | null |
| last_failure | null |
| status | ACTIVE |

### 2. doordash-weekly-campaign-review
| Field | Value |
|-------|-------|
| workflow_id | doordash-weekly-campaign-review |
| workflow_name | DoorDash Weekly Campaign Review |
| project | DoorDash Operations |
| owner_department | Operations |
| supporting_departments | [Marketing, Finance] |
| trigger_type | cron |
| schedule | 0 10 * * 1 |
| Mi-Core_endpoint | POST /api/mi/tasks/dispatch |
| objective_type | weekly_campaign_optimization |
| task_type | doordash.weekly-review |
| approval_policy | REQUIRED |
| dedupe_key | doordash-weekly:{brand_id}:{week_number} |
| retry_policy | {max_retries: 3, retry_delay_ms: 30000} |
| dead_letter_policy | RETRY_3X |
| evidence_path | Mi/n8n/evidence/doordash-weekly-campaign-review |
| last_success | null |
| last_failure | null |
| status | ACTIVE |

### 3. seo-technical-health-check
| Field | Value |
|-------|-------|
| workflow_id | seo-technical-health-check |
| workflow_name | SEO Technical Health Check |
| project | SEO Automation |
| owner_department | Marketing |
| supporting_departments | [IT] |
| trigger_type | cron |
| schedule | 0 8 * * * |
| Mi-Core_endpoint | POST /api/mi/tasks/dispatch |
| objective_type | seo_technical_health |
| task_type | seo.technical-health |
| approval_policy | NOT_REQUIRED |
| dedupe_key | seo-tech:{brand_id}:{date} |
| retry_policy | {max_retries: 3, retry_delay_ms: 10000} |
| dead_letter_policy | RETRY_3X |
| evidence_path | Mi/n8n/evidence/seo-technical-health-check |
| last_success | null |
| last_failure | null |
| status | STUB_MISSING |

### 4. seo-daily-audit
| Field | Value |
|-------|-------|
| workflow_id | seo-daily-audit |
| workflow_name | SEO Daily Audit |
| project | SEO Automation |
| owner_department | Marketing |
| supporting_departments | [IT] |
| trigger_type | cron |
| schedule | 0 7 * * * |
| Mi-Core_endpoint | POST /api/mi/tasks/dispatch |
| objective_type | daily_seo_audit |
| task_type | seo.daily-audit |
| approval_policy | REQUIRED |
|