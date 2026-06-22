# Operational Memory Store
**Phase 15.1 — OperationalMemoryStore**
**Status: PRODUCTION**

---

## Purpose

Normalizes raw execution history (append-only ledger + work order files) into a queryable SQLite database, enabling Mi to answer retrospective questions about system health, incident history, and owner behavior.

---

## Data Sources

| Source | Location | Contents |
|--------|----------|----------|
| Execution Ledger | `.local-agent-global/execution-ledger/ledger.jsonl` | All agent action records — role, action type, target, verdict, evidence |
| Work Orders | `.local-agent-global/work-orders/*.json` | Structured work orders — intent, priority, project, lifecycle status |

---

## Schema

### `executions`
One row per completed work order.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Work order ID |
| created_at | TEXT | When request was made |
| completed_at | TEXT | When work order closed |
| requested_by | TEXT | Who asked (ceo, api) |
| intent | TEXT | classify: audit_project, fix_bug, health_check, etc. |
| target_project | TEXT | Dashboard, Mi-Core, etc. |
| final_verdict | TEXT | PASS / FAIL / PENDING |
| duration_ms | INTEGER | End time − start time |
| step_count | INTEGER | Number of agent steps |
| pass_count | INTEGER | Steps that passed |
| fail_count | INTEGER | Steps that failed |
| agent_roles | TEXT | JSON array of roles used |

### `incidents`
One row per FAIL or APPROVAL_REQUIRED ledger entry.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PK | Ledger entry ID |
| ts | TEXT | When it occurred |
| target | TEXT | Affected project/service |
| agent_role | TEXT | Role that encountered failure |
| action_type | TEXT | What action failed |
| error_summary | TEXT | Evidence text |
| resolved | INTEGER | 0/1 |
| resolution_notes | TEXT | How it was fixed |
| recur_count | INTEGER | How many times this recurred |

### `owner_actions`
One row per ledger entry (all verdicts), for owner/role analytics.

### `period_summaries`
Pre-aggregated per project × period (week/month/quarter). Rebuilt on every sync.

---

## Sync Process

`syncMemory()`:
1. Reads all ledger entries from `ledger.jsonl`
2. Groups by `work_order_id`
3. Reads all work order JSON files
4. Upserts into `executions`, `incidents`, `owner_actions`
5. Rebuilds `period_summaries` for week/30/90 day windows

**Idempotent** — safe to call multiple times. Uses `INSERT OR REPLACE` / `INSERT OR IGNORE`.

---

## Database Location

```
.local-agent-global/operational-memory/memory.db
```

---

## API

```
POST /api/memory/sync   — trigger sync from ledger + work orders
GET  /api/memory/history — full operational history summary
```
