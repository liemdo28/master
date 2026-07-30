<?php
/**
 * Run migration: Add approver_id column to tasks table
 * Target: preview_database on mysql-taskflow.bakudanramen.com
 * 
 * Usage: php migrate-approver-id.php
 */

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/i18n.php';
require_once __DIR__ . '/config/time.php';

echo "=== Migration: Add approver_id to tasks ===\n\n";

$db = Database::getInstance();

// 1. Check if column exists
$colExists = $db->fetch(
    "SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'tasks'
       AND column_name = 'approver_id"
)['c'] ?? 0;

if ($colExists > 0) {
    echo "✓ Column 'approver_id' already exists in tasks table.\n";
} else {
    echo "✗ Column 'approver_id' NOT found — adding now...\n";
    try {
        $db->query(
            "ALTER TABLE tasks ADD COLUMN approver_id INT UNSIGNED NULL DEFAULT NULL AFTER reviewer_id"
        );
        echo "✓ Column 'approver_id' added successfully.\n";
    } catch (Exception $e) {
        echo "✗ Failed to add column: " . $e->getMessage() . "\n";
    }
}

// 2. Check if index exists
try {
    $db->query("CREATE INDEX idx_tasks_approver ON tasks(approver_id)");
    echo "✓ Index idx_tasks_approver created.\n";
} catch (Exception $e) {
    // Index already exists or other error — check if it's just the duplicate
    $msg = $e->getMessage();
    if (stripos($msg, 'Duplicate') !== false || stripos($msg, 'already exists') !== false) {
        echo "✓ Index idx_tasks_approver already exists.\n";
    } else {
        echo "⚠ Index creation note: $msg\n";
    }
}

// 3. Verify the fix
echo "\n--- Verification ---\n";
try {
    $task = $db->fetch("SELECT id, title, approver_id FROM tasks WHERE id = 19734");
    if ($task) {
        echo "✓ Task 19734 found: " . ($task['title'] ?? 'N/A') . "\n";
        echo "  approver_id: " . ($task['approver_id'] ?? 'NULL') . "\n";
    } else {
        echo "⚠ Task 19734 not found — will appear after next task creation.\n";
    }
} catch (Exception $e) {
    echo "✗ Verification failed: " . $e->getMessage() . "\n";
}

echo "\n=== Done ===\n";