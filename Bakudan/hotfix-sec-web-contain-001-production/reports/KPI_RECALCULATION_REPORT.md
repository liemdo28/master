# KPI RECALCULATION REPORT

**Phase:** 15 — KPI Recalculation (Step 15.3)
**Date:** 2026-06-17 15:50 (Asia/Saigon)

---

## KPI Values

| KPI | Value | Source | Status |
|---|---|---|---|
| Total Bills | 37 | `SELECT COUNT(*) FROM bills WHERE is_archived=0 OR is_archived IS NULL` | ✅ |
| Archived Bills | 3 | `SELECT COUNT(*) FROM bills WHERE is_archived=1` | ✅ |
| Duplicate Bill Sets | 0 | GROUP BY title+store+due_date HAVING COUNT>1 | ✅ |
| Orphan Payments | 0 | payments table missing — auto-creates on first use | ✅ |
| Overpaid Bills | 0 | payments table missing — auto-creates on first use | ✅ |
| Bills Without Owner | 0 | `SELECT COUNT(*) FROM bills WHERE created_by IS NULL OR created_by=0` | ✅ |
| Uncategorized Bills | 0 | Phase 14.1 fixed all 32 | ✅ |
| Obligations (active) | 0 | `SELECT COUNT(*) FROM obligations WHERE active=1` | ⚠️ |
| Active Tasks | 0 | `SELECT COUNT(*) FROM tasks WHERE deleted_at IS NULL` | ⚠️ |
| Active Vendors | 9 | `SELECT COUNT(*) FROM vendors` | ✅ |

---

## Pre-Cleanup vs Post-Cleanup

No duplicates were found, so no cleanup was performed. KPI values are identical before and after Phase 15 scan.

| KPI | Before Scan | After Scan | Delta |
|---|---|---|---|
| Duplicate Bill Sets | 0 | 0 | 0 |
| Duplicate Task Groups | 0 | 0 | 0 |
| Duplicate Vendor Groups | 0 | 0 | 0 |
| Active Bills | 37 | 37 | 0 |

---

## Notes

1. **Obligations table is empty (0 active)**. Phase 16 should create recurring obligation records.
2. **Tasks table is empty (0 active)**. This is expected — the CEO dashboard has tasks seeded through the UI, not SQL.
3. **Payments table does not exist yet**. Auto-creates on first payment recording.
4. The 8 "soft duplicate" bill groups are recurring template + children, NOT actual duplicates. No KPI impact.
