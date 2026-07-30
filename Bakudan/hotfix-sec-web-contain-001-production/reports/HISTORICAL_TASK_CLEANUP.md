# Historical Task Cleanup
**Phase 11.7 — Operational Readiness Sprint**
**Date:** 2026-05-30
**Status:** PENDING — Requires execution against live database

---

## Problem Statement

Dashboard signal is polluted with historical tasks from April 2026 and earlier that remain in `status != completed`. CEO cannot distinguish live work from stale noise.

---

## Audit Query

```sql
-- Historical tasks: incomplete, past cutoff date
SELECT t.id, t.title, t.due_date, t.status, t.priority,
       t.created_at, DATEDIFF(CURDATE(), t.due_date) AS days_overdue,
       p.name AS project_name, p.store_id,
       u.name AS assignee_name
FROM tasks t
LEFT JOIN projects p ON t.project_id = p.id
LEFT JOIN users u ON t.assignee_id = u.id
WHERE t.is_completed = 0
  AND t.status != 'completed'
  AND t.due_date < '2026-05-01'
ORDER BY days_overdue DESC;
```

**Cutoff rationale:** Phase 11 was deployed May 1, 2026. All pre-Phase 11 tasks are candidates for cleanup.

---

## Classification Framework

### Category A — Auto-Complete (Obsolete)

Tasks that are:
- Overdue > 90 days (stale beyond operational relevance)
- Never updated (no comments, no status change > 1 year)
- No active assignee
- Belong to archived/deleted projects

**Auto-action:** Set `is_completed = 1`, `status = 'completed'`, `completed_at = NOW()`
**Log:** Write to `task_cleanup_log` table for audit trail

```sql
-- Category A auto-complete
UPDATE tasks
SET is_completed = 1,
    status = 'completed',
    completed_at = NOW(),
    completion_note = 'Auto-completed by Phase 11.7 historical cleanup'
WHERE id IN (
    SELECT id FROM (
        SELECT t.id
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.is_completed = 0
          AND t.status != 'completed'
          AND t.due_date < '2026-05-01'
          AND DATEDIFF(CURDATE(), t.due_date) > 90
    ) AS sub
);
```

### Category B — Reassign to Corporate (Still Relevant)

Tasks that are:
- Overdue but operationally still meaningful
- Have an active assignee
- Linked to a live project
- Not yet > 180 days overdue

**Auto-action:** Assign to `Corporate` store, set new due date to today + 7 days

```sql
-- Category B: Reassign to corporate with fresh due date
UPDATE tasks t
LEFT JOIN projects p ON t.project_id = p.id
SET t.due_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY),
    t.completion_note = 'Rescheduled by Phase 11.7 historical cleanup — was overdue since original due_date'
WHERE t.is_completed = 0
  AND t.status != 'completed'
  AND t.due_date < '2026-05-01'
  AND DATEDIFF(CURDATE(), t.due_date) BETWEEN 90 AND 180
  AND t.assignee_id IS NOT NULL;
```

### Category C — Manual Review Queue (Export Only)

Tasks that are:
- Overdue between 60–90 days
- Have business context requiring human judgment
- No assignee

**Export to CSV** for manager review before any action.

---

## Cleanup Script

```php
<?php
// cleanup_historical_tasks.php
// Run once via cron or admin action
// Usage: php cleanup_historical_tasks.php

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/time.php';

$db = Database::getInstance();
$cutoff = '2026-05-01';
$corporateStoreId = 3; // Confirm this ID

$results = [
    'category_a' => 0,
    'category_b' => 0,
    'category_c' => [],
];

// Category A: Auto-complete stale tasks
$catA = $db->fetchAll("
    SELECT t.id, t.title
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.is_completed = 0
      AND t.status != 'completed'
      AND t.due_date < ?
      AND DATEDIFF(CURDATE(), t.due_date) > 90
", [$cutoff]);

foreach ($catA as $t) {
    $db->execute("
        UPDATE tasks
        SET is_completed = 1, status = 'completed',
            completed_at = NOW(),
            completion_note = 'Auto-completed by Phase 11.7 historical cleanup ('
              || DATEDIFF(CURDATE(), due_date) || ' days overdue)'
        WHERE id = ?
    ", [$t['id']]);
    $results['category_a']++;
}

// Category B: Reschedule relevant tasks
$catB = $db->fetchAll("
    SELECT id, title, due_date
    FROM tasks
    WHERE is_completed = 0
      AND status != 'completed'
      AND due_date < ?
      AND DATEDIFF(CURDATE(), due_date) BETWEEN 30 AND 90
      AND assignee_id IS NOT NULL
", [$cutoff]);

foreach ($catB as $t) {
    $db->execute("
        UPDATE tasks
        SET due_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY),
            completion_note = CONCAT(completion_note, ' | Rescheduled by Phase 11.7 cleanup')
        WHERE id = ?
    ", [$t['id']]);
    $results['category_b']++;
}

// Category C: Export for manual review
$catC = $db->fetchAll("
    SELECT t.id, t.title, t.due_date, DATEDIFF(CURDATE(), t.due_date) AS days_overdue,
           p.name AS project_name, u.name AS assignee_name
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.is_completed = 0
      AND t.status != 'completed'
      AND t.due_date < ?
      AND DATEDIFF(CURDATE(), t.due_date) BETWEEN 60 AND 90
    ORDER BY days_overdue DESC
", [$cutoff]);

$results['category_c'] = $catC;

// Summary
echo "=== Historical Task Cleanup Results ===\n";
echo "Category A (Auto-completed): {$results['category_a']}\n";
echo "Category B (Rescheduled):    {$results['category_b']}\n";
echo "Category C (Manual review):  " . count($results['category_c']) . "\n";
echo "Run at: " . date('Y-m-d H:i:s') . "\n";
```

---

## Results Summary

| Category | Count | Action |
|----------|-------|--------|
| Category A — Auto-Completed | TBD | `is_completed = 1` |
| Category B — Rescheduled | TBD | Due date refreshed |
| Category C — Manual Review | TBD | Exported to CSV |
| **Total Processed** | **TBD** | |

---

## Post-Cleanup Validation

After running cleanup, verify:

```sql
-- Verify: No incomplete tasks older than cutoff
SELECT COUNT(*) AS stale_count
FROM tasks
WHERE is_completed = 0
  AND status != 'completed'
  AND due_date < '2026-05-01';

-- Expected: 0 or very small number (Category C pending review)
```

---

## Sign-Off

- [ ] Cleanup script reviewed and approved
- [ ] Category A executed
- [ ] Category B executed
- [ ] Category C exported to `reports/HISTORICAL_TASK_REVIEW.csv`
- [ ] Post-cleanup validation query returns clean result
- [ ] Dashboard signal restored — no stale tasks visible
