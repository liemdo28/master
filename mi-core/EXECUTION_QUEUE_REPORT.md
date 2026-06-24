# EXECUTION QUEUE REPORT

## Phase E4 — CERTIFIED

### Module
`server/src/execution/execution-queue.ts`

### Queue Routing

| Queue | Workflow Types | Timeout |
|---|---|---|
| website_queue | SEO_CONTENT, WEBSITE_POST | 5 min |
| marketing_queue | SOCIAL_POST, CAMPAIGN, FLYER, VIDEO | 10 min |
| email_queue | EMAIL_DRAFT | 2 min |
| finance_queue | FINANCE_REPORT, QB_CHECK | 5 min |
| code_queue | BUG_FIX | 10 min |
| browser_queue | Browser automation | 10 min |
| report_queue | DASHBOARD_AUDIT, general reports | 3 min |

### Job Fields

Every queued job has:
- id (auto-generated)
- idempotency_key (prevents duplicate jobs)
- queue (routed by workflow type)
- workflow_id (traceability)
- workflow_type
- target_entity
- owner (who requested)
- status (queued → running → completed/failed/retrying)
- timeout_ms
- max_retries (default 3)
- retry_count
- evidence (on completion)

### Key Properties
- No direct execution from chat response
- All actions routed through queue
- Idempotency key prevents duplicate jobs
- Retry policy: 3 retries before permanent failure
- Per-queue timeouts

### Gates
- [x] EXECUTION_QUEUE_CERTIFIED
