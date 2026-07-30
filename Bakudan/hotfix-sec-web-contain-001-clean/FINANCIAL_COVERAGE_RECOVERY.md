# FINANCIAL COVERAGE RECOVERY

**Phase:** 16.1 — Final Recovery Summary
**Date:** 2026-06-17 16:55 (Asia/Saigon)

---

## Executive Summary

All 6 required deliverables have been generated. Financial coverage gaps are fully documented. CEO input is required to resolve blocked items.

---

## Deliverable Status

| Deliverable | Status | Key Finding |
|---|---|---|
| STORE_STATUS_AUDIT.md | ✅ Complete | 8 active stores (6 operational + 2 holding), 4 inactive |
| RENT_COVERAGE_REPORT.md | ✅ Complete | 5/6 operational stores missing rent recurring |
| TABC_COVERAGE_REPORT.md | ✅ Complete | 3/3 Texas stores missing TABC |
| INSURANCE_COVERAGE_REPORT.md | ✅ Complete | Only Modesto has 1 insurance (Amtrust GL) |
| MARKETPLACE_AUDIT_SETUP.md | ✅ Complete | 4 weekly audits need UI creation |
| FINANCIAL_COVERAGE_RECOVERY.md | ✅ This file | Summary + action plan |

---

## Coverage Before Recovery

| Category | Stores Covered | Stores Missing | Coverage % |
|---|---|---|---|
| Rent | 1 (Raw Stockton) | 5 (B1, B2, B3, Copper, Modesto) | 17% |
| Electricity | 1 (Raw PG&E) | 4 (B1, B2, B3 CPS not recurring) | 17% |
| Tax | 4 (Raw, Modesto, Heo, IFT) | 2 (B1, B2, B3 not tracked) | 50% |
| Insurance | 1 (Modesto Amtrust GL) | 5 (all others) | 14% |
| Licensing | 0 | 3 (B1, B2, B3 TABC) | 0% |
| Marketplace | 0 | 4 (DoorDash, UberEats, Yelp) | 0% |

---

## CEO Action Required

### P0 — BLOCKING (must resolve before Financial Coverage = PASS)

| # | Item | Store | Data Needed |
|---|---|---|---|
| 1 | Create rent recurring bills | B1, B2, B3, Copper, Modesto | Rent amounts + landlord/vendor |
| 2 | Create TABC annual bills | B1, B2, B3 | TABC expiration dates |
| 3 | Confirm inactive stores | JHT, B2, Raw, HEO | Confirm closed → archive bills |

### P1 — Required for full coverage

| # | Item | Store | Data Needed |
|---|---|---|---|
| 4 | Insurance recurring bills | All 6 operational stores | Vendor + premium for each type |
| 5 | CPS Energy recurring templates | B1, B2, B3 | Convert existing one-time to recurring |
| 6 | Water recurring bills | All stores | Vendor + monthly amount |
| 7 | Marketplace weekly audits | B1, B2, B3, Raw Stockton | Create via UI (4 parent tasks) |
| 8 | Modesto/Copper marketplace? | Modesto, Copper | Confirm if they use DoorDash/UberEats/Yelp |

### P2 — Enhancement

| # | Item | Store | Data Needed |
|---|---|---|---|
| 9 | Health permit tracking | All stores | Permit numbers + expiration |
| 10 | Waste service bills | All stores | Vendor + monthly amount |
| 11 | CA insurance for Raw Stockton | Raw Stockton | Amtrust or other CA carrier |
| 12 | CA payroll tax tracking | Raw Stockton | EDD account info |

---

## Success Criteria Check

| Criterion | Required | Status |
|---|---|---|
| Every active store has Rent | YES | ❌ 1/6 |
| Every active store has Utility | YES | ⚠️ 1/6 recurring |
| Every active store has Insurance | YES | ❌ 1/6 |
| Every active store has Tax | YES | ✅ 4/6 |
| Every active store has License | YES | ❌ 0/3 (Texas) |
| Every recurring process has owner | YES | ✅ 8/8 (existing) |
| Every recurring has escalation | YES | ✅ 8/8 (existing) |
| Every recurring has reminder | YES | ✅ 8/8 (existing) |

---

**OVERALL STATUS: BLOCKED — CEO must provide rent amounts, TABC dates, and insurance data to proceed.**

**Once CEO provides data, all missing recurring bills can be created within one execution cycle through the audit endpoints.**
