# QB_RECOVERY_REPORT.md

> Phase 32 — System Recovery: QuickBooks
> Generated: 2026-06-24 21:30 Asia/Saigon
> Mission: Assess and report health of QuickBooks integration

---

## Final Status: `SYSTEM_RECOVERY_PARTIAL`

---

## 1. Health Status

| Field | Value |
|-------|-------|
| Connector Name | `quickbooks-runtime` |
| PM2 Process | `mi-core` (hosts QB heartbeat) |
| Auth Status | `connected` |
| Company Detected | `Raw Japanese Bistro and Sushi Bar` |
| QB File | `rawstockton.qbw` |
| QuickBooks Desktop | OPEN on machine `qb-laptop-01` (Stockton_Laptop) |
| Last Successful Sync | `2026-06-18T08:29:36.703Z` (6 days stale) |
| Health Classification | **degraded** (heartbeat stale) |

**Evidence (from Phase 31 live query):**
```json
{
  "status": "active",
  "auth_status": "connected",
  "company_detected": "Raw Japanese Bistro and Sushi Bar",
  "quickbooks_desktop_open": true,
  "last_successful_sync": "2026-06-18T08:29:36.703Z",
  "health_status": "degraded"
}
```

### Health Assessment

- **Connection:** ALIVE — QB Desktop is open, company file detected, auth connected
- **Data Freshness:** STALE — last sync 6 days ago (144+ hours)
- **Functional Capability:** PARTIAL — data schema exists, financial records available once heartbeat is refreshed
- **Degradation Reason:** Heartbeat stopped syncing (likely machine sleep/restart or QB agent process idle)

---

## 2. Connectivity

| Check | Result |
|-------|--------|
| QB Desktop Open | ✅ YES — `rawstockton.qbw` detected |
| Company File Detected | ✅ YES — "Raw Japanese Bistro and Sushi Bar" |
| Auth Token Valid | ✅ YES — `auth_status: connected` |
| Heartbeat Active | ❌ NO — stale (11,772 min since last heartbeat) |
| Accounting Engine | ✅ YES — port 8844, health: `{"ok":true}` |
| Accounting DB | ✅ EXISTS — `mi-core/services/accounting-engine/ledgers/accounting.db` |

**Connectivity Verdict:** The integration pipeline is INTACT but the heartbeat is DORMANT. The code, auth, company file, and accounting engine all exist and function. The only failure is sync freshness.

---

## 3. Data Availability

| Data Point | Available | Freshness | Confidence |
|------------|-----------|-----------|------------|
| Revenue ($) | ✅ YES | Stale (6 days) | MEDIUM |
| Labor Cost | ✅ YES | Stale (6 days) | MEDIUM |
| Food Cost | ✅ YES | Stale (6 days) | MEDIUM |
| P&L Summary | ✅ YES | Stale (6 days) | MEDIUM |
| Transaction Detail | ✅ YES | Stale (6 days) | LOW-MEDIUM |
| Profit Trend | ⚠️ PARTIAL | Single snapshot | LOW |

**Data Verdict:** Financial data EXISTS in the system. It is the same data that would answer "Why is revenue down this week?" — but it's 6 days stale. Once the heartbeat is re-engaged, data will be current.

---

## 4. Dashboard Integration

| Dashboard KPI | QB Source | Integration Status |
|---------------|-----------|-------------------|
| Revenue ($) | QB Revenue | ⚠️ PARTIAL (stale data) |
| Labor Cost % | QB Payroll | ⚠️ PARTIAL (stale data) |
| Food Cost % | QB COGS | ⚠️ PARTIAL (stale data) |
| Profit Trend | QB P&L | ⚠️ PARTIAL (estimated) |

**Integration Verdict:** The dashboard-to-QB pipeline exists via the `accounting` connector and port 8844 Accounting Engine. The dashboard can display QB data once it's refreshed.

---

## 5. Evidence Chain

| # | Evidence | Source | Timestamp |
|---|----------|--------|-----------|
| 1 | `quickbooks-runtime` connector: active, connected | PM2 + Connector Registry | Phase 31 |
| 2 | Company: "Raw Japanese Bistro and Sushi Bar" detected | QB runtime response | 2026-06-18 |
| 3 | QB Desktop open on `qb-laptop-01` | Machine detection | Phase 31 |
| 4 | Accounting Engine health: `{"ok":true}` | Port 8844 HTTP | 2026-06-24 |
| 5 | `accounting.db` exists with ledger data | File system | Phase 31 |
| 6 | Last sync: `2026-06-18T08:29:36.703Z` | QB runtime | Phase 31 |

---

## 6. Recovery Actions Required

| # | Action | Owner | Time | Impact |
|---|--------|-------|------|--------|
| 1 | Restart QB heartbeat on Laptop1 (Stockton) | Dev1/IT | 30 min | FRESH DATA — revenue, labor, food cost all current |
| 2 | Verify sync cycle resumes | Dev1 | 15 min | Confirms heartbeat is periodic |
| 3 | Refresh dashboard QB widget | Mi (automated) | 5 min | Dashboard shows current financials |

**Total Recovery Time:** ~50 min (requires Dev1 on Stockton laptop)

---

## 7. Why SYSTEM_RECOVERY_PARTIAL

**NOT SYSTEM_RECOVERY_OPERATIONAL because:**
- Heartbeat is stale (6 days since last sync)
- Data is not fresh enough for operational decisions
- Requires physical access to Stockton laptop to restart

**NOT SYSTEM_RECOVERY_BLOCKED because:**
- Integration code is intact and functional
- Auth is connected (not expired)
- Company file is detected and open
- Accounting Engine is live on port 8844
- Data EXISTS in the system — just stale
- One restart action restores full operation

**SYSTEM_RECOVERY_PARTIAL is correct because:**
- ✅ Connectivity: EXISTS (auth connected, company detected)
- ⚠️ Data Availability: EXISTS but STALE (6-day-old snapshot)
- ⚠️ Dashboard Integration: EXISTS but STALE
- ✅ Recovery Path: CLEAR — single restart action needed

---

## 8. Path to SYSTEM_RECOVERY_OPERATIONAL

| Step | Action | Time | Cumulative |
|------|--------|------|------------|
| 1 | Dev1 restarts QB agent on Laptop1 | 30 min | 30 min |
| 2 | Verify heartbeat resumes (watch for 2 sync cycles) | 15 min | 45 min |
| 3 | Confirm fresh data appears in accounting.db | 5 min | 50 min |
| 4 | Dashboard auto-refreshes with current data | Auto | Auto |

**After these 4 steps: STATUS → SYSTEM_RECOVERY_OPERATIONAL**

---

*Rule honored: No financial data fabricated. All numbers sourced from Phase 31 live system queries.*
