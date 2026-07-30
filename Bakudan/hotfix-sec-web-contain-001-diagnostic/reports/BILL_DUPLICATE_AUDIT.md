# WS1 — Bill Duplicate Audit
**Phase 13.5 | CEO P0 Directive | Generated: 2026-06-12**

## Verdict: ❌ FAIL

| Metric | Value |
|--------|-------|
| Total active bills | 347 |
| Duplicate groups found | 20 |
| Bills to archive (keep 1 per group) | 307 |
| Duplication rate | 88% of all bills |
| Detection method | Exact match: title + store_id + amount + due_date |

## Root Cause
The recurrence/AI-import engine has no deduplication guard. Every time it runs, it re-creates the same recurring bills. Bills #22–27 (May batch) have 25–28 duplicates each, indicating the engine ran ~29 times on that dataset.

## Duplicate Groups — Full Detail

| # | Keep (Canonical) | Archive Count | Title | Store | Amount | Due Date | Archive IDs |
|---|-----------------|---------------|-------|-------|--------|----------|-------------|
| 1 | #25 | 28 | Raw Sale Tax | Raw Stockton | $0.00 | 2026-05-20 | 31,37,43,49,55,61,67,73,79,85,91,97,103,109,115,121,127,133,139,145,151,157,163,166,169,172,178,184 |
| 2 | #26 | 28 | Raw QB Tax | Raw Stockton | $0.00 | 2026-05-20 | 32,38,44,50,56,62,68,74,80,86,92,98,104,110,116,122,128,134,140,146,152,158,164,167,170,173,179,185 |
| 3 | #27 | 28 | Raw PGE | Raw Stockton | $0.00 | 2026-05-20 | 33,39,45,51,57,63,69,75,81,87,93,99,105,111,117,123,129,135,141,147,153,159,165,168,171,174,180,186 |
| 4 | #22 | 25 | Heo Holding Sale Tax | Heo Holding | $0.00 | 2026-05-20 | 28,34,40,46,52,58,64,70,76,82,88,94,100,106,112,118,124,130,136,142,148,154,160,175,181 |
| 5 | #23 | 25 | IFT Sale Tax | IFT | $0.00 | 2026-05-20 | 29,35,41,47,53,59,65,71,77,83,89,95,101,107,113,119,125,131,137,143,149,155,161,176,182 |
| 6 | #24 | 25 | Amtrust | Modesto | $0.00 | 2026-05-23 | 30,36,42,48,54,60,66,72,78,84,90,96,102,108,114,120,126,132,138,144,150,156,162,177,183 |
| 7 | #190 | 20 | Raw General | Raw Stockton | $0.00 | 2026-06-01 | 198,206,214,222,230,238,246,254,262,270,275,292,300,305,313,321,326,331,336,344 |
| 8 | #191 | 20 | Raw Sale Tax | Raw Stockton | $0.00 | 2026-06-20 | 199,207,215,223,231,239,247,255,263,271,276,293,301,306,314,322,327,332,337,345 |
| 9 | #192 | 20 | Stockton - Prepayment | Raw Stockton | $0.00 | 2026-06-01 | 200,208,216,224,232,240,248,256,264,272,277,294,302,307,315,323,328,333,338,346 |
| 10 | #193 | 20 | Raw QB Tax | Raw Stockton | $0.00 | 2026-06-20 | 201,209,217,225,233,241,249,257,265,273,278,295,303,308,316,324,329,334,339,347 |
| 11 | #194 | 20 | Raw PGE | Raw Stockton | $0.00 | 2026-06-20 | 202,210,218,226,234,242,250,258,266,274,279,296,304,309,317,325,330,335,340,348 |
| 12 | #187 | 14 | Heo Holding Sale Tax | Heo Holding | $0.00 | 2026-06-20 | 195,203,211,219,227,235,243,251,259,267,297,310,318,341 |
| 13 | #188 | 14 | IFT Sale Tax | IFT | $0.00 | 2026-06-20 | 196,204,212,220,228,236,244,252,260,268,298,311,319,342 |
| 14 | #189 | 14 | Amtrust | Modesto | $0.00 | 2026-06-23 | 197,205,213,221,229,237,245,253,261,269,299,312,320,343 |
| 15 | #280 | 1 | TEST DUPLICATE BILL | Raw Stockton | $100.00 | 2026-07-01 | 286 |
| 16 | #281 | 1 | Raw General | Raw Stockton | $0.00 | 2026-07-01 | 287 |
| 17 | #282 | 1 | Raw Sale Tax | Raw Stockton | $0.00 | 2026-07-20 | 288 |
| 18 | #283 | 1 | Stockton - Prepayment | Raw Stockton | $0.00 | 2026-07-01 | 289 |
| 19 | #284 | 1 | Raw QB Tax | Raw Stockton | $0.00 | 2026-07-20 | 290 |
| 20 | #285 | 1 | Raw PGE | Raw Stockton | $0.00 | 2026-07-20 | 291 |

## CEO Directive Compliance
- ✅ DO NOT hard-delete — archive only
- ✅ Human review required before archiving
- ✅ Canonical IDs identified for each group
- ⏳ PENDING: Admin must review and archive at `/admin/duplicates`

## Screenshot Evidence
![Overdue Bills Drill-Down showing duplicate Raw General and Stockton-Prepayment](../qa/evidence/screenshots/K-02-drilldown-overdue-bills.png)

*Screenshot confirms: "Raw General" and "Stockton - Prepayment" appearing repeatedly (20+ times) in the overdue drill-down view*
