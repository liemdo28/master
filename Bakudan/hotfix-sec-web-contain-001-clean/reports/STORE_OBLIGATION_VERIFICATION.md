# STORE OBLIGATION VERIFICATION
**Date:** 2026-06-16
**Status:** BLOCKED — requires production DB query

---

## Required Obligations Per Store

| Obligation | Bakudan Rim | Stone Oak | Bandera | Raw Stockton |
|-----------|------------|-----------|---------|-------------|
| Rent | ? | ? | ? | ? |
| Utility | ? | ? | ? | ? |
| Tax | ? | ? | ? | ? |
| Payroll Tax | ? | ? | ? | ? |
| Quarterly Filing | ? | ? | ? | ? |
| Annual Filing | ? | ? | ? | ? |
| Credit Card | ? | ? | ? | ? |
| Insurance | ? | ? | ? | ? |
| TABC (TX only) | ? | ? | N/A | N/A |

**Cannot verify without production DB access.**

## Verification SQL (run via SSH or GH Actions)

```sql
SELECT 
  s.name AS store,
  b.title,
  b.category,
  b.repeat_type,
  b.status
FROM bills b
JOIN stores s ON s.id = b.store_id
WHERE b.is_template = 1
  AND COALESCE(b.is_archived, 0) = 0
ORDER BY s.name, b.category;
```

## Infrastructure Verified

| Item | Status |
|------|--------|
| bills.store_id column | PASS — all bills scoped per store |
| bills.repeat_type column | PASS — ENUM monthly/quarterly/annual/weekly |
| BillModel::ensureRecurringForMonth() | PASS — generates per-store monthly bills |
| BillController::createTemplate() | PASS — requires store_id |
| Bill categories include all required types | FIXED ✅ (2026-06-16 — added credit_card, waste, licensing, compliance, vendor, software) |

## Action Required

CEO/Operations to verify via `/bills?store_id=X` for each store and confirm:
- 1 store = 1 recurring obligation per type
- No company-level generic bills duplicating store-specific ones

## Status: BLOCKED (production data verification required)
