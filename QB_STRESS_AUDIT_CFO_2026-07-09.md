# QB STRESS AUDIT — CFO + Chef Accountant View
**Date:** 2026-07-09 | **Role:** DEV4 (Coder, Designer, CFO, Chef Accountant)  
**Dashboard:** http://127.0.0.1:4001/qb-dashboard.html  
**DB:** `qb-mirror.db` — 11.6 MB | WAL mode

---

## EXECUTIVE SUMMARY

```
7 STORES SYNCED  |  1 STORE STALE
QB DESKTOP: CLOSED on DESKTOP-JFUSRIH — sync PAUSED for 6 stores
DEV1 ACTION REQUIRED: Open QB Desktop immediately
```

| Metric | Value |
|--------|-------|
| QB Files in `qb-mirror.db` | **8** |
| Actively synced (24h window) | **7** |
| Stale / never synced | **1** — Laptop1-Placeholder |
| Stores in `qb-mapping.json` | 7 |
| "8th store" | Laptop1-Placeholder — in mirror, NOT in mapping |

**7 Synced Stores:** Stockton, The Rim, Stone Oak, Bandera, Copper, IFT, Jinya  
**1 Stale Store:** Laptop1-Placeholder (`laptop1-default` — placeholder only, no real QBW file)

---

## SECTION 1: STORE-BY-STORE SYNC STATUS

| # | Store | Sync Ops | Last Sync | 24h | 1h | Machine |
|---|-------|--------:|-----------|----:|----:|---------|
| 1 | Stockton | 520 | 03:41 today | 393 | 13 | qb-laptop-01 |
| 2 | Jinya | 180 | 01:53 today | 90 | 0 | DESKTOP-JFUSRIH |
| 3 | The Rim | 51 | 03:11 today | 29 | 10 | DESKTOP-JFUSRIH |
| 4 | Bandera | 35 | 03:20 today | 24 | 12 | DESKTOP-JFUSRIH |
| 5 | IFT | 35 | 03:38 today | 15 | 7 | DESKTOP-JFUSRIH |
| 6 | Copper | 27 | 03:23 today | 19 | 8 | DESKTOP-JFUSRIH |
| 7 | Stone Oak | 22 | 03:15 today | 15 | 12 | DESKTOP-JFUSRIH |
| 8 | Laptop1-Placeholder | 0 | 2026-07-08 17:37 | 0 | 0 | qb-laptop-02 |

All 7 real stores synced within last 24h. Jinya last sync 01:53 (~2h ago, no 1h activity — QB may have been closed).

---

## SECTION 2: QB FILE PATHS & MACHINE MAP

| Store | QBW File | Machine | Status |
|-------|---------|---------|--------|
| Stockton | `C:\QB Data\Raw Stockton\rawstockton.qbw` | qb-laptop-01 | LIVE — 520 ops |
| Jinya | `C:\QB\IFT\Jinya Ramen.qbw` | DESKTOP-JFUSRIH | LIVE |
| The Rim | `C:\QB\Bakudan\B1\jht ventures inc (Feb 2025).qbw` | DESKTOP-JFUSRIH | LIVE |
| Bandera | `C:\QB\Bakudan\B3\Bakudan BP LLC (Feb 2026).qbw` | DESKTOP-JFUSRIH | LIVE |
| IFT | `C:\QB\IFT\new tea house (Feb 2025).qbw` | DESKTOP-JFUSRIH | LIVE |
| Copper | `C:\QB\Copper\The Coppers LLC (Feb 2025).qbw` | DESKTOP-JFUSRIH | LIVE |
| Stone Oak | `C:\QB\Bakudan\B2\Bakudan Ramen LLC (Feb 2026).qbw` | DESKTOP-JFUSRIH | LIVE |
| Placeholder | `laptop1-default` | qb-laptop-02 | STALE — no real file |

6 of 7 Bakudan stores on DESKTOP-JFUSRIH. Only Stockton on separate laptop.

---

## SECTION 3: ENTITY COUNTS PER STORE

| Store | Accounts | Customers | Vendors | Invoices | SalesRcpts | Bills | Payments |
|-------|--------:|--------:|--------:|---------:|----------:|------:|--------:|
| Stockton | 232 | 37 | 1,759 | 0 | 139 | 435 | 0 |
| The Rim | 165 | 16 | 841 | 0 | 25 | 0 | 0 |
| Stone Oak | 138 | 6 | 358 | 0 | 25 | 25 | 0 |
| Copper | 136 | 9 | 242 | 0 | 25 | 6 | 0 |
| IFT | 122 | 5 | 177 | 0 | 25 | 0 | 0 |
| Bandera | 112 | 8 | 317 | 0 | 25 | 25 | 0 |
| Jinya | 81 | 8 | 171 | 0 | 25 | 0 | 0 |
| **TOTAL** | **986** | **89** | **3,865** | **0** | **289** | **491** | **0** |

Note: All stores have **0 Invoices** — normal for restaurant POS (Sales Receipts used instead of Invoices).

---

## SECTION 4: FINANCIAL TOTALS — REVENUE FROM LINE ITEMS JSON

**Critical finding:** The `total_amount` field on Sales Receipts is $0 for 6 of 7 stores. Actual revenue is in the `line_items_json` field. Parsing positive items as revenue:

| Store | SR Records | SR_field $0 | Revenue (line items) | Neg Items | Net Revenue |
|-------|----------:|----------:|-------------------:|----------:|------------:|
| Jinya | 25 | $0 | **$10,129,940** | -$5,074,404 | **$5,055,536** |
| Bandera | 25 | $0 | **$1,221,882** | -$618,294 | **$603,588** |
| Stockton | 139 | $75,026 | $613,172 | -$279,758 | $333,414 |
| Copper | 25 | $0 | **$71,789** | -$36,427 | **$35,362** |
| IFT | 25 | $0 | **$35,948** | -$18,373 | **$17,575** |
| Stone Oak | 25 | $0 | (in Bak