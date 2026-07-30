# WhatsApp Source Of Truth Map

Target: SOURCE_OF_TRUTH_MAP_READY

Canonical Dev3 API:

`GET /api/executive/snapshot`

Rules:

- WhatsApp must read the executive snapshot for operational status questions.
- Domain-specific endpoints may remain available, but they are upstream sources, not chat truth.
- If a section is stale, missing, degraded, or error, chat must say that before giving cached values.

| Domain | Canonical snapshot section | Upstream source |
| --- | --- | --- |
| Tasks | `tasks` | `visibility-hub.getDailySnapshot()` + Asana cache |
| Approvals | `approvals` | `/api/approval/pending` / approval gate |
| Work Orders | `work_orders` | `task-intelligence.current_work_order_store` |
| Projects | `projects` | local project visibility cache |
| Dashboard | `dashboard` | dashboard visibility connector |
| Websites | `websites` | website source connector + dashboard connector |
| Gmail | `gmail` | Gmail cache |
| Calendar | `calendar` | Google Calendar cache |
| Drive | `drive` | Google Drive cache |
| Health | `health` | health visibility connector |
| QuickBooks | `finance_qb` | QuickBooks runtime connector |
| Asana | `tasks.data.asana` | Asana visibility cache |
| Burn-In | `burn_in` | COO V4 burn-in DB |
| Connectors | `connectors` | connector registry + freshness monitor |
| Graph | `graph` | graph risks only for graph intent |
| Memory | `memory` | operational memory freshness |

Acceptance:

- No WhatsApp response should use old static work-order reports, demo cache, or raw graph dumps for operational questions.
- `Dashboard hôm nay có gì?` maps to `operational_status`, not `graph_lookup`.
