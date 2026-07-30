# Mi Automation Fabric — Architecture

**Version:** 1.0.0
**Date:** 2026-06-24
**CTO Directive:** Audit & Build Mi n8n Architecture

---

## 1. North Star

```
CEO / WhatsApp / Dashboard / Scheduled Events
        ↓
Mi-Core Brain (port 4001)
        ↓
Decision Layer / Approval Layer
        ↓
n8n Automation Fabric (port 5678)
        ↓
Agent Workers (accounting, SEO, doordash, etc.)
        ↓
Mi-Core Memory + Reports
```

**Mi remains the brain. n8n is a fabric, not a brain.**

---

## 2. The Wrong Architecture (Forbidden)

```
n8n
 ↓
random agents
 ↓
random workflows
```

n8n must NEVER:
- Make final business decisions
- Approve actions without Mi approval
- Store source-of-truth business memory
- Directly modify production systems without approval
- Bypass Mi-Core
- Hardcode brand/store logic

---

## 3. n8n Allowed Actions

- Schedule triggers (cron)
- Webhook intake
- Connector execution (HTTP, DB, etc.)
- Retry / backoff
- Workflow logging (to Mi-Core)
- Calling Mi-Core (always first)
- Calling approved agents (after Mi approval)

---

## 4. Mi-Core Contract (8 Endpoints)

All n8n workflows MUST call these endpoints before any side effect:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/mi/intake/event` | Register an event with Mi-Core |
| POST | `/api/mi/decision/request` | Request a decision from Mi-Core |
| POST | `/api/mi/approval/request` | Request approval for an action |
| POST | `/api/mi/tasks/dispatch` | Dispatch a task to a Mi-Core agent |
| POST | `/api/mi/tasks/complete` | Mark a dispatched task complete |
| POST | `/api/mi/workflows/log` | Log workflow execution status |
| GET | `/api/mi/workflows/status` | Read workflow status (dashboard) |
| GET | `/api/mi/automation/dashboard` | Full automation overview |

If any endpoint returns non-2xx, n8n MUST halt the workflow and log to Mi-Core.

---

## 5. Workflow Contract

Every workflow JSON MUST include these fields:

```json
{
  "workflow_id": "string (kebab-case)",
  "domain": "string (seo|reviews|food-safety|quickbooks|doordash|system|websites)",
  "trigger_type": "schedule|webhook|manual",
  "source": "n8n",
  "mi_required": true,
  "approval_required": true,
  "brand_id": "string or 'all'",
  "location_id": "string or 'all'",
  "task_id": "string (set by Mi-Core on dispatch)",
  "status": "pending|in_progress|completed|failed",
  "started_at": "ISO8601 timestamp",
  "completed_at": "ISO8601 timestamp",
  "error": "string or ''",
  "actions": [ ... ]
}
```

**Every workflow MUST**:
1. Call `/api/mi/intake/event` first (register the request).
2. If `approval_required: true`, call `/api/mi/approval/request` and wait for approval.
3. Call `/api/mi/tasks/dispatch` to delegate to the agent.
4. Call `/api/mi/workflows/log` with the final status.

---

## 6. Multi-Brand Support

Every workflow MUST accept `brand_id` and `location_id` as parameters. Workflows MUST NOT hardcode any brand.

`brand_id = "all"` means run for every active brand in `config/brands.json`.

Adding a new brand:
1. Append entry to `config/brands.json`.
2. Update `config/domains.json` to include the new brand in `brands_enabled`.
3. NO workflow code changes required.

---

## 7. Directory Structure

```
Mi/n8n/
├── workflows/
│   ├── system/        — mi-system-health-check.json
│   ├── seo/           — seo-daily-audit.json, seo-weekly-executive-report.json
│   ├── reviews/       — review-monitoring.json
│   ├── food-safety/   — food-safety-daily-reminder.json
│   ├── quickbooks/    — quickbooks-daily-sync.json
│   ├── doordash/      — doordash-weekly-campaign-review.json
│   ├── websites/      — (reserved for future)
│   └── shared/        — (shared workflow fragments)
│
├── credentials/       — README.md (no secrets!)
├── backups/           — daily backup archives
├── logs/              — n8n runtime logs
├── reports/           — audit-proof.json, validation-proof.json
├── scripts/           — 8 batch files
├── config/            — brands.json, domains.json, workflow-registry.json, .env.example
├── docs/              — N8N_SECURITY.md, this file
└── data/              — Mi-Core contract logs (persistent)
```

---

## 8. Failure Modes

| Failure | n8n Action |
|---------|-----------|
| Mi-Core unreachable | Halt workflow, retry with exponential backoff (max 3), then log to local file |
| Approval timeout | Default to NOT executing; escalate via `/api/mi/intake/event` |
| Task dispatch fails | Log error to Mi-Core, do not retry without re-approval |
| Workflow itself errors | Log full stack trace to Mi-Core at `/api/mi/workflows/log` |
| Credential access denied | Log auth failure; do not proceed |

---

## 9. Observability

Every workflow execution produces:
- A workflow log entry in Mi-Core at `/api/mi/workflows/log`.
- An evidence callback to Mi-Core at `/api/n8n/evidence`.
- A PM2 log entry at `.local-agent-global/logs/n8n-{out,error}.log`.
- A backup in `Mi/n8n/backups/` (nightly).

The `/api/mi/automation/dashboard` endpoint aggregates all of these for the CEO Home dashboard.
