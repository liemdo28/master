# Website Data Consistency Report

Target: WEBSITE_DATA_CONSISTENCY_READY

Canonical section:

`GET /api/executive/snapshot -> websites`

Covered properties:

- local source path
- GitHub repository
- production domain
- last sync
- website health/source status
- publish capability

Sites:

| Site | Source |
| --- | --- |
| `bakudanramen.com` | website source connector |
| `rawsushibar.com` | website source connector |
| `dashboard.bakudanramen.com` | dashboard visibility connector |

Smoke result:

- Raw Sushi website returns `status=ok`.
- Raw Sushi source path: `E:/Project/Master/RawSushi/RawWebsite`.
- Raw Sushi last sync: `2026-06-14T16:04:42.562Z`.
- Repository metadata is missing in the local cache, so chat reports it as missing instead of connected.

Rule:

WhatsApp must answer website status from `websites`, not from old static website source reports.
