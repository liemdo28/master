# STORE STATUS AUDIT

**Phase:** 16.1 — Store Status Audit
**Date:** 2026-06-17 17:15 (Asia/Saigon)

---

## Active Stores (8)

| ID | Name | Bills | Recurring | Status | Type |
|---|---|---|---|---|---|
| 5 | Bakudan - The Rim (B1) | 3 | 0 | Needs Business Data (rent, TABC, insurance) | OPERATIONAL |
| 6 | Bakudan - Stone Oak (B2) | 0 | 0 | Needs Business Data (rent, TABC, insurance, utility) | OPERATIONAL |
| 7 | Bakudan - Bandera (B3) | 3 | 0 | Needs Business Data (rent, TABC, insurance) | OPERATIONAL |
| 10 | Copper (C1, C2, C3) | 0 | 0 | Needs Business Data (store status confirm) | OPERATIONAL |
| 12 | Heo Holding | 3 | 3 | ✅ COVERED | HOLDING |
| 8 | IFT | 3 | 3 | ✅ COVERED | HOLDING |
| 11 | Modesto | 3 | 3 | Needs Business Data (rent, insurance, store status) | OPERATIONAL |
| 2 | Raw Stockton | 19 | 5 | Needs Business Data (insurance) | OPERATIONAL |

## Inactive Stores (4) — Needs Business Data

| ID | Name | Bills | Current Status | Data Requested |
|---|---|---|---|---|
| 1 | JHT | 1 (Water $1,250) | INACTIVE (system-set) | Confirm: ACTIVE, DORMANT, or CORPORATE |
| 3 | B2 | 0 | INACTIVE (system-set) | Confirm: duplicate of id=6? Archive? |
| 4 | Raw | 0 | INACTIVE (system-set) | Confirm: duplicate of id=2? Archive? |
| 9 | HEO | 0 | INACTIVE (system-set) | Confirm: duplicate of id=12? Archive? |

---

## Store Classification

| Type | Stores | Obligation Scope |
|---|---|---|
| OPERATIONAL | B1, B2, B3, Raw Stockton, Modesto, Copper | Full stack: rent, utility, insurance, tax, licensing |
| HOLDING | Heo Holding, IFT | Tax filings only (currently covered) |

---

## Status Classification Key

| Status Type | Meaning |
|---|---|
| ✅ COVERED | System has all required recurring obligations |
| Needs Business Data | System structure is ready, but business-specific data is needed from CEO before recurring bills can be created |
| ❌ SYSTEM MISSING | System lacks required functionality (not applicable here) |

---

## What Needs Business Data (Not Missing/Error)

All gaps below are classified as **Needs Business Data** — the system is fully capable of creating recurring bills, but requires CEO input:

1. Rent amounts and landlord information
2. TABC license numbers and expiration dates
3. Insurance vendor, policy type, premium amounts, renewal dates
4. Store status confirmation for JHT, HEO, Copper, Modesto

See `BUSINESS_DATA_REQUESTS.md` for the full data request dashboard.
