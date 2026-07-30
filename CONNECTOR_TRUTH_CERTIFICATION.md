# CONNECTOR_TRUTH_CERTIFICATION

**Generated:** 2026-06-15T09:32:45.177Z
**Result:** FAIL

| Source | Live Evidence |
|---|---|
| Executive Snapshot | HTTP 200 |
| Connector Registry | HTTP 200 |
| QuickBooks | HTTP 200; status=degraded; certified=false; action_required=true |
| Accounting Engine | HTTP 200 |
| WhatsApp Connector | HTTP 200; PM2 status=online; restarts=1162 |
| Freshness | stale/degraded sources=2 |

## Stale Or Degraded Sources

- Gmail: stale
- QuickBooks: degraded (Connector health is degraded)

## Action Required

- gmail: freshness=stale (Dev2)
- finance_qb: On Laptop1, review QB connector runtime and clear these gaps: Latest QB heartbeat is stale (225 minutes old) (Dev1)
- connectors: freshness=stale (Dev2)

Acceptance requires registry reality match and no fake green. Current truth layer is honest, but not green.
