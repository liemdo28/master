# Finance Source Map
**Date:** 2026-06-15
**Phase:** DEV3 CEO_READY_V3 Closeout — D1

---

## Source Priority Map

```
CEO Finance Query
       │
       ▼
[1] QuickBooks Runtime
    Path: E:/Project/Master/mi-core/data/qb-agent.db
    Tables: transactions / accounts / sync_log
    Check: db exists AND table has rows
    Freshness: MAX(date_col) from data table
    Auth: Local file — always available if QB sync ran
       │
       │ (if no QB data)
       ▼
[2] Accounting Engine
    URL: http://127.0.0.1:8844/health
    Timeout: 2 seconds
    Check: HTTP 200
    Freshness: realtime (live API)
    Auth: None (local port)
       │
       │ (if engine offline)
       ▼
[3] Finance Cache
    Path: .local-agent-global/visibility/finance-cache.json
    Format: { "timestamp": "ISO8601", "data": {...} }
    Check: file exists AND data field not null
    Freshness: file.timestamp
    Stale warning: >24 hours old
       │
       │ (if no cache)
       ▼
[4] Explicit "Data Unavailable"
    Returns: structured message with connector statuses
    Never: estimates, fabricates, or claims data
```

---

## Store → Connector Mapping

| Store | Primary Source | Connector ID | Status |
|-------|---------------|-------------|--------|
| Raw Sushi | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |
| Bakudan Ramen | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |
| Stockton | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |
| Stone Oak | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |
| Rim | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |
| Bandera | QuickBooks Runtime | `quickbooks-runtime` | active (needs sync) |

All stores share the same QuickBooks company file — store-level breakdown
requires QB filtering by class/location after the data is synced.

---

## Data Available per Source

### QuickBooks Runtime (`qb-agent.db`)
| Data Type | Available | Notes |
|-----------|-----------|-------|
| Transaction count | ✅ | Row count in data table |
| Last sync timestamp | ✅ | MAX(date_col) |
| Revenue by store | ⚠️ | Requires QB query — not pre-aggregated |
| Revenue by period | ⚠️ | Requires QB query — not pre-aggregated |
| Invoice totals | ⚠️ | Requires QB query |

QB data is available at the raw transaction level. Aggregated revenue
(by store, by day/week/month) requires QB Agent query execution.

### Accounting Engine (port 8844)
| Data Type | Available | Notes |
|-----------|-----------|-------|
| Ledger entries | ✅ (when online) | Full ledger history |
| Cost summary | ✅ (when online) | `/stats` endpoint |
| Session data | ✅ (when online) | Per-session accounting |

### Finance Cache (finance-cache.json)
| Data Type | Available | Notes |
|-----------|-----------|-------|
| Whatever was last cached | ⚠️ | May be stale >24h |

---

## Freshness Requirements

| Source | Accept if fresher than | Stale warning at |
|--------|----------------------|-----------------|
| QuickBooks | Any data | >24 hours |
| Accounting Engine | Realtime | N/A |
| Finance Cache | 6 hours | >24 hours |

---

## Setup Required to Unlock Real Revenue Data

```
Step 1: Open QuickBooks Desktop on laptop1
Step 2: Open company file (all stores)
Step 3: Run QB Web Connector sync
Step 4: Verify: GET /api/qb-agent/status → { synced: true, records: N }
Step 5: Test: "Doanh thu hôm nay?" → returns QB data with timestamp
```
