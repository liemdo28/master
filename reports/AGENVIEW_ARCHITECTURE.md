# AGENVIEW_ARCHITECTURE — Phase 19
**Target:** AGENVIEW_READY ✅

## What It Does
CEO-facing dashboard aggregating ALL of Mi's state in one place.
8 API endpoints — one call per view, no client-side data stitching needed.

## Endpoints

| Endpoint | Aggregates From |
|----------|----------------|
| `GET /api/agenview/overview` | Work Orders + Ledger + Graph + Memory → system health at a glance |
| `GET /api/agenview/work-orders` | `.local-agent-global/work-orders/` — paginated, filterable by status |
| `GET /api/agenview/agents` | Execution ledger last 24h → per-role activity, pass rate |
| `GET /api/agenview/graph` | Phase 14 graph.db → entities, edges, SPOF list |
| `GET /api/agenview/incidents` | Phase 15 memory.db incidents → last 50, ordered by time |
| `GET /api/agenview/approvals` | Phase 14 approval gate → pending CEO approvals |
| `GET /api/agenview/skills` | `.local-agent-global/skills/certifications.json` |
| `GET /api/agenview/memory` | Phase 15 memory.db → incident/action statistics |

## Overview Response
```json
{
  "system_status": "OK | WARN",
  "open_work_orders": 3,
  "total_work_orders": 47,
  "active_agents": 4,
  "agent_actions_24h": 12,
  "spof_count": 1,
  "entity_count": 18,
  "briefing_available": true,
  "top_spofs": [{"name": "mi-core-server", "dependents": 5, "score": 92}],
  "agent_activity": [{"role": "developer", "actions": 8}]
}
```

## Data Sources
- Phase 14: graph.db, work orders, approval gate
- Phase 15: memory.db (incidents, owner_actions)
- Phase 17: last-briefing.json existence check
- Execution ledger: `.local-agent-global/execution-ledger/ledger.jsonl`
