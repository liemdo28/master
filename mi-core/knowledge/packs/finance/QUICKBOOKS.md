# QuickBooks Integration

## Production Setup
- **Type:** QuickBooks Desktop (production)
- **Service:** qb-ops-agent
- **Status:** Degraded (see Sprint 1.1 health report)
- **Port:** 8844 (QB agent HTTP server)

## Data Available
- Sales transactions
- Customer records
- Inventory items
- Account balances
- Profit & Loss reports

## Integration Points
- `qb-ops-agent`: Polls QB company file, exposes via HTTP API
- `mi-core`: Queries qb-ops-agent for financial snapshots
- `knowledge-db`: Cached QB data via visibility connector

## Common Queries
- "How much revenue this month?" → QB sales by date range
- "Outstanding invoices?" → QB AR report
- "Top customers by revenue?" → QB customer sales summary

## Status Notes
- QB Desktop requires local machine access
- Company file must be open for agent to read
- Agent uses QBFC COM interface on Windows

## Tags
finance, accounting, quickbooks, revenue, invoices, sales
