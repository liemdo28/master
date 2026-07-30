# DUPLICATE DEEP AUDIT REPORT

**Date:** 2026-06-22 12:29 PM → Updated 1:23 PM (Asia/Saigon)
**Method:** `/p0.php?action=p0_repro` + `/db_query.php?query_id=duplicates` (fuzzy + hash matching)
**Status:** ✅ AUDIT COMPLETE — ALL CLEANED

## Match Methods Used

### Bills: Normalized Fuzzy Match
- LOWER(TRIM(title)) + store_id + due_date = Exact groups → **0 found**
- LOWER(TRIM(title)) + store_id + amount = Soft groups → **8 found** (all legit recurring)

### Tasks: Duplicate Hash Match
- `duplicate_hash` groups (pre-computed by application) → **18 groups, 40 records before cleanup**
- After cleanup: **0 active duplicate groups, 22 archived**

---

## Bill Duplicate Groups — All Legitimate Recurring

### Group 1: Raw PGE | Raw Stockton | monthly
IDs: 19, 27, 194, 285 → Due dates: 04/20, 05/20, 06/20, 07/20 ✅

### Group 2: Raw QB Tax | Raw Stockton | monthly
IDs: 18, 26, 193, 284 → Due dates: 04/20, 05/20, 06/20, 07/20 ✅

### Group 3: Raw Sale Tax | Raw Stockton | monthly
IDs: 16, 25, 191, 282 → Due dates: 04/20, 05/20, 06/20, 07/20 ✅

### Group 4: Raw General | Raw Stockton | monthly
IDs: 15, 190, 281 → Due dates: 05/01, 06/01, 07/01 ✅

### Group 5: Stockton - Prepayment | Raw Stockton | monthly
IDs: 17, 192, 283 → Due dates: 05/01, 06/01, 07/01 ✅

### Group 6: IFT Sale Tax | IFT | monthly
IDs: 20, 23, 188 → Due dates: 04/20, 05/20, 06/20 ✅

### Group 7: Amtrust | Modesto | monthly
IDs: 14, 24, 189 → Due dates: 04/23, 05/23, 06/23 ✅

### Group 8: Heo Holding Sale Tax | Heo Holding | monthly
IDs: 21, 22, 187 → Due dates: 04/20, 05/20, 06/20 ✅

---

## Task Duplicate Groups — All Archived

18 groups identified via `duplicate_hash` matching. Lowest ID kept as canonical per P0 rules. 22 duplicate tasks archived via `p0_task_cleanup.php`:

| # | Title | Group Size | Kept | Archived IDs |
|---|-------|-----------|------|-------------|
| 1 | Confirm all three Bakudan locations have the new menu | 5 | 18788 | 20198,20201,20202,20205 |
| 2 | Follow up on Discover Merchant Class Action Settlement | 3 | 20017 | 20186,20187 |
| 3 | Check on third-party delivery issues (DoorDash, Uber Eats) | 2 | 18786 | 20199 |
| 4 | Pay HEO CC 2025 | 2 | 20169 | 20185 |
| 5 | Complete steps for mega backdoor Roth contribution | 2 | 18186 | 20189 |
| 6 | Follow up on Uber missing payout | 2 | 18193 | 20197 |
| 7 | Evaluate hard money deal potential | 2 | 20027 | 20193 |
| 8 | Verify transactional funding for Myra | 2 | 20066 | 20195 |
| 9 | Reach out to Amex re Marriott Bonvoy Brilliant | 2 | 20083 | 20206 |
| 10 | Assign manager to lead Toast upsell integration | 2 | 18791 | 20204 |
| 11 | Draft promissory note and deed of trust (Louise St) | 2 | 20054 | 20194 |
| 12 | Assign manager to lead Toast upsell training | 2 | 18787 | 20200 |
| 13 | Follow up with Clint (Utah) on Chubby Group supply | 2 | 20048 | 20192 |
| 14 | Follow up on Uber missing payout response | 2 | 18784 | 20196 |
| 15 | Check on DoorDash and Uber Eats third-party delivery | 2 | 18790 | 20203 |
| 16 | Research and execute mega backdoor Roth steps | 2 | 18881 | 20191 |
| 17 | Send K1s for all Bakudan entities | 2 | 18187 | 20190 |
| 18 | Assign manager to lead Toast training for serving staff | 2 | 18797 | 20188 |

---

## Summary

| Metric | Bills | Tasks |
|--------|-------|-------|
| Total records scanned | 37 | 1,662 |
| Duplicate groups found | 8 (soft) | 18 (hash) |
| Real duplicates archived | 0 | 22 |
| Legitimate records preserved | 37 | 1,640 (1,662 - 22) |

## Conclusion

**NO real bill duplicates exist.** All 8 bill groups are legitimate recurring obligations.
**22 task duplicates archived.** All 18 task groups cleaned via `archived_duplicate=1`.
