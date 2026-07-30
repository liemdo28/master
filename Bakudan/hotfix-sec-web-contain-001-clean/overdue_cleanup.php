<?php
/**
 * Dashboard overdue cleanup utility.
 *
 * Safe flow:
 *   /overdue_cleanup.php
 *     Confirms the script is installed, no DB access.
 *   /overdue_cleanup.php?key=deploy-p3-2026
 *     Dry-run preview.
 *   /overdue_cleanup.php?key=deploy-p3-2026&execute=1
 *     Deletes dashboard tasks overdue by 7+ days.
 */

header('Content-Type: text/plain; charset=utf-8');

$expectedKey = $_ENV['OVERDUE_CLEANUP_KEY'] ?? getenv('OVERDUE_CLEANUP_KEY') ?: 'deploy-p3-2026';
$providedKey = (string)($_GET['key'] ?? '');
$execute = (string)($_GET['execute'] ?? '') === '1';

if ($providedKey === '') {
    echo "Dashboard overdue cleanup is installed.\n";
    echo "Dry-run: /overdue_cleanup.php?key=deploy-p3-2026\n";
    echo "Execute: /overdue_cleanup.php?key=deploy-p3-2026&execute=1\n";
    exit;
}

if (!hash_equals($expectedKey, $providedKey)) {
    http_response_code(403);
    echo "Forbidden: invalid cleanup key.\n";
    exit;
}

require_once __DIR__ . '/config/time.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/Task.php';

app_set_timezone();

$db = Database::getInstance();
$taskModel = new Task();
$today = app_today();
$cutoff = date('Y-m-d', strtotime($today . ' -7 days'));

echo "Dashboard overdue cleanup\n";
echo "Today: {$today}\n";
echo "Cutoff: tasks with due_date < {$cutoff} are older than 7 days\n";
echo "Mode: " . ($execute ? "EXECUTE" : "DRY RUN") . "\n\n";

$countRow = $db->fetch(
    "SELECT COUNT(*) AS cnt
     FROM tasks
     WHERE is_completed = 0
       AND due_date IS NOT NULL
       AND due_date < ?",
    [$cutoff]
);
$targetCount = (int)($countRow['cnt'] ?? 0);

$tasks = $db->fetchAll(
    "SELECT t.id, t.title, t.due_date,
            DATEDIFF(?, t.due_date) AS overdue_days,
            u.name AS assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.is_completed = 0
       AND t.due_date IS NOT NULL
       AND t.due_date < ?
     ORDER BY overdue_days DESC, t.due_date ASC, t.id ASC
     LIMIT 500",
    [$today, $cutoff]
);

echo "Matched overdue > 7 days: {$targetCount}\n";
echo "Preview rows loaded: " . count($tasks) . "\n\n";

$truncate = static function (string $value, int $length): string {
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $length);
    }
    return substr($value, 0, $length);
};

foreach (array_slice($tasks, 0, 25) as $task) {
    $title = preg_replace('/\s+/', ' ', (string)$task['title']);
    $assignee = $task['assignee_name'] ?: 'Unassigned';
    echo sprintf(
        "#%s | %s | due %s | %s days | %s\n",
        $task['id'],
        $truncate($title, 90),
        $task['due_date'],
        $task['overdue_days'],
        $assignee
    );
}

if ($targetCount > 25) {
    echo "... " . ($targetCount - 25) . " more matched tasks not shown\n";
}

if (!$execute) {
    echo "\nNo changes made. Add &execute=1 to delete matched dashboard tasks.\n";
    exit;
}

if ($targetCount !== count($tasks)) {
    http_response_code(409);
    echo "\nRefusing to execute: {$targetCount} tasks matched but only " . count($tasks) . " were loaded.\n";
    echo "Increase the script limit intentionally before running a larger cleanup.\n";
    exit;
}

$pdo = $db->getConnection();
$deleted = 0;

try {
    $pdo->beginTransaction();
    foreach ($tasks as $task) {
        if ($taskModel->delete((int)$task['id'])) {
            $deleted++;
        }
    }
    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo "\nCleanup failed; transaction rolled back.\n";
    echo "Error: " . $e->getMessage() . "\n";
    exit;
}

$remainingOld = (int)$db->fetchColumn(
    "SELECT COUNT(*)
     FROM tasks
     WHERE is_completed = 0
       AND due_date IS NOT NULL
       AND due_date < ?",
    [$cutoff]
);
$remainingRecent = (int)$db->fetchColumn(
    "SELECT COUNT(*)
     FROM tasks
     WHERE is_completed = 0
       AND due_date IS NOT NULL
       AND due_date >= ?
       AND due_date < ?",
    [$cutoff, $today]
);

echo "\nDeleted: {$deleted}\n";
echo "Remaining overdue > 7 days: {$remainingOld}\n";
echo "Remaining overdue 1-6 days: {$remainingRecent}\n";
echo "Done.\n";
