# QuickBooks Live Read Proof

Generated: 2026-06-18 15:20 ICT
Target: `LIVE_READ_PASS`
Result: `UNREACHABLE`
Workstream score: `0 / 100`

## Connection Method

- Laptop1: `stockton-laptop` / Tailscale `100.111.97.25`
- Company: Raw Japanese Bistro and Sushi Bar
- Company file: `C:\QB Data\Raw Stockton\rawstockton.qbw`
- Transport: Laptop1 QB agent heartbeat and sync results to Mi-Core on `100.118.102.113:4001`
- Mi-Core endpoint: `GET /api/visibility/quickbooks`

## Evidence

- Mi-Core was restored to `0.0.0.0:4001` after an SEO agent was found occupying the port.
- The SEO Local Maps agent was moved to port `4011`.
- Laptop1 is active on Tailscale, so VPN reachability is present.
- Latest QB heartbeat: `2026-06-16T10:04:49.653Z`
- Latest successful sync record: `2026-06-17T00:30:53.681Z`
- Current QB visibility status: `degraded`
- Current gaps:
  - heartbeat is stale
  - successful sync is stale

## Data Returned

Historical data, not a current live read:

- Company identity detected: yes
- Store/company detected: Raw Stockton
- Historical activity result: 2 transactions
- Historical activity date: `2026-06-14`
- Historical transaction types: sales receipt and deposit

Required live proof not returned:

- Current sales report: not returned
- Current Profit and Loss report: not returned
- Current store list from QB: not returned
- Current QB session timestamp: not returned

## Screenshots and Logs

- `E:\Project\Master\mi-core\data\qb-agent.db`
- `E:\Project\Master\.local-agent-global\visibility\quickbooks\data.json`
- `E:\Project\Master\.local-agent-global\visibility\quickbooks\dev1-handoff-package.json`
- No current interactive QuickBooks screenshot is available.

## Fix Attempted

1. Identified port `4001` collision with SEO Local Maps.
2. Moved SEO Local Maps to port `4011`.
3. Restarted Mi-Core on `0.0.0.0:4001`.
4. Waited for Laptop1 heartbeat bridge recovery.
5. Retested QB visibility and Money Operations endpoints.

## Known Limitations

The Laptop1 heartbeat bridge or QB agent is not posting even though Laptop1 is visible on Tailscale. A fresh read-only QB sales and P&L request must run on Laptop1 before this workstream can pass.

No QuickBooks write operation was executed.

