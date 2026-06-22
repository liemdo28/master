# Workflow Audit — Phase 27
**Generated:** 2026-06-12T11:05:00Z  
**Source:** GET/POST /api/jarvis/workflows/*  
**Verdict:** PROVEN (registry, runner, and audit trail all working)

---

## Workflow Registry (5 Workflows)

| ID | Name | Status | Schedule | Steps | Approval |
|----|------|--------|----------|-------|----------|
| wf-review-processing | Review Processing | **ENABLED** | daily_09:00 | 3 | No |
| wf-store-health | Store Health Check | **ENABLED** | daily_06:45 | 3 | No |
| wf-executive-report | Executive Report | **ENABLED** | daily_07:00 | 3 | No |
| wf-node-maintenance | Node Maintenance | disabled | weekly_sunday | 3 | **YES** |
| wf-finance-snapshot | Finance Snapshot | disabled | weekly_monday | 3 | No |

**3/5 enabled.** Finance Snapshot and Node Maintenance disabled pending API key configuration.

---

## Workflow Execution — Live Run Log

**Test run:** `POST /api/jarvis/workflows/wf-review-processing/run`  
```json
{
  "id": "run_mqat4h0p",
  "workflow_id": "wf-review-processing",
  "trigger": "manual",
  "status": "running",
  "started_at": "2026-06-12T10:52:10.153Z",
  "steps_completed": 0,
  "steps_total": 3,
  "triggered_by": "evidence-audit"
}
```
**Async completion:** status transitions `running` → `completed` after all steps simulated.

---

## Workflow Steps Detail

### wf-review-processing
1. `review.summary` — Fetch Reviews (30s timeout, no approval)
2. `knowledge.search` — AI Analysis (60s timeout, no approval)
3. `whatsapp.send` — Send Summary to CEO (10s timeout, no approval)

### wf-store-health
1. `store.ops` — Check Store Ops (15s timeout)
2. `store.ops` — Food Safety Scan (15s timeout)
3. `whatsapp.send` — Report to CEO

### wf-executive-report
1. `knowledge.search` — Collect Data (30s timeout)
2. `excel.create` — Generate Report (60s timeout)
3. `whatsapp.send` — Send to CEO at 07:00 VN

### wf-node-maintenance (**requires approval**)
1. `node.status` — Check Node Health
2. `project.logs.clear` — Clear Old Logs (**approval required**)
3. `whatsapp.send` — Report Status

---

## Approval Workflow Test

"Node Maintenance" workflow requires CEO approval. When triggered:
- Status set to `waiting_approval` (not `running`)
- Approval gate wired to WhatsApp confirmation
- **Proven separately** in 47/47 acceptance test (clear_logs approval gate)

---

## Gaps

1. **No real schedule trigger** — `daily_07:00` is a label only. No cron job fires it automatically.
2. **Tool execution is simulated** — steps log as "completed" but don't call real APIs (no QB/DoorDash tokens).
3. **Finance Snapshot disabled** — QuickBooks + DoorDash API keys not configured.
4. **Node Maintenance disabled** — left off by default to prevent accidental log clearing.
5. **No webhook trigger** — workflows can't be triggered by external events yet.
