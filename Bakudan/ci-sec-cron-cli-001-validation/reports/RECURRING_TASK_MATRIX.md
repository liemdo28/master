# RECURRING TASK MATRIX

**Phase:** 16 — Recurring Task Governance (Step 16.1)
**Date:** 2026-06-17 15:55 (Asia/Saigon)
**Source:** Production MySQL

---

## Current Recurring Bill Templates (8)

| ID | Name | Store | Category | Frequency | Owner | Backup Owner | Checker | Approver | Due Date | Next Occurrence | SLA | Evidence | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21 | Heo Holding Sale Tax | Heo Holding | tax | monthly | Store Mgr | CEO | Auto | CEO | 20th | 2026-07-20 | 5 days | Receipt | ✅ |
| 20 | IFT Sale Tax | IFT | tax | monthly | Store Mgr | CEO | Auto | CEO | 20th | 2026-07-20 | 5 days | Receipt | ✅ |
| 14 | Amtrust | Modesto | insurance | monthly | Store Mgr | CEO | Auto | CEO | 23rd | 2026-07-23 | 5 days | Receipt | ✅ |
| 15 | Raw General | Raw Stockton | vendor | monthly | Store Mgr | CEO | Auto | CEO | 1st | 2026-08-01 | 5 days | Receipt | ✅ |
| 19 | Raw PGE | Raw Stockton | utility | monthly | Store Mgr | CEO | Auto | CEO | 20th | 2026-08-20 | 5 days | Receipt | ✅ |
| 18 | Raw QB Tax | Raw Stockton | tax | monthly | Store Mgr | CEO | Auto | CEO | 20th | 2026-08-20 | 5 days | Receipt | ✅ |
| 16 | Raw Sale Tax | Raw Stockton | tax | monthly | Store Mgr | CEO | Auto | CEO | 20th | 2026-08-20 | 5 days | Receipt | ✅ |
| 17 | Stockton - Prepayment | Raw Stockton | vendor | monthly | Store Mgr | CEO | Auto | CEO | 1st | 2026-08-01 | 5 days | Receipt | ✅ |

---

## Required Recurring Operations — Gap Analysis

### Bakudan Stores (B1, B2, B3) — Missing

| Category | Expected Bill | Exists | Action Required |
|---|---|---|---|
| Rent | Monthly rent per store | ❌ NO | Create recurring bill per store |
| Electricity (CPS Energy) | Monthly CPS bill per store | ❌ NO (existing are not recurring templates) | Convert to recurring templates |
| Water | Monthly water per store | ❌ NO | Create recurring bill per store |
| Insurance (Amtrust) | Monthly insurance per store | ❌ NO | Create recurring bill per store |
| Sales Tax | Monthly sales tax | ❌ NO | Create recurring bill per store |
| TABC License | Annual TABC | ❌ NO | Create annual recurring |
| Health Permit | Annual health permit | ❌ NO | Create annual recurring |

### Raw Stockton — Partially Covered

| Category | Expected Bill | Exists | Action Required |
|---|---|---|---|
| Rent (Joule Park West) | Monthly rent | ❌ NO | Create recurring bill |
| Electricity (PG&E) | Monthly PG&E | ✅ YES (ID 19) | Verify SLA/evidence |
| Sales Tax (CA CDTFA) | Monthly | ✅ YES (ID 16) | Verify SLA/evidence |
| QB Tax (QuickBooks) | Monthly | ✅ YES (ID 18) | Verify SLA/evidence |
| General Vendor | Monthly | ✅ YES (ID 15) | Verify SLA/evidence |
| Prepayment | Monthly | ✅ YES (ID 17) | Verify SLA/evidence |

### Modesto — Partially Covered

| Category | Expected Bill | Exists | Action Required |
|---|---|---|---|
| Insurance (Amtrust) | Monthly | ✅ YES (ID 14) | Verify SLA/evidence |
| All others | Various | ❌ NO | Create per store |

### Heo Holding — Covered

| Category | Expected Bill | Exists |
|---|---|---|
| Sales Tax (CA CDTFA) | Monthly | ✅ YES (ID 21) |

### IFT — Covered

| Category | Expected Bill | Exists |
|---|---|---|
| Sales Tax (CA CDTFA) | Monthly | ✅ YES (ID 20) |

---

## Marketplace Recurring Operations — All Missing

| Operation | Frequency | Parent+Subtask Pattern | Exists |
|---|---|---|---|
| DoorDash Campaign Review | Weekly | Parent task → 4 store subtasks | ❌ NO |
| DoorDash Error Charge Recovery | Weekly | Parent task → 4 store subtasks | ❌ NO |
| Uber Eats Weekly Audit | Weekly | Parent task → 4 store subtasks | ❌ NO |
| Yelp Reviews Weekly Management | Weekly | Parent task → 4 store subtasks | ❌ NO |

---

## Summary

| Metric | Count |
|---|---|
| Existing recurring bill templates | 8 |
| Bakudan stores missing rent | 3 |
| Bakudan stores missing utility recurring | 3 |
| Marketplace weekly audits missing | 4 |
| Total new recurring items needed | ~20 |
