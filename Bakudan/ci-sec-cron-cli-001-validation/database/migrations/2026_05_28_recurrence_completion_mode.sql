<?php
/**
 * 2026_05_28_recurrence_completion_mode.sql
 *
 * Adds repeat_from_mode column to support completion-based recurrence (Asana/Todoist behavior).
 *
 * repeat_from_mode:
 *   - 'due_date'       = next occurrence based on original due date (default, preserves schedule)
 *   - 'completion_date'= next occurrence based on when user completed the task (reacts to reality)
 *
 * Also adds:
 *   - repeat_end_type   : 'never' | 'date' | 'count'  (end rule type)
 *   - repeat_end_date  : YYYY-MM-DD end date
 *   - repeat_end_count : max occurrence count
 *
 * Run: php migrate.php
 */

$pdo = Database::getInstance()->getConnection();

// Check if already applied
$cols = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'repeat_from_mode'")->fetchAll();
if (!empty($cols)) {
    echo "[SKIP] repeat_from_mode column already exists\n";
    return;
}

echo "Applying 2026_05_28_recurrence_completion_mode...\n";

// repeat_from_mode
$pdo->exec("ALTER TABLE tasks ADD COLUMN repeat_from_mode ENUM('due_date','completion_date') NOT NULL DEFAULT 'due_date' AFTER repeat_config");
echo "  + repeat_from_mode ENUM('due_date','completion_date') DEFAULT 'due_date'\n";

// repeat_end_type
$cols2 = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'repeat_end_type'")->fetchAll();
if (empty($cols2)) {
    $pdo->exec("ALTER TABLE tasks ADD COLUMN repeat_end_type ENUM('never','date','count') NOT NULL DEFAULT 'never' AFTER repeat_from_mode");
    echo "  + repeat_end_type ENUM('never','date','count') DEFAULT 'never'\n";
}

// repeat_end_date
$cols3 = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'repeat_end_date'")->fetchAll();
if (empty($cols3)) {
    $pdo->exec("ALTER TABLE tasks ADD COLUMN repeat_end_date DATE NULL DEFAULT NULL AFTER repeat_end_type");
    echo "  + repeat_end_date DATE NULL DEFAULT NULL\n";
}

// repeat_end_count
$cols4 = $pdo->query("SHOW COLUMNS FROM tasks LIKE 'repeat_end_count'")->fetchAll();
if (empty($cols4)) {
    $pdo->exec("ALTER TABLE tasks ADD COLUMN repeat_end_count INT UNSIGNED NULL DEFAULT NULL AFTER repeat_end_date");
    echo "  + repeat_end_count INT UNSIGNED NULL DEFAULT NULL\n";
}

// Index for efficient recurring task queries
try {
    $pdo->exec("CREATE INDEX idx_tasks_repeat_active ON tasks(repeat_type, is_completed, repeat_end_type) WHERE repeat_type <> 'none'");
    echo "  + idx_tasks_repeat_active index\n";
} catch (Exception $e) {
    echo "  ~ idx_tasks_repeat_active (may exist): " . $e->getMessage() . "\n";
}

echo "Done.\n";
