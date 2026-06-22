# Operational Memory REST APIs
**Phase 15.6 — OperationalMemoryRouter**
**Base path: `/api/memory`**

---

## Note on Existing Routes

The `/api/memory` prefix is shared with the Executive Memory router (profile, preferences, business). Operational Memory routes add distinct sub-paths (`/incidents`, `/executions`, `/owners`, `/trends`, `/history`, `/sync`) that do not conflict.

---

## Endpoints

### `POST /api/memory/sync`
Trigger sync from `ledger.jsonl` + work orders into operational memory DB.

**Response:**
```json
{
  "success": true,
  "data": {
    "synced_entries": 42,
    "synced_work_orders": 8,
    "stats": { "executions": 8, "incidents": 12, "owner_actions": 42, "period_summaries": 15 }
  }
}
```

---

### `GET /api/memory/incidents`
List all incidents, or filter by project.

**Query params:** `target`, `role`, `from` (ISO date), `limit`

With `?target=review-automation`:
```json
{
  "target": "review-automation",
  "total_incidents": 5,
  "resolved_count": 3,
  "unresolved_count": 2,
  "recurrence_count": 2,
  "has_occurred": true,
  "summary": "\"review-automation\" đã có 5 incident(s)..."
}
```

### `GET /api/memory/incidents/:target`
Incident history for a specific project (path param version).

---

### `GET /api/memory/executions`
All executions, or filter by project/intent/verdict.

**Query params:** `project`, `intent`, `verdict`, `from`, `limit`

### `GET /api/memory/executions/:project`
Full execution stats for a project.

---

### `GET /api/memory/owners`
Activity ranking, overloaded roles, resolution speed.

**Query params:** `days` (default 30)

### `GET /api/memory/owners/:role`
Full profile for a role. Accepts: `dev1`, `engineering_manager`, `qa`, `pm`, `auditor`, etc.

---

### `GET /api/memory/trends`
System health snapshot + top blockers + period stats.

**Query params:** `period` = `week` | `month` | `quarter` (default `quarter`)

### `GET /api/memory/trends/:project`
Trend analysis for a specific project (week vs month comparison).

```json
{
  "target_project": "review-automation",
  "trend": "DEGRADING",
  "trend_notes": "Tuần này success rate 40% thấp hơn tháng trước 50% (-10%).",
  "week_stats": { "success_rate": 40, "total_execs": 5 },
  "month_stats": { "success_rate": 50, "total_execs": 10 }
}
```

---

### `GET /api/memory/history`
Full operational history summary — combines all dimensions.

**Response includes:**
- `memory_stats` — row counts per table
- `system_health` — week/month/quarter snapshots
- `top_blocker_projects_90d` — ranked by blocker count
- `executions_by_project` — execution count + success rate
- `owner_activity_90d` — agent role activity ranking

---

## Error Response

```json
{ "success": false, "error": "period must be week|month|quarter" }
```
HTTP 400 for bad params, HTTP 500 for runtime errors.
