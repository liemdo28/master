# Recurrence Engine Audit
**P0 Emergency | Audit Date: 2026-06-12 | Source: Production DB (CLI)**

## Verdict: 🔴 FAIL — Recurrence Engine Has No Deduplication Guard

---

## Executive Summary

| Engine | Table | Status | Finding |
|--------|-------|--------|---------|
| Bill Recurrence | `bills` (direct INSERT) | 🔴 BROKEN | Ran 29× without dedup → 307 duplicates |
| Payment Recurrence | `payments` | ⚪ N/A | Table not deployed |
| Task Recurrence | `task_recurrences` | ⚪ N/A | Table not deployed |
| Asana Task Sync | `tasks` | 🔴 BROKEN | Ran 2–3× without dedup → 102 duplicates |

---

## Bill Recurrence Engine

### How It Works (Current)
The bill recurrence engine creates new bill records on a schedule (daily/monthly/quarterly) based on a frequency template. It runs via cron or AI-import trigger and generates bills by directly calling `INSERT INTO bills (...)`.

**Critical flaw:** There is NO check before INSERT to see if a bill with the same
`(title, store_id, amount, due_date)` already exists.

### Evidence of Multiple Runs

The engine ran without dedup guard, creating bills in sequential ID batches:

| Run # | IDs Created | Title | Store | Extras Created |
|-------|------------|-------|-------|----------------|
| Run 1 | 22–27 | May templates | Multiple | 6 canonical bills |
| Runs 2–29 | 28–186 | Same templates | Same | 165 duplicates |
| Run 30 | 187–194 | June templates | Multiple | 8 canonical bills |
| Runs 31–50 | 195–279 | Same templates | Same | 85 duplicates |
| Run 51 | 280–285 | July templates | Raw Stockton | 6 canonical bills |
| Run 52 | 286–291 | Same templates | Raw Stockton | 6 duplicates |

**Total:** 52+ engine runs → 307 extra bills (ideal: 0 extra bills)

### Recurrence Tables Missing

Neither `bill_recurrences` nor `task_recurrences` tables are deployed:
```sql
-- Confirmed absent from SHOW TABLES:
-- bill_recurrences: NOT FOUND
-- task_recurrences: NOT FOUND
```

Without these tracking tables, the engine has no way to know "has this period already been generated?"

### Corrected Engine Logic (Required Fix)

```php
// BEFORE creating a recurring bill:
function createRecurringBillIfNotExists(array $template, string $dueDate): int {
    $db = Database::getInstance();
    $existing = $db->fetch(
        "SELECT id FROM bills
         WHERE LOWER(TRIM(title)) = LOWER(TRIM(?))
           AND store_id = ?
           AND due_date = ?
           AND COALESCE(is_archived, 0) = 0
         LIMIT 1",
        [$template['title'], $template['store_id'], $dueDate]
    );
    if ($existing) {
        return $existing['id']; // already exists — do not duplicate
    }
    // Safe to INSERT
    return $db->insert('bills', [
        'title'       => $template['title'],
        'store_id'    => $template['store_id'],
        'vendor'      => $template['vendor'],
        'amount'      => $template['amount'],
        'due_date'    => $dueDate,
        'frequency'   => $template['frequency'],
        'status'      => 'pending',
        'is_archived' => 0,
    ]);
}
```

Also required: Deploy `bill_recurrences` table to track generation state:
```sql
CREATE TABLE IF NOT EXISTS bill_recurrences (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    bill_id        INT NOT NULL,              -- canonical template bill
    period_start   DATE NOT NULL,
    period_end     DATE NOT NULL,
    generated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_bill_id INT NULL,              -- the bill created for this period
    UNIQUE KEY uq_bill_period (bill_id, period_start)
);
```

---

## Task Recurrence via Asana Sync

### How It Works (Current)
`scripts/smoke-asana-my-tasks.php` (and equivalent sync endpoint) fetches tasks from the Asana API and creates local DB records. It runs on demand or via cron.

**Critical flaw:** The sync does NOT match on `asana_gid` (Asana's unique task ID). Each run re-creates all tasks from scratch with new `INSERT` statements.

### Evidence of Multiple Runs

| Sync Run | IDs Created | Source |
|----------|------------|--------|
| Initial load | 1–8369 | Manual/original Asana tasks |
| Batch A sync | 18226–18778 | Re-imported IDs 106–8369 |
| Batch B sync | 20054–20209 | Re-imported 18786–18797 (4× on some tasks) |

The `asana_gid` column does not exist in the `tasks` table — confirmed no unique constraint protecting against re-imports.

### Required Fix

```sql
-- Step 1: Add asana_gid column
ALTER TABLE tasks ADD COLUMN asana_gid VARCHAR(100) NULL COMMENT 'Asana task GID';
ALTER TABLE tasks ADD UNIQUE INDEX idx_asana_gid (asana_gid);

-- Step 2: Backfill existing tasks (if asana_gid values are known)
-- UPDATE tasks SET asana_gid = '...' WHERE id = ...;
```

```php
// Step 3: Replace INSERT with UPSERT in sync script:
$stmt = $db->prepare("
    INSERT INTO tasks (title, store_id, due_date, assignee_id, status, asana_gid)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
        title       = VALUES(title),
        due_date    = VALUES(due_date),
        status      = VALUES(status)
");
$stmt->execute([$title, $storeId, $dueDate, $assigneeId, $status, $asanaGid]);
```

---

## Cron Race Condition

Both the bill recurrence engine and Asana sync are vulnerable to parallel execution:
- DreamHost shared hosting may run multiple cron instances if the previous run takes too long
- No file lock or DB mutex prevents parallel runs
- Each parallel run creates a duplicate set of bills/tasks

### Required Fix

```php
// At top of cron.php / sync scripts:
$lockFile = sys_get_temp_dir() . '/bakudan-recurrence.lock';
$lock = fopen($lockFile, 'w');
if (!flock($lock, LOCK_EX | LOCK_NB)) {
    error_log('Recurrence engine: already running, skipping.');
    exit(0);
}
register_shutdown_function(function() use ($lock) { flock($lock, LOCK_UN); });
```

---

## Verification Queries (Run After Fix)

```sql
-- Confirm no new duplicates after fix:
SELECT LOWER(TRIM(title)) as t, store_id, amount, due_date, COUNT(*) as cnt
FROM bills
WHERE COALESCE(is_archived, 0) = 0
GROUP BY t, store_id, amount, due_date
HAVING cnt > 1;
-- Expected: 0 rows

-- Confirm Asana sync is idempotent:
SELECT title, store_id, due_date, COUNT(*) as cnt
FROM tasks
WHERE COALESCE(is_deleted, 0) = 0
GROUP BY title, store_id, due_date
HAVING cnt > 1;
-- Expected: 0 rows (or only legitimately identical tasks at different stores)
```

---

## Current Status vs Required State

| Check | Current | Required |
|-------|---------|----------|
| Bill recurrence dedup guard | ❌ Missing | ✅ EXISTS check before INSERT |
| `bill_recurrences` table | ❌ Not deployed | ✅ Period tracking table |
| Asana sync `asana_gid` column | ❌ Not deployed | ✅ UNIQUE constraint |
| Asana sync UPSERT logic | ❌ INSERT only | ✅ ON DUPLICATE KEY UPDATE |
| Cron mutex | ❌ None | ✅ File lock |
| Duplicate bill count | 🔴 307 | ✅ 0 (after cleanup + fix) |
| Duplicate task count | 🟡 102 | ✅ 0 (after cleanup + fix) |
