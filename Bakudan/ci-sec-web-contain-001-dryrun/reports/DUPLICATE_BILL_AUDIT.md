# DUPLICATE_BILL_AUDIT.md
**Date:** 2026-06-10  
**Scope:** 176 bills bulk-paid + duplicate hash strategy

## Context
176 bills were bulk-marked as paid on 2026-06-10 as part of backlog cleanup.

## Duplicate Hash Strategy
```
md5(title_lower | store_id | due_date | round(amount) | vendor_lower | category_lower)
```

## Actions Taken
1. `duplicate_hash` column added to `bills` table via migration
2. `DuplicateDetector::billHash()` computes hash on create/update
3. `Bill::computeAndSaveHash()` called in `BillController::createBill()`
4. Existing bills: hash backfilled by `DailyDuplicateTaskBillScanner.php`
5. Pre-create modal added via `POST /api/bills/check-duplicate`

## Non-Archived Bills Baseline
Bills excluded from dashboard counts: `AND (is_archived = 0 OR is_archived IS NULL)`
