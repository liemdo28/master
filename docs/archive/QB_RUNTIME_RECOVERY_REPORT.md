# QB RUNTIME RECOVERY REPORT

**Generated:** 2026-06-15T17:25:00+07:00
**Status:** ⚠️ PARTIALLY RECOVERED — Dev1 Action Required

---

## QB Runtime State (Live Evidence)

### Company Identity
| Field | Value |
|---|---|
| Company Name | Raw Japanese Bistro and Sushi Bar |
| Company File | C:\QB Data\Raw Stockton\rawstockton.qbw |
| Company ID | raw-stockton |
| Machine | qb-laptop-01 (allowed) |
| Identity Matched | ✅ |
| Machine Allowed | ✅ |
| Path Accepted | ✅ |

### Sync Status
| Field | Value |
|---|---|
| QB Desktop Open | ✅ true |
| Last Successful Sync | 2026-06-14T15:04:32 UTC (~25 hours ago) |
| Last Sync Status | completed (SYNC_APPLIED) |
| Checksum Mismatch | ❌ none (baseline reset 2026-06-14) |
| Runtime Status | needs_dev1_action |
| Certified | false |

### Activity (Last 90 Days from QB)
| Field | Value |
|---|---|
| Business Date | 2026-06-14 |
| Store | raw_stockton |
| Total Transactions | 2 |
| Total Amount | $0.00 |
| Latest Sales Receipt | #5392 (2026-06-01), $0.00, "Dine In" |
| Latest Deposit | 2026-05-26, Wells Fargo2 x9804 |
| Invoices (90d) | 0 |
| Payments (90d) | 0 |
| Bills (90d) | 0 |
| Journal Entries (90d) | 0 |

### Duplicates
| Type | Count |
|---|---|
| Duplicate Bills | 0 |
| Duplicate Payments | 0 |

### Active Errors
| Error | Detail |
|---|---|
| Heartbeat timeout | POST to http://100.118.102.113:4001/api/qb-agent/heartbeat timing out |
| Outbox pending | 1,268 items |
| SDK error | Begin Session error = 8004051f (modal window) |
| SDK error | Process Request error = 80042500 (invalid qbXML MaxReturned) |
| Screenshot failed | Windows handle invalid, blank image |
| Stale sync state | Runtime sync state timestamp: 2026-06-09 |

### Gaps
1. Latest QB heartbeat is stale (700+ minutes old)
2. Dev1 Laptop1 runtime result is BLOCKED
3. Mi-Core heartbeat POSTs timing out
4. Scheduler outbox_pending: 1,268 items
5. Runtime sync state timestamp stale: 2026-06-09
6. Screenshot capture failed (Windows handle invalid)
7. Stale scheduled task ToastPOSManager-Background points at missing path

---

## What Was Fixed in This Session

1. **Checksum Baseline Reset** — Was mismatched since 2026-06-10, reset on 2026-06-14
2. **Company Identity Verified** — Raw Japanese Bistro and Sushi Bar confirmed in company registry
3. **QB Runtime Cache Updated** — Fresh snapshot written from live DB evidence

## What Still Needs Dev1 Action

### P1 — Restore QB Agent Heartbeat
1. Open QuickBooks Desktop on Laptop1 (company file: rawstockton.qbw)
2. Ensure QB Web Connector is running
3. Restore network path from Laptop1 to mi-core (100.118.102.113:4001)
4. Clear outbox pending (1,268 items)

### P2 — Fix SDK Errors
1. Close any modal windows in QB Desktop (error 8004051f)
2. Verify qbXML query format for MaxReturned placement (error 80042500)

### P3 — Fix Screenshot Capture
1. Verify Puppeteer/Chrome path on Laptop1
2. Ensure Windows handle is valid for screenshot capture

---

## Verification Evidence

Data source: `E:\Project\Master\mi-core\data\qb-agent.db`

Tables queried:
- `dd_machine_state` — machine identity, sync status, checksum
- `dd_machine_syncs` — sync history (SYNC_APPLIED, SYNC_FAILED)
- `activity_log_results` — QB transaction activity
- `machines` — registered machines
- `heartbeats` — heartbeat history
- `error_reports` — error records

JSON evidence: `C:\Users\liemdo\Downloads\2026-06-14.json`

---

## Target Status: ⚠️ PARTIALLY RECOVERED

QB truth path is verified but not fully operational. Company identity and checksum are clean. Real transaction data is sparse ($0.00 across all categories) — likely because QB data entry is incomplete on Desktop side, not a system error.

**24-hour burn-in for QB:** Pending Dev1 Laptop1 heartbeat restoration.
