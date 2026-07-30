# STORE FINANCIAL COVERAGE MATRIX

**Phase:** Financial Coverage Audit by Store
**Date:** 2026-06-17 16:00 (Asia/Saigon)
**Source:** Production MySQL via `recurring-scan-run.php`

---

## Audit Matrix

### Bakudan - The Rim (B1) — Texas

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Rent | Monthly rent payment | ❌ | — | monthly | — | — | MISSING | Create |
| Electricity | CPS Energy monthly | ⚠️ | 5,6,7 | one-time | — | Apr 2026 | NOT RECURRING | Convert to template |
| Water | Monthly water bill | ⚠️ | — | — | — | — | MISSING | Create |
| Waste | Monthly waste pickup | ❌ | — | — | — | — | MISSING | Create |
| Insurance | Amtrust / General Liability | ❌ | — | — | — | — | MISSING | Create |
| Sales Tax | Texas sales tax | ❌ | — | — | — | — | MISSING | Create |
| TABC License | Annual alcohol permit | ❌ | — | annual | — | — | MISSING | Create |
| Health Permit | Annual health permit | ❌ | — | annual | — | — | MISSING | Create |

### Bakudan - Stone Oak (B2) — Texas

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Rent | Monthly rent payment | ❌ | — | monthly | — | — | MISSING | Create |
| Electricity | CPS Energy monthly | ⚠️ | 8,9,10 | one-time | — | Apr 2026 | NOT RECURRING | Convert to template |
| Water | Monthly water bill | ❌ | — | — | — | — | MISSING | Create |
| Waste | Monthly waste pickup | ❌ | — | — | — | — | MISSING | Create |
| Insurance | Amtrust / General Liability | ❌ | — | — | — | — | MISSING | Create |
| Sales Tax | Texas sales tax | ❌ | — | — | — | — | MISSING | Create |
| TABC License | Annual alcohol permit | ❌ | — | annual | — | — | MISSING | Create |
| Health Permit | Annual health permit | ❌ | — | annual | — | — | MISSING | Create |

### Bakudan - Bandera (B3) — Texas

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Rent | Monthly rent payment | ❌ | — | monthly | — | — | MISSING | Create |
| Electricity | CPS Energy monthly | ⚠️ | 11,12,13 | one-time | — | Apr 2026 | NOT RECURRING | Convert to template |
| Water | Monthly water bill | ❌ | — | — | — | — | MISSING | Create |
| Waste | Monthly waste pickup | ❌ | — | — | — | — | MISSING | Create |
| Insurance | Amtrust / General Liability | ❌ | — | — | — | — | MISSING | Create |
| Sales Tax | Texas sales tax | ❌ | — | — | — | — | MISSING | Create |
| TABC License | Annual alcohol permit | ❌ | — | annual | — | — | MISSING | Create |
| Health Permit | Annual health permit | ❌ | — | annual | — | — | MISSING | Create |

### Raw Sushi Stockton — California

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Rent | Joule Park West monthly | ❌ | — | monthly | — | — | MISSING | Create |
| Electricity | PG&E monthly | ✅ | 19 | monthly | Store Mgr | 20th | ✅ ACTIVE | — |
| Sales Tax | CA CDTFA monthly | ✅ | 16 | monthly | Store Mgr | 20th | ✅ ACTIVE | — |
| QB Tax | QuickBooks filing | ✅ | 18 | monthly | Store Mgr | 20th | ✅ ACTIVE | — |
| General Vendor | Monthly vendor | ✅ | 15 | monthly | Store Mgr | 1st | ✅ ACTIVE | — |
| Prepayment | Monthly prepayment | ✅ | 17 | monthly | Store Mgr | 1st | ✅ ACTIVE | — |
| Water | Monthly water | ❌ | — | — | — | — | MISSING | Verify needed |
| Insurance | CA insurance | ❌ | — | — | — | — | MISSING | Verify needed |
| CA Payroll Tax | CA payroll tax | ❌ | — | — | — | — | MISSING | Verify needed |

### Modesto

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Insurance | Amtrust monthly | ✅ | 14 | monthly | Store Mgr | 23rd | ✅ ACTIVE | — |
| All others | Various | ❌ | — | — | — | — | MISSING | Create per store |

### Heo Holding

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Sales Tax | CA CDTFA monthly | ✅ | 21 | monthly | Store Mgr | 20th | ✅ ACTIVE | — |

### IFT

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| Sales Tax | CA CDTFA monthly | ✅ | 20 | monthly | Store Mgr | 20th | ✅ ACTIVE | — |

### Copper (C1, C2, C3)

| Category | Expected Obligation | Exists | Bill ID | Frequency | Owner | Due Date | Status | Gap |
|---|---|---|---|---|---|---|---|---|
| All | Various | ❌ | — | — | — | — | MISSING | 0 active bills |

---

## Coverage Summary

| Store | Total Required | Covered | Missing | Coverage % |
|---|---|---|---|---|
| Bakudan - The Rim (B1) | 8 | 0 (not recurring) | 8 | 0% |
| Bakudan - Stone Oak (B2) | 8 | 0 (not recurring) | 8 | 0% |
| Bakudan - Bandera (B3) | 8 | 0 (not recurring) | 8 | 0% |
| Raw Sushi Stockton | 8 | 5 | 3 | 63% |
| Modesto | 8 | 1 | 7 | 13% |
| Heo Holding | 2 | 1 | 1 | 50% |
| IFT | 2 | 1 | 1 | 50% |
| Copper (C1, C2, C3) | 8 | 0 | 8 | 0% |

---

## Critical Gaps

1. **No rent recurring bills exist for ANY store**
2. **No insurance recurring bills for Bakudan stores** (Amtrust only exists for Modesto)
3. **No TABC license tracking for Texas stores**
4. **No health permit tracking**
5. **Copper stores have ZERO bills** — completely uncovered
6. **Existing CPS Energy bills are one-time, not recurring templates**

---

## Texas-Specific Requirements

| Requirement | B1 | B2 | B3 |
|---|---|---|---|
| TABC License | ❌ | ❌ | ❌ |
| Alcohol Beverage Filing | ❌ | ❌ | ❌ |
| Texas Sales Tax | ❌ | ❌ | ❌ |
| CPS Energy | ⚠️ one-time | ⚠️ one-time | ⚠️ one-time |

## California-Specific Requirements

| Requirement | Raw Stockton | Heo Holding | IFT | Modesto |
|---|---|---|---|---|
| CA CDTFA Sales Tax | ✅ | ✅ | ✅ | ❌ |
| PG&E | ✅ | N/A | N/A | N/A |
| CA Payroll Tax | ❌ | N/A | N/A | ❌ |
| CA Insurance | ❌ | N/A | N/A | ✅ (Amtrust) |
