<?php
/**
 * Database Integrity Validation Script
 *
 * Run: php qa/tests/test_db_integrity.php
 *
 * Safe to run in production — all queries are read-only (SELECT only).
 * Checks for orphan records, recurrence integrity, and data quality issues.
 */

// ─── Bootstrap ───────────────────────────────────────────────────────────────
require_once __DIR__ . '/../../config/database.php';

$db = Database::getInstance();

// ─── Counters ────────────────────────────────────────────────────────────────
$passed   = 0;
$warnings = 0;
$critical = 0;

/**
 * Run an integrity check and print results.
 *
 * @param string $label   Human-readable check description
 * @param string $sql     SELECT query returning offending rows
 * @param array  $params  Bind parameters
 * @param callable $formatter  Formats each row into a detail string
 * @param string $severity  'warning' or 'critical'
 */
function check(string $label, string $sql, array $params, callable $formatter, string $severity = 'warning'): void
{
    global $db, $passed, $warnings, $critical;

    $rows = $db->fetchAll($sql, $params);
    $count = count($rows);

    if ($count === 0) {
        echo "[CHECK] {$label}... 0 found ✓\n";
        $passed++;
    } else {
        $icon = $severity === 'critical' ? '✗' : '⚠';
        echo "[CHECK] {$label}... {$count} found {$icon}\n";
        foreach ($rows as $row) {
            echo "  - " . $formatter($row) . "\n";
        }
        if ($severity === 'critical') {
            $critical++;
        } else {
            $warnings++;
        }
    }
}

// ─── Helper: Check if table exists before running query ──────────────────────
function tableExists(string $table): bool
{
    global $db;
    return $db->tableExists($table);
}

// ═══════════════════════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════════════\n";
echo "  Database Integrity Validation — " . date('Y-m-d H:i:s') . "\n";
echo "  Database: " . DB_NAME . " @ " . DB_HOST . "\n";
echo "═══════════════════════════════════════════════════════════════════\n\n";

// ─── ORPHAN DETECTION ────────────────────────────────────────────────────────
echo "─── Orphan Detection ─────────────────────────────────────────────\n";

// Tasks with project_id pointing to non-existent projects
check(
    'Orphan tasks (invalid project_id)',
    "SELECT t.id, t.project_id
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id
     WHERE t.project_id IS NOT NULL AND p.id IS NULL",
    [],
    fn($r) => "Task #{$r['id']}: project_id={$r['project_id']} (project deleted)"
);

// Tasks with assignee_id pointing to non-existent users
check(
    'Orphan tasks (invalid assignee_id)',
    "SELECT t.id, t.assignee_id
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.assignee_id IS NOT NULL AND u.id IS NULL",
    [],
    fn($r) => "Task #{$r['id']}: assignee_id={$r['assignee_id']} (user deleted)"
);

// Tasks with parent_task_id pointing to non-existent tasks
check(
    'Orphan tasks (invalid parent_task_id)',
    "SELECT t.id, t.parent_task_id
     FROM tasks t
     LEFT JOIN tasks p ON t.parent_task_id = p.id
     WHERE t.parent_task_id IS NOT NULL AND p.id IS NULL",
    [],
    fn($r) => "Task #{$r['id']}: parent_task_id={$r['parent_task_id']} (parent task deleted)"
);

// task_watchers with task_id pointing to non-existent tasks
if (tableExists('task_watchers')) {
    check(
        'Orphan task_watchers (invalid task_id)',
        "SELECT tw.task_id, tw.user_id
         FROM task_watchers tw
         LEFT JOIN tasks t ON tw.task_id = t.id
         WHERE t.id IS NULL",
        [],
        fn($r) => "task_watchers: task_id={$r['task_id']}, user_id={$r['user_id']} (task deleted)"
    );

    // task_watchers with user_id pointing to non-existent users
    check(
        'Orphan task_watchers (invalid user_id)',
        "SELECT tw.task_id, tw.user_id
         FROM task_watchers tw
         LEFT JOIN users u ON tw.user_id = u.id
         WHERE u.id IS NULL",
        [],
        fn($r) => "task_watchers: task_id={$r['task_id']}, user_id={$r['user_id']} (user deleted)"
    );
} else {
    echo "[SKIP] task_watchers table does not exist\n";
}

// Comments with task_id pointing to non-existent tasks
if (tableExists('comments')) {
    check(
        'Orphan comments (invalid task_id)',
        "SELECT c.id, c.task_id
         FROM comments c
         LEFT JOIN tasks t ON c.task_id = t.id
         WHERE t.id IS NULL",
        [],
        fn($r) => "Comment #{$r['id']}: task_id={$r['task_id']} (task deleted)"
    );
} else {
    echo "[SKIP] comments table does not exist\n";
}

