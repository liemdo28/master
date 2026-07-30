# RENT COVERAGE REPORT

**Phase:** 16.1 — P0 Rent Coverage
**Date:** 2026-06-17 16:48 (Asia/Saigon)

---

## Active Stores Requiring Rent

| Store | ID | Rent Recurring | Status | Action Required |
|---|---|---|---|---|
| Bakudan - The Rim (B1) | 5 | ❌ MISSING | NOT COVERED | Create monthly rent bill |
| Bakudan - Stone Oak (B2) | 6 | ❌ MISSING | NOT COVERED | Create monthly rent bill |
| Bakudan - Bandera (B3) | 7 | ❌ MISSING | NOT COVERED | Create monthly rent bill |
| Copper (C1, C2, C3) | 10 | ❌ MISSING | NOT COVERED | Create monthly rent bill |
| Modesto | 11 | ❌ MISSING | NOT COVERED | Create monthly rent bill |
| Raw Stockton | 2 | ✅ ID=17 "Stockton - Prepayment" | COVERED | Verify amount reflects true rent |

## Holding/Corporate Stores (No Rent Expected)

| Store | ID | Rationale |
|---|---|---|
| Heo Holding | 12 | Holding entity — no physical premises |
| IFT | 8 | Holding entity — no physical premises |

---

## Inactive Stores (Confirm & Archive)

| Store | ID | Bills | Action |
|---|---|---|---|
| JHT | 1 | 1 (Water $1,250) | Archive bill if store closed |
| B2 | 3 | 0 | Confirm duplicate of id=6, archive |
| Raw | 4 | 0 | Confirm duplicate of id=2, archive |
| HEO | 9 | 0 | Confirm duplicate of id=12, archive |

---

## Required Fields for Rent Recurring Bill

| Field | Value |
|---|---|
| title | [Store Name] — Monthly Rent |
| store_id | [store.id] |
| category | rent |
| repeat_type | monthly |
| repeat_interval | 1 |
| due_date | 1st of each month |
| amount | [NEEDS CEO INPUT] |
| vendor | [NEEDS CEO INPUT] |
| status | pending |
| created_by | admin (user_id=1) |

---

## Summary

| Metric | Value |
|---|---|
| Active stores needing rent | 6 |
| Stores with rent recurring | 1 (Raw Stockton only) |
| Stores missing rent | 5 (B1, B2, B3, Copper, Modesto) |
| CEO input required | Rent amounts + vendor for each store |

**Status: BLOCKED — CEO must provide rent amounts and vendor information for B1, B2, B3, Copper, Modesto before recurring bills can be created.**
