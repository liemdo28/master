<?php
/**
 * One-time script: mark all overdue tasks of Admin as completed.
 *
 * HTTP: https://dashboard.bakudanramen.com/admin_complete_overdue.php?key=complete-overdue-2024
 *
 * DELETE this file after running.
 */

$SECRET = 'complete-overdue-2024';

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    $key = $_GET['key'] ?? '';
    if ($key !== $SECRET) { http_response_code(403); die('Forbidden'); }
    header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/time.php';
if (function_exists('app_set_timezone')) app_set_timezone();
if (!function_exists('app_today')) { function app_today(): string { return date('Y-m-d'); } }

$db    = Database::getInstance();
$today = app_today();
$now   = date('Y-m-d H:i:s');

// Find admin user
$admin = $db->fetch(
    "SELECT id, name, email FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
    ['liem.dt0208@gmail.com']
);

if (!$admin) {
    // Fallback: first admin by role
    $admin = $db->fetch("SELECT id, name, email FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1");
}

if (!$admin) {
    echo "ERROR: No admin user found." . PHP_EOL;
    exit(1);
}

echo "Admin found: id={$admin['id']} name={$admin['name']} email={$admin['email']}" . PHP_EOL;

// Get overdue tasks before
$overdueTasks = $db->fetchAll(
    "SELECT id, title, due_date, status FROM tasks
     WHERE assignee_id = ?
       AND is_completed = 0
       AND due_date < ?
     ORDER BY due_date ASC",
    [$admin['id'], $today]
);

$count = count($overdueTasks);
echo "Overdue tasks found: {$count}" . PHP_EOL;

if ($count === 0) {
    echo "Nothing to do." . PHP_EOL;
    exit(0);
}

// Mark all as completed
$updated = $db->execute(
    "UPDATE tasks
     SET is_completed = 1,
         status       = 'done',
         completed_at = ?
     WHERE assignee_id = ?
       AND is_completed = 0
       AND due_date < ?",
    [$now, $admin['id'], $today]
);

echo PHP_EOL;
echo "Marked {$updated} tasks as completed:" . PHP_EOL;
foreach ($overdueTasks as $t) {
    echo "  [done] #{$t['id']} — {$t['title']} (due {$t['due_date']})" . PHP_EOL;
}

echo PHP_EOL;
echo "*** DELETE this file: admin_complete_overdue.php ***" . PHP_EOL;
