# FINANCE TRUTH RECOVERY REPORT

**Generated:** 2026-06-15T17:23:00+07:00
**Status:** ✅ FIXED — Finance Truth Path Restored

---

## What Was Fixed

1. **Accounting Engine Route Mismatch** — mi-core connector called `/api/stats` but engine serves at `/stats`
   - Fixed in `accounting-connector.ts` + compiled `accounting-connector.js`
   - Accounting engine now returns live data ✅

2. **Finance Cache Updated** — Fresh accounting data written to visibility cache

3. **QB Runtime Evidence Verified** — Real data extracted from `qb-agent.db`

---

## Finance Questions — Real Answers

### Q: Doanh thu Raw Sushi bao nhiêu?

> **Có dữ liệu từ QB activity log (2026-06-14):**
>
> | Field | Value |
> |---|---|
> | Store | Raw Japanese Bistro and Sushi Bar |
> | Business Date | 2026-06-14 |
> | Total Transactions | 2 |
> | Total Amount | **$0.00** |
> | Latest Sales Receipt | Ref #5392, date 2026-06-01, amount $0.00, customer "Dine In" |
> | Latest Bank Deposit | 2026-05-26, Wells Fargo2 x9804 |
>
> **Lưu ý:** Doanh thu hiện $0.00 vì QB chưa có invoice/payment/journal entry nào trong 90 ngày qua. Sales receipt #5392 (2026-06-01) cũng có amount = $0.00. Dữ liệu này có thể chưa được cập nhật đầy đủ từ QuickBooks Desktop → cần Dev1 xác nhận lại data entry trên QB Desktop.
>
> **Confidence:** Medium — dữ liệu thật từ QB nhưng có thể chưa đầy đủ.

### Q: Chi phí tháng này bao nhiêu?

> **Có dữ liệu từ Accounting Engine (live):**
>
> | Field | Value |
> |---|---|
> | Total Cost | **$0.00** |
> | QA Cost | $0.00 (0 QA runs) |
> | Model Cost | $0.00 |
> | Patches | 0 |
> | Wasted Effort | 0% |
>
> **Lưu ý:** Accounting engine theo dõi chi phí kỹ thuật (QA runs, patches, model usage), không phải chi phí kinh doanh (rent, payroll, food cost). Chi phí kinh doanh thực tế cần trích xuất từ QB invoices/bills — hiện chưa có data trong QB (0 invoices, 0 bills trong 90 ngày).
>
> **Confidence:** High cho accounting data, N/A cho business expenses.

### Q: QB sync sao rồi?

> **PARTIALLY RECOVERED:**
>
> | Signal | Status |
> |---|---|
> | Company Identity | ✅ Verified — Raw Japanese Bistro and Sushi Bar (raw-stockton) |
> | Machine | ✅ qb-laptop-01 allowed |
> | QB Desktop Open | ✅ true |
> | Checksum | ✅ No active mismatch (baseline reset 2026-06-14) |
> | Last Successful Sync | 2026-06-14T15:04:32 UTC (~25h ago) |
> | Last Sync Status | completed |
> | Dev1 Runtime | ⚠️ BLOCKED |
> | Heartbeat | ⚠️ Timeout to 100.118.102.113:4001 |
> | Outbox Pending | 1,268 items |
> | Activity Log | 1 record (2026-06-14, 2 txns, $0.00) |
>
> **Action needed:** Dev1 must restore Laptop1 QB agent heartbeat path and clear the 1,268 outbox pending items.

---

## Verification Summary

| Layer | Before Fix | After Fix |
|---|---|---|
| QB (qb-agent.db) | ⚠️ stale sync, identity verified | ✅ evidence extracted, identity verified |
| Accounting Engine | ❌ 404 on all routes | ✅ live data (39 metrics, 12 audit rows, ledger verified) |
| Finance Cache | ⚠️ stale accounting data | ✅ fresh accounting data written |
| Finance API | 🔒 auth required (expected) | ✅ confirmed working behind PIN auth |

---

## Accounting Engine Fix Details

**Root cause:** Path prefix mismatch (`/api/stats` vs `/stats`)

**Files changed:**
- `server/src/visibility/connectors/accounting-connector.ts` — source
- `server/dist/visibility/connectors/accounting-connector.js` — compiled

**Applied fix:** Remove `/api` prefix from all 3 API calls

**Verification:**
```
GET /stats → 39 metrics, 12 audit rows, WAL mode ✅
GET /costs → $0.00 total, 0 QA runs ✅
GET /stats/ledger → valid, chain intact, 12 rows ✅
```

---

## Target Status: ✅ FINANCE_TRUTH_READY

Finance truth path restored:
- Real answers available for all 3 questions
- No mock data, no hallucination
- Explicit "unavailable" when data is missing
- Accounting engine returns live data
- QB evidence verified from real database
- All queries complete without timeout
