# QB Operational Certification

**Generated:** 2026-06-27T09:16:00Z
**Phase:** 10.3 Final Connector Closure
**Certification result:** `QB_PARTIAL`

---

## Certification Result

**Status: `QB_PARTIAL`**

QB Desktop is open with correct company file. Company identity confirmed. Sync is stale at 9 days. Heartbeat not received. Dev1 action required on Laptop1.

---

## Company Identity

| Field | Value |
|-------|-------|
| Company Name | Raw Japanese Bistro and Sushi Bar |
| Company File | C:\QB Data\Raw Stockton\rawstockton.qbw |
| Company ID | raw-stockton |
| Identity Matched | true |
| QB Desktop Open | true |

---

## Sync Status

| Field | Value |
|-------|-------|
| Last Successful Sync | 2026-06-18T08:29:36.703Z |
| Sync Age | 12,981 minutes (~9 days) |
| Sync Status | ok (historical) |
| Checksum Match | not verified |
| Activity Today | 0 transactions, $0 |

---

## Heartbeat Status

| Field | Value |
|-------|-------|
| Heartbeat Received | NO |
| QB Ops Agent | online (PID 4424, 24h) |
| Endpoint /api/qb/heartbeat | 404 |
| Action Required | Dev1 must fix Laptop1 scheduled task |

---

## PM2 Process Status

| Process | PID | Uptime | Status |
|---------|-----|--------|--------|
| qb-ops-agent | 4424 | 24h | online |

---

## Gaps Identified

1. No QB heartbeat has been received
2. Last successful sync is 9 days old
3. No real QB activity log rows found
4. ToastPOSManager-Background scheduled task needs PowerShell Run as Administrator on Laptop1
5. 12h sync runner hung and was stopped by Dev1

---

## Required to Reach `QB_CERTIFIED`

| # | Action | Owner |
|---|--------|-------|
| 1 | Run PowerShell as Administrator on Laptop1 | Dev1 |
| 2 | Update ToastPOSManager-Background scheduled task path | Dev1 |
| 3 | Trigger fresh QB sync-result | Dev1 |
| 4 | Verify: `/api/visibility/quickbooks` shows `sync_age_minutes` < 60 | CTO |

---

## What Is Working

- QB Desktop is open with correct company file
- Company identity verified (Raw Japanese Bistro and Sushi Bar)
- qb-ops-agent is online (24h uptime)
- Failure detection is working (stale sync correctly flagged)
- QB correctly contributes to PARTIAL status

## Final Contribution

`MI_COMPANY_OS_PARTIAL` — QB is PARTIAL, contributing correctly to the partial operational state.
