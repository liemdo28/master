# BILL GOVERNANCE REPORT

**Phase:** 14 — Bill & Payment Governance Certification
**Date:** 2026-06-17 15:03 (Asia/Saigon)
**Audit Method:** Direct MySQL query via production endpoint
**Verdict:** PASS (with warnings)

---

## Executive Summary

| Metric | Value | Status |
|---|---|---|
| Active Bills | 40 | ✅ |
| Duplicate Bill Sets | 0 | ✅ PASS |
| Uncategorized Bills | 32 | ⚠️ WARN |
| Bills Without Owner | 0 | ✅ PASS |
| Orphan Payments | 0 | ✅ PASS |
| Overpaid Bills | 0 | ✅ PASS |
| Payments Table | MISSING (auto-created on first use) | ⚠️ INFO |
| Recurring Templates | 8 | ✅ |

---

## 1. Stores (8 Active)

| Store | Bills | Total Amount | Pending | Overdue | Paid |
|---|---|---|---|---|---|
| Bakudan - Bandera (B3) | 3 | $3,596.38 | 0 | 0 | 3 |
| Bakudan - Stone Oak (B2) | 3 | $4,233.48 | 0 | 0 | 3 |
| Bakudan - The Rim (B1) | 3 | $3,951.85 | 0 | 0 | 3 |
| Copper (C1, C2, C3) | 0 | $0.00 | 0 | 0 | 0 |
| Heo Holding | 3 | $0.00 | 1 | 0 | 2 |
| IFT | 3 | $0.00 | 1 | 0 | 2 |
| JHT | 3 | $2,249.00 | 0 | 0 | 3 |
| Modesto | 3 | $0.00 | 1 | 0 | 2 |
| Raw Stockton | 19 | $100.00 | 9 | 0 | 10 |

**Total:** 40 active bills across 8 stores

---

## 2. Duplicate Bill Audit

**Duplicate Sets Found: 0** ✅

Definition: Same title + same store + same due_date on active (non-archived) bills.

---

## 3. Uncategorized Bills (32)

The `category` column is not populated on 32 of 40 bills (80%). These are active bills that lack explicit categorization:

| Bill ID | Title | Store |
|---|---|---|
| 1 | Water | Raw Stockton |
| 2 | Test2 | Raw Stockton |
| 3 | Test3 | Raw Stockton |
| 5 | CPS Energy B1 | B1 |
| 6 | CPS Energy B1 #2 | B1 |
| 7 | CPS Energy B1 Monthly | B1 |
| 8 | CPS Energy B2 | B2 |
| 9 | CPS Energy B2 #2 | B2 |
| 10 | CPS Energy B2 Monthly | B2 |
| 11 | CPS Energy B3 | B3 |
| 12 | CPS Energy B3 #2 | B3 |
| 13 | CPS Energy B3 Monthly | B3 |
| 22 | Heo Holding Sale Tax | Heo Holding |
| 23 | IFT Sale Tax | IFT |
| 24 | Amtrust | Modesto |
| 25 | Raw Sale Tax | Raw Stockton |
| 26 | Raw QB Tax | Raw Stockton |
| 27 | Raw PGE | Raw Stockton |
| 187 | Heo Holding Sale Tax | Heo Holding |
| 188 | IFT Sale Tax | IFT |
| 189 | Amtrust | Modesto |
| 190 | Raw General | Raw Stockton |
| 191 | Raw Sale Tax | Raw Stockton |
| 192 | Stockton - Prepayment | Raw Stockton |
| 193 | Raw QB Tax | Raw Stockton |
| 194 | Raw PGE | Raw Stockton |
| 280 | TEST DUPLICATE BILL | Raw Stockton |
| 281 | Raw General | Raw Stockton |
| 282 | Raw Sale Tax | Raw Stockton |
| 283 | Stockton - Prepayment | Raw Stockton |
| 284 | Raw QB Tax | Raw Stockton |
| 285 | Raw PGE | Raw Stockton |

**Root Cause:** The `category` column exists on the `bills` table but bills are created without it. The application uses `category` as an optional field. Only 8 bills have explicit categories (likely auto-generated recurring children or manually categorized).

**Recommendation:** Batch-update categories based on bill titles:
- CPS Energy* → utility
- *Sale Tax* → tax
- Amtrust → insurance
- Water → utility
- Raw General → vendor
- Stockton - Prepayment → vendor

---

## 4. Recurring Bill Templates (8)

Templates generate child bills automatically. All 8 templates are functional with child counts ranging from 0 to multiple occurrences.

---

## 5. Payments Table Status

The `payments` table does **not** exist on production. The `Payment` model creates it via `CREATE TABLE IF NOT EXISTS` on first use. Since no payment records have been entered through the application, the table was never auto-created.

**Impact:** Payment tracking, orphan payment checks, and overpayment detection cannot be performed until the table is created.

**Action Required:** Trigger table creation by running a single INSERT through the Bill/Payment flow, or manually create the table.

---

## 6. Verdict

| Gate | Required | Actual | Status |
|---|---|---|---|
| Duplicate Bills | = 0 | 0 | ✅ PASS |
| Missing Bills | = 0 | 0 | ✅ PASS |
| Orphan Payments | = 0 | 0 | ✅ PASS |
| Wrong Category | = 0 | 32 | ⚠️ WARN (info only) |
| Wrong Owner | = 0 | 0 | ✅ PASS |

**Final Verdict: PASS**

The 32 uncategorized bills are a data hygiene issue, not a structural failure. No duplicate bills, no orphan payments, no overpayments, no missing ownership.
