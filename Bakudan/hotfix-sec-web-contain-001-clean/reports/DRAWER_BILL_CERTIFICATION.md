# DRAWER BILL CERTIFICATION

**Date:** 2026-06-15  
**Status:** PASS  
**Reviewed by:** Cline (automated audit)

---

## Data Loading Path

**Route:** `GET /bills/{id}` → `BillController::show($id)`

**Primary SQL:**
```sql
SELECT b.*, s.name AS store_name, s.color AS store_color,
       COALESCE(v.name, b.vendor) AS vendor_name
FROM bills b
JOIN stores s ON s.id = b.store_id
LEFT JOIN vendors v ON b.vendor_id = v.id
WHERE b.id = ?
```

**Database Tables Queried:**
| Table | Join Type | Purpose |
|---|---|---|
| `bills` | Primary | Bill record |
| `stores` | INNER JOIN | Store name, color |
| `vendors` | LEFT JOIN | Vendor name |
| `bill_items` | Separate query (if applicable) | Line items |

## Data Fields Verified

| Field | Source | Status |
|---|---|---|
| title | `bills.title` | PASS |
| category | `bills.category` | PASS |
| vendor | `vendors.name` via `bills.vendor_id` | PASS |
| amount | `bills.amount` | PASS |
| due_date | `bills.due_date` | PASS |
| status | `bills.status` | PASS |
| recurrence | `bills.repeat_type` | PASS |
| store | `stores.name` via `bills.store_id` | PASS |
| color | `stores.color` | PASS |
| store_name | `stores.name` (joined) | PASS |
| vendor_name | `COALESCE(vendors.name, bills.vendor)` | PASS |

## Critical Analysis

- **INNER JOIN on stores** means a bill with a deleted store would cause a SQL error (no rows returned). However, store deletion is blocked by foreign key constraints — this is safe.
- **LEFT JOIN on vendors** correctly handles bills where `vendor_id` is NULL (legacy `vendor` text column).
- **No missing columns.** All columns referenced in `bills/show.php` exist per migration `2026_06_10_bill_registry_upgrade.sql`.

## Drawer Integration

- Bill links intercepted by `detail-drawer.js` via `supportedDetailRe` pattern `/^\/bills\/\d+\/?$/`
- `openBillModal()` in `bills/index.php` delegates to `window.DetailDrawer.open()` when available
- CSS adapts bill content for 720px drawer width

## Issues Found

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | LOW | INNER JOIN on stores could theoretically fail | ACCEPTED — FK constraint prevents orphaned bills |
| 2 | LOW | Bill edit form in drawer submits to server | ACCEPTED — standard form behavior |

## Verdict

**PASS** — Bill drawer loads all data correctly. No SQL errors, no missing relations.
