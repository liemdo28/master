<?php
// Check if approver_id column exists
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();
try {
    $col = $db->fetch("SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='tasks' AND column_name='approver_id'");
    echo "approver_id column count: " . $col['c'] . "\n";
    if ($col['c'] > 0) echo "✓ Column EXISTS\n";
    else echo "✗ Column MISSING\n";
    
    // Also test the findById query directly
    $task = $db->fetch("SELECT id, title FROM tasks ORDER BY id DESC LIMIT 1");
    echo "Last task: " . json_encode($task) . "\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "SQLSTATE: " . ($e instanceof PDOException ? $e->getCode() : 'N/A') . "\n";
}