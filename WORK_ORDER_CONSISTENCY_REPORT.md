# Work Order Consistency Report

Target: WORK_ORDER_CONSISTENCY_READY

Canonical section:

`GET /api/executive/snapshot -> work_orders`

Canonical upstream source:

`server/src/task-intelligence/task-data-collector.ts`

Reader:

`readOpenWorkOrders()`

Store:

`.local-agent-global/work-orders/*.json`

Rules:

- Do not use static reports.
- Do not use old dashboard/demo cache.
- Do not infer work-order count from chat history.

Smoke result:

- API snapshot work-order count: 8
- Executive UI Work Orders section reads `work_orders.data.count`.
- Chat answer for `Hôm nay anh có task gì?`: 8 open work orders

Acceptance:

The prior mismatch `no work order` vs `8 work orders` is resolved by making the current work-order store the only operational source.
