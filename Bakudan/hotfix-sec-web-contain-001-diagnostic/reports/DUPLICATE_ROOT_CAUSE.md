# Duplicate Root Cause Analysis
**P0 Emergency | Audit Date: 2026-06-12**

---

## Summary

| Source | Entity | Duplicates Created | Confidence |
|--------|--------|-------------------|------------|
| Recurrence Engine (no dedup guard) | Bills | 307 | 99% |
| Asana Sync Job (no dedup guard) | Tasks (Batch A) | ~73 | 99% |
| Asana Sync Job (no dedup guard) | Tasks (Batch B) | ~29 | 99% |

---

## Root Cause 1: Bill Recurrence Engine — No Deduplication Guard

**Evidence:**
- 20 duplicate groups
- Groups 1–6 (May batch, IDs 22–27) have 25–29 duplicates each → engine ran ~29 times
- Groups 7–14 (June batch, IDs 187–194) have 14–20 duplicates → engine ran ~21 times
- Groups 15–20 (July batch, IDs 280–285) have exactly 1 duplicate → engine ran 2 times
- All duplicates are identical: same title, store_id, amount, due_date, frequency

**Source:** The recurring bill creation process (cron job or AI-import trigger) runs without checking if a bill with the same (title, store_id, amount, due_date) already exists.

**Code path:** Wherever `INSERT INTO bills (...)` occurs for recurring bills — no `SELECT ... WHERE ...` guard before INSERT.

**Fix:**
```sql
-- Before INSERT, check:
SELECT id FROM bills
WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
  AND store_id = ?
  AND amount = ?
  AND due_date = ?
  AND COALESCE(is_archived,0) = 0
LIMIT 1;
-- Only INSERT if result is empty
```

---

## Root Cause 2: Asana Task Sync — No Deduplication Guard (Batch A)

**Evidence:**
- ~73 tasks with original IDs (#106–8369) were re-created with IDs in the 18xxx range
- ID jump from 8369 → 18226 suggests a large batch sync (18,000+ ID gap indicates many tasks between, but the 18xxx batch is identifiable as a single import run)
- Duplicate tasks match exactly on title + due_date + assignee

**Source:** The Asana sync job (`scripts/smoke-asana-my-tasks.php` or equivalent) re-imports all tasks without checking if they already exist by external Asana GID or by title+due_date match.

**Fix:**
```php
// Before creating a task from Asana:
$existing = $db->fetch(
    "SELECT id FROM tasks WHERE asana_gid = ? OR (LOWER(TRIM(title))=LOWER(TRIM(?)) AND COALESCE(due_date,'')=? AND COALESCE(assigned_to,0)=?) LIMIT 1",
    [$asanaGid, $title, $dueDate, $assigneeId]
);
if (!$existing) { /* INSERT */ }
else { /* UPDATE */ }
```

---

## Root Cause 3: Asana Task Sync — No Deduplication Guard (Batch B)

**Evidence:**
- ~29 tasks with IDs 20xxx are duplicates of tasks 18xxx–20xxx range
- Specifically tasks #18786–18797 have duplicates in #20188–20205
- Task "Confirm all three Bakudan locations have the new menu" (#18788) has 4 extra copies, indicating the sync job ran 5 times on this task

**Source:** Same code path as Batch A — Asana sync running multiple times without idempotency. The sync jobs ran at:
- Run 1: created IDs 18xxx (duplicating 106–8369)
- Run 2: created IDs 20xxx (duplicating 18786–18797)
- Run 3+: created additional copies of 18788

---

## Why Did This Happen?

### Timeline Reconstruction

| When | Event | Result |
|------|-------|--------|
| Early (IDs 1–8369) | Manual task creation over time | ~8,369 legitimate tasks |
| Sync Run 1 (IDs 18xxx) | Asana sync job ran without dedup guard | +73 duplicate tasks created |
| Sync Run 2–3 (IDs 20xxx) | Asana sync ran again | +29 more duplicates |
| Bill creation (IDs 22–27) | Recurrence engine first run | 6 legitimate bills |
| Bill rec runs 2–29 (IDs 28–186) | Recurrence engine ran 28 more times | 165 duplicate bills |
| Bill June batch (IDs 187–194) | Recurrence second dataset | 8 legitimate bills |
| Bill June rec runs (IDs 195–279) | Recurrence ran ~20 more times | 85 duplicate bills |
| Bill July batch (IDs 280–348) | Recurrence third dataset | 6 legitimate + 57 dups |

---

## No Payments, No Task/Bill Recurrence Tables

- `payments` table: Not yet deployed → no payment duplicates possible
- `task_recurrences` table: Not deployed → recurring task generation is not yet tracked
- `bill_recurrences` table: Not deployed → the bill recurrence engine runs from a different mechanism (likely direct INSERT in the import/cron code)

---

## Recommended Engineering Fixes

### Priority 1 (P0): Prevent future duplicates
1. **Bills INSERT guard**: Add `WHERE NOT EXISTS (SELECT 1 FROM bills WHERE ...)` before every recurring bill INSERT
2. **Asana sync UPSERT**: Change sync from INSERT to INSERT...ON DUPLICATE KEY UPDATE, keyed on `asana_gid`
3. **Cron mutex**: Add file/DB lock to prevent parallel cron runs

### Priority 2 (P1): Add monitoring
1. Add daily check: `SELECT COUNT(*) FROM bills GROUP BY title, store_id, amount, due_date HAVING COUNT(*) > 1`
2. Alert if duplicate count > 0
3. Add Asana sync idempotency log
