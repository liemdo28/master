# Dashboard Recalculation Report
**P0 Emergency | Audit Date: 2026-06-12 | Source: Production DB (CLI)**

> Dashboard numbers are INVALID until duplicate cleanup (Phase A + Phase B) is complete.
> This report shows: current counts (broken), how they are computed, and what they will be after cleanup.

---

## KPI Comparison: Before vs After Cleanup

| KPI | Dashboard Shows | Actual DB (raw) | After Cleanup | Change |
|-----|-----------------|-----------------|---------------|--------|
| Active Bills | 347 | 347 | **40** | -307 (-88%) |
| Overdue Bills | 0 | 0 (status=overdue) / **28** (by due_date) | **28** | Fixed |
| Critical Bills | ~0 | 0 ($0 amounts) | ~0 (amounts TBD) | TBD |
| Cash Risk ($) | ~$200 | ~$200 total | **$0** (all templates $0) | Amounts TBD |
| Active Tasks | 1,670 | 1,670 | **1,568** | -102 (-6%) |
| Payments Risk | N/A | N/A (no payments table) | N/A | — |

---

## Metric 1 — Active Bills

### Current State (Broken)
```sql
SELECT COUNT(*) FROM bills WHERE COALESCE(is_archived,0)=0;
-- Returns: 347
```
- 307 of 347 are duplicates
- Real canonical bills: 40

### After Cleanup
```sql
SELECT COUNT(*) FROM bills WHERE COALESCE(is_archived,0)=0;
-- Will return: 40
```

**Dashboard widget fix required:**
The "Active Bills" counter on the dashboard reads from this query. Once duplicates are archived, the count will automatically correct to 40.

---

## Metric 2 — Overdue Bills

### Why Dashboard Shows 0 (Wrong)
The overdue query checks `status = 'overdue'`:
```sql
SELECT COUNT(*) FROM bills WHERE status='overdue' AND COALESCE(is_archived,0)=0;
-- Returns: 0
```
But 28 bills have `due_date < TODAY` with `status='pending'`:
```sql
SELECT COUNT(*) FROM bills
WHERE due_date < CURDATE() AND status='pending' AND COALESCE(is_archived,0)=0;
-- Returns: 28
```

### Root Cause
No cron job or trigger updates `status = 'overdue'` when `due_date` passes. Bills remain `pending` forever until manually updated.

### Fix Required
```sql
-- Run once (cleanup):
UPDATE bills
SET status = 'overdue'
WHERE due_date < CURDATE()
  AND status = 'pending'
  AND COALESCE(is_archived, 0) = 0;
-- Will update: 28 rows

-- Prevent recurrence (add to cron.php):
// Daily cron step: auto-mark overdue
$db->execute(
    "UPDATE bills SET status='overdue'
     WHERE due_date < CURDATE() AND status='pending' AND COALESCE(is_archived,0)=0"
);
```

### After Cleanup + Fix
```sql
SELECT COUNT(*) FROM bills WHERE status='overdue' AND COALESCE(is_archived,0)=0;
-- Will return: 28
```

---

## Metric 3 — Critical Bills (High Priority Overdue)

### Current State
All bills currently have `amount = $0.00` (no real amounts set). "Critical Bills" logic typically depends on high-dollar overdue bills.

```sql
SELECT COUNT(*) FROM bills
WHERE status IN ('overdue','pending')
  AND amount > 1000
  AND COALESCE(is_archived,0)=0;
-- Returns: 0 (all $0 templates)
```

### After Cleanup
Still 0 until Finance team assigns real dollar amounts to the 40 canonical bills.

**Action required:** Finance team must set real amounts on all 40 canonical bills.

---

## Metric 4 — Cash Risk ($)

### Current State
```sql
SELECT SUM(amount) FROM bills
WHERE status IN ('overdue','pending')
  AND COALESCE(is_archived,0)=0;
-- Returns: ~$200 (small amounts from early bills, rest $0)
```

The ~$200 is misleading — almost all bills have `amount = 0`.

### After Cleanup
- Post-archive: SUM will reflect only 40 canonical bills
- Still ~$0 until real amounts are entered
- **Real cash risk cannot be computed until amounts are filled in**

---

## Metric 5 — Active Tasks

### Current State
```sql
SELECT COUNT(*) FROM tasks WHERE COALESCE(is_deleted,0)=0;
-- Returns: 1,670
```

### After Cleanup
```sql
SELECT COUNT(*) FROM tasks WHERE COALESCE(is_deleted,0)=0;
-- Will return: 1,568 (after archiving 102 duplicate tasks)
```

---

## Metric 6 — Payment Risk

### Current State
```sql
-- payments table does not exist
-- SHOW TABLES: payments NOT FOUND
```

Cannot compute payment risk. Dashboard should show "N/A" or "Not available."

**Action required:** Deploy payments table migration.

---

## Store Health Score Impact

The Store Health Score (from `reports/STORE_BILL_HEALTH_SCORE.md`) is currently based on 347 bills.
After cleanup, it will recalculate based on 40 real bills.

| Store | Bills Now | After Cleanup | Notes |
|-------|-----------|---------------|-------|
| Raw Stockton | ~175+ | ~20 | Has most duplicates |
| Heo Holding | ~75 | ~5 | June + May batch |
| IFT | ~75 | ~5 | June + May batch |
| Modesto | ~75 | ~5 | Amtrust only |
| Others | ~0 | ~5 | Early bills |

Health scores will appear worse post-cleanup (fewer paid bills relative to total), which is actually more accurate — the duplicates were inflating "active" counts.

---

## Recalculation Steps (Execute in Order)

### Step 1: Archive duplicate bills
```sql
UPDATE bills SET is_archived=1 WHERE id IN (
  -- May batch archives (IDs 28–186, excluding 22–27)
  28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,
  54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,
  80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,
  105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,
  125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,
  145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,
  165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,
  185,186,
  -- June batch archives (IDs 195–279, excluding 187–194)
  195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,
  215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,
  235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,
  255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,
  275,276,277,278,279,
  -- July batch archives
  286,287,288,289,290,291
);
-- Expected: 307 rows updated
```

### Step 2: Fix overdue status
```sql
UPDATE bills
SET status = 'overdue'
WHERE due_date < CURDATE()
  AND status = 'pending'
  AND COALESCE(is_archived, 0) = 0;
-- Expected: 28 rows updated
```

### Step 3: Verify final KPIs
```sql
SELECT
  COUNT(*) as total_active,
  SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue_count,
  SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
  SUM(amount) as total_cash_risk
FROM bills
WHERE COALESCE(is_archived,0)=0;
```

Expected results:
| total_active | overdue_count | pending_count | paid_count | total_cash_risk |
|-------------|---------------|---------------|------------|-----------------|
| 40 | 28 | 12 | 0 | $0.00 (fill in amounts) |

---

## SUCCESS CRITERIA

- [ ] Active bills: 347 → 40
- [ ] Overdue bills: 0 → 28
- [ ] Dashboard overdue count matches DB count
- [ ] Active tasks: 1,670 → 1,568
- [ ] All store health scores recalculated on real data
- [ ] Bill amounts filled in by Finance (for Cash Risk to be meaningful)
- [ ] Recurrence engine dedup guard deployed (prevent regression)
- [ ] Asana sync UPSERT deployed (prevent regression)
