# RECURRING ENGINE QA

**Phase:** 16 — Recurrence Engine QA (Step 16.5)
**Date:** 2026-06-17 16:07 (Asia/Saigon)

---

## Test Summary

The recurring bill engine creates child bills from templates with `repeat_parent_id` pointing to the template. Each template has `repeat_type='monthly'` and generates one child per month.

---

## Recurring Engine Behavior Observed

| Template ID | Template Title | Store | Children | Months Generated | Pattern |
|---|---|---|---|---|---|
| 21 | Heo Holding Sale Tax | Heo Holding | 2 | May, Jun | ✅ |
| 20 | IFT Sale Tax | IFT | 2 | May, Jun | ✅ |
| 14 | Amtrust | Modesto | 2 | May, Jun | ✅ |
| 15 | Raw General | Raw Stockton | 2 | Jun, Jul | ✅ |
| 19 | Raw PGE | Raw Stockton | 3 | May, Jun, Jul | ✅ |
| 18 | Raw QB Tax | Raw Stockton | 3 | May, Jun, Jul | ✅ |
| 16 | Raw Sale Tax | Raw Stockton | 3 | May, Jun, Jul | ✅ |
| 17 | Stockton - Prepayment | Raw Stockton | 2 | Jun, Jul | ✅ |

**Total templates:** 8
**Total children generated:** 19
**Next expected occurrence:** 2026-07-20 to 2026-08-01 depending on template

---

## Verification Criteria

| Criteria | Status |
|---|---|
| Next occurrence created once | ✅ Each template generates exactly one child per month |
| Correct due date | ✅ Children have correct month-due dates |
| Correct store | ✅ Children inherit store from template |
| Correct owner | ✅ Children inherit created_by from template |
| No duplicate same-period occurrence | ✅ No two children share the same due_date for the same template |
| Dashboard/calendar visibility | ✅ Children appear in bills list with correct store and status |
| Category inherited | ✅ Children inherit category from template |

---

## Issues Found

None. The recurring engine is functioning correctly for all 8 templates.

---

## Note on Task Recurrence

The tasks table has 0 active records. Task-level recurring functionality (parent task + store subtasks for weekly marketplace audits) cannot be tested until recurring tasks are created through the UI.

The following marketplace recurring tasks should be created per Phase 16.2:

1. DoorDash Campaign Review (Weekly) → Parent + 4 store subtasks
2. DoorDash Error Charge Recovery (Weekly) → Parent + 4 store subtasks
3. Uber Eats Weekly Audit (Weekly) → Parent + 4 store subtasks
4. Yelp Reviews Weekly Management (Weekly) → Parent + 4 store subtasks

These require UI interaction to test the parent→subtask pattern and cannot be seeded via SQL.
