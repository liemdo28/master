# QB Chat Consistency Report

Target: QB_CHAT_CONSISTENCY_READY

Canonical section:

`GET /api/executive/snapshot -> finance_qb`

Canonical upstream source:

QuickBooks runtime connector.

Required fields available:

- `status`
- `dashboard_status`
- `last_successful_sync`
- `quickbooks_desktop_open`
- `company_detected`
- `company_identity`
- `duplicates`
- `checksum`
- `action_required`
- `required_dev1_action`
- `owner`

Current smoke result:

- QB status: `needs_dev1_action`
- Company detected: Raw Japanese Bistro and Sushi Bar
- Laptop1 identity rule: Raw Stockton only
- Owner: Dev1

Rule:

WhatsApp must not say QB is healthy when `finance_qb.data.action_required=true` or `finance_qb.data.status=needs_dev1_action`.
