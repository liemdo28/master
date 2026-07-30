<?php
// Minimal script - bypass config dependencies
$host = 'mysql-taskflow.bakudanramen.com';
$db   = 'preview_database';
$user = 'liemdo';
$pass = 'liem@dt2155';

$pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

// Check approver_id column
$col = $pdo->query("SELECT COUNT(*) AS c FROM information_schema.columns 
    WHERE table_schema=DATABASE() AND table_name='tasks' AND column_name='approver_id'")->fetch();
echo "approver_id exists: " . ($col['c'] > 0 ? 'YES' : 'NO') . "\n";

// Test findById query
try {
    $task = $pdo->query("SELECT id, title FROM tasks ORDER BY id DESC LIMIT 1")->fetch();
    echo "Last task: ID=" . $task['id'] . " title=" . $task['title'] . "\n";
    echo "findById query: OK\n";
} catch (PDOException $e) {
    echo "findById query FAILED: " . $e->getMessage() . "\n";
}

// Show all task columns
$cols = $pdo->query("SELECT column_name FROM information_schema.columns 
    WHERE table_schema=DATABASE() AND table_name='tasks' ORDER BY ordinal_position")->fetchAll(PDO::FETCH_COLUMN);
echo "All task columns: " . implode(", ", $cols) . "\n";