// Attachments with task_id pointing to non-existent tasks
if (tableExists('attachments')) {
    check(
        'Orphan attachments (invalid task_id)',
        "SELECT a.id, a.task_id
         FROM attachments a
         LEFT JOIN tasks t ON a.task_id = t.id
         WHERE t.id IS NULL",
        [],
        fn($r) => "Attachment #{$r['id']}: task_id={$r['task_id']} (task deleted)"
    );
} else {
    echo "[SKIP] attachments table does not exist\n";
}

echo "\n";

// ─── RECURRENCE INTEGRITY ────────────────────────────────────────────────────
echo "─── Recurrence Integrity ─────────────────────────────────────────\n";

// Tasks with recurring_root_id pointing to non-existent tasks
check(
    'Orphan recurring_root_id (root task deleted)',
    "SELECT t.id, t.recurring_root_id
     FROM tasks t
     LEFT JOIN tasks root ON t.recurring_root_id = root.id
     WHERE t.recurring_root_id IS NOT NULL AND root.id IS NULL",
    [],
    fn($r) => "Task #{$r['id']}: recurring_root_id={$r['recurring_root_id']} (root task deleted)",
    'critical'
);

// Tasks where recurring_root_id = own id but repeat_type = 'none' (inconsistent)
check(
    'Inconsistent recurrence (root=self but repeat_type=none)',
    "SELECT id, recurring_root_id, repeat_type
     FROM tasks
     WHERE recurring_root_id = id AND repeat_type = 'none'",
    [],
    fn($r) => "Task #{$r['id']}: recurring_root_id=self but repeat_type='{$r['repeat_type']}' (inconsistent)"
);

// Duplicate occurrences: same recurring_root_id + same due_date
check(
    'Duplicate recurrence occurrences (same root + same due_date)',
    "SELECT recurring_root_id, due_date, COUNT(*) as cnt, GROUP_CONCAT(id ORDER BY id) as task_ids
     FROM tasks
     WHERE recurring_root_id IS NOT NULL AND due_date IS NOT NULL
     GROUP BY recurring_root_id, due_date
     HAVING COUNT(*) > 1",
    [],
    fn($r) => "recurring_root_id={$r['recurring_root_id']}, due_date={$r['due_date']}: {$r['cnt']} duplicates (IDs: {$r['task_ids']})",
    'critical'
);

// Circular parent_task_id references (task A → B → A)
// Detect direct cycles (depth 1-5) using self-joins
check(
    'Circular parent_task_id references',
    "SELECT DISTINCT t1.id as task_a, t1.parent_task_id as points_to
     FROM tasks t1
     JOIN tasks t2 ON t1.parent_task_id = t2.id AND t2.parent_task_id = t1.id
     WHERE t1.parent_task_id IS NOT NULL
       AND t1.id < t2.id",
    [],
    fn($r) => "Circular: Task #{$r['task_a']} ↔ Task #{$r['points_to']} (direct cycle)",
    'critical'
);

// Also check self-referencing parent_task_id
check(
    'Self-referencing parent_task_id',
    "SELECT id, parent_task_id
     FROM tasks
     WHERE parent_task_id = id",
    [],
    fn($r) => "Task #{$r['id']}: parent_task_id points to itself",
    'critical'
);

echo "\n";

// ─── DATA QUALITY ────────────────────────────────────────────────────────────
echo "─── Data Quality ─────────────────────────────────────────────────\n";

// Tasks with empty title
check(
    'Tasks with empty title',
    "SELECT id, title
     FROM tasks
     WHERE title IS NULL OR TRIM(title) = ''",
    [],
    fn($r) => "Task #{$r['id']}: title is empty",
    'critical'
);

// Tasks with due_date in invalid format (not YYYY-MM-DD)
// MySQL stores DATE as YYYY-MM-DD; invalid values become '0000-00-00' or NULL
// Check for '0000-00-00' or values that don't match the expected pattern
check(
    'Tasks with invalid due_date format',
    "SELECT id, due_date
     FROM tasks
     WHERE due_date IS NOT NULL
       AND (due_date = '0000-00-00'
            OR due_date NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            OR CAST(due_date AS DATE) IS NULL)",
    [],
    fn($r) => "Task #{$r['id']}: due_date='{$r['due_date']}' (invalid format)"
);

// Tasks with is_completed=1 but status != 'done'
check(
    'Tasks with is_completed=1 but status != done',
    "SELECT id, status, is_completed
     FROM tasks
     WHERE is_completed = 1 AND status != 'done'",
    [],
    fn($r) => "Task #{$r['id']}: is_completed=1 but status='{$r['status']}'"
);

echo "\n";

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
$total = $passed + $warnings + $critical;
echo "═══════════════════════════════════════════════════════════════════\n";
echo "  Summary: {$passed} checks passed, {$warnings} warnings, {$critical} critical\n";
echo "═══════════════════════════════════════════════════════════════════\n";

// Exit with non-zero code if critical issues found
if ($critical > 0) {
    exit(2);
} elseif ($warnings > 0) {
    exit(1);
}
exit(0);
