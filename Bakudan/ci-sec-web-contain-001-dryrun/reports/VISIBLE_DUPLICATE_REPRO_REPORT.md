# VISIBLE DUPLICATE REPRO REPORT

**Date:** 2026-06-22 12:29 PM → Updated 1:23 PM (Asia/Saigon)
**Status:** ✅ AUDIT COMPLETE

## Production Data Summary
- **Active Bills:** 37
- **Active Tasks:** 1,662 (22 archived as duplicates)
- **Payments:** Table does not exist on production

## Bill Duplicate Detection

### Bill Exact Duplicates (title + store + due_date)
**Groups: 0 | Records: 0**

No exact duplicates found.

### Bill Soft Duplicates (title + store + amount)
**Groups: 8 | Records: 27 — all legitimate recurring bills**

| Bill | Store | Due Dates | IDs | Verdict |
|------|-------|-----------|-----|---------|
| Raw PGE | Raw Stockton | 04/20, 05/20, 06/20, 07/20 | 19,27,194,285 | ✅ Legit recurrence |
| Raw QB Tax | Raw Stockton | 04/20, 05/20, 06/20, 07/20 | 18,26,193,284 | ✅ Legit recurrence |
| Raw Sale Tax | Raw Stockton | 04/20, 05/20, 06/20, 07/20 | 16,25,191,282 | ✅ Legit recurrence |
| Raw General | Raw Stockton | 05/01, 06/01, 07/01 | 15,190,281 | ✅ Legit recurrence |
| Stockton - Prepayment | Raw Stockton | 05/01, 06/01, 07/01 | 17,192,283 | ✅ Legit recurrence |
| IFT Sale Tax | IFT | 04/20, 05/20, 06/20 | 20,23,188 | ✅ Legit recurrence |
| Amtrust | Modesto | 04/23, 05/23, 06/23 | 14,24,189 | ✅ Legit recurrence |
| Heo Holding Sale Tax | Heo Holding | 04/20, 05/20, 06/20 | 21,22,187 | ✅ Legit recurrence |

## Task Duplicate Detection

### Task Exact Duplicates (via duplicate_hash)
**Before cleanup:** 18 groups, 40 records
**After cleanup:** 0 groups, 22 archived

All duplicate tasks were archived via `p0_task_cleanup.php` (kept lowest ID per group).

## Conclusion
- **Bill duplicates to archive: 0** (all legit recurring)
- **Task duplicates archived: 22** (18 groups, kept 18 canonical records)
- **Total archived: 22 records**
