# Dev2 Support For WhatsApp Jarvis

Target: DEV3_SUPPORT_READY

Dev3 contract:

Use `GET /api/executive/snapshot` as the single source for operational WhatsApp answers.

Use `GET /api/executive/intent?message=...` or the same labels in `classifyExecutiveIntent()` for routing.

Required chat behavior:

- Include freshness language when `stale=true`.
- Include owner when action is required.
- Do not answer green when `action_required=true`.
- Do not use graph lookup for operational questions.

Consistency fixtures:

| Question | Expected intent | Source |
| --- | --- | --- |
| `Hôm nay anh có task gì?` | `operational_status` | `work_orders`, `tasks` |
| `Dashboard hôm nay có gì?` | `operational_status` | `connectors`, `today_summary` |
| `Có gì cần duyệt?` | `action_request` | `approvals` |
| `Có email nào quan trọng?` | `operational_status` | `gmail` |
| `QB sync sao rồi?` | `finance_request` | `finance_qb` |
| `Raw Sushi website đã sync chưa?` | `marketing_request` | `websites` |
| `Có gì đáng lo không?` | `operational_status` | `blockers`, `today_summary` |

Current local fixture values:

- Work orders: 8
- Approvals: 0
- QB: `needs_dev1_action`
- Raw Sushi website: `ok`, repo metadata missing
- Gmail: missing in local cache
- Calendar: missing in local cache

Executive UI bridge:

- `ui/index.html` fetches `/api/executive/snapshot`.
- Work Orders detail view renders the canonical `work_orders` section.
- Google/QB/connector panels prefer executive snapshot data over older visibility-only counters.

Dev3 implementation note:

When rendering WhatsApp text, prefer the section data from the snapshot and include the section `source` in debug logs. This makes API, dashboard, and WhatsApp traceable to the same runtime object.
