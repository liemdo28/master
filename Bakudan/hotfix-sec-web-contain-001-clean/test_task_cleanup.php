<?php
/**
 * Dashboard test task cleanup utility.
 *
 * Safe flow:
 *   /test_task_cleanup.php
 *     Confirms the script is installed, no DB access.
 *   /test_task_cleanup.php?key=deploy-p3-2026
 *     Dry-run preview of tasks whose title contains "test" as its own word.
 *   /test_task_cleanup.php?key=deploy-p3-2026&execute=1
 *     Deletes matched dashboard tasks.
 */

header('Content-Type: text/plain; charset=utf-8');

$expectedKey = $_ENV['TEST_TASK_CLEANUP_KEY'] ?? getenv('TEST_TASK_CLEANUP_KEY') ?: 'deploy-p3-2026';
$providedKey = (string)($_GET['key'] ?? '');
$execute = (string)($_GET['execute'] ?? '') === '1';

if ($providedKey === '') {
    echo "Dashboard test task cleanup is installed.\n";
    echo "Dry-run: /test_task_cleanup.php?key=deploy-p3-2026\n";
    echo "Execute: /test_task_cleanup.php?key=deploy-p3-2026&execute=1\n";
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
$testWordPattern = '(^|[^a-z0-9])test([^a-z0-9]|$)';

echo "Dashboard test task cleanup\n";
echo "Today: {$today}\n";
echo "Match: LOWER(title) REGEXP '(^|[^a-z0-9])test([^a-z0-9]|$)'\n";
echo "Mode: " . ($execute ? "EXECUTE" : "DRY RUN") . "\n\n";

$countRow = $db->fetch(
    "SELECT COUNT(*) AS cnt
     FROM tasks
     WHERE LOWER(title) REGEXP ?",
    [$testWordPattern]
);
$targetCount = (int)($countRow['cnt'] ?? 0);

$tasks = $db->fetchAll(
    "SELECT t.id, t.title, t.due_date, t.status, t.is_completed,
            p.name AS project_name,
            u.name AS assignee_name
     FROM tasks t
     LEFT JOIN projects p ON t.project_id = p.id
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE LOWER(t.title) REGEXP ?
     ORDER BY t.due_date IS NULL ASC, t.due_date ASC, t.id ASC
     LIMIT 500",
    [$testWordPattern]
);

echo "Matched test-title tasks: {$targetCount}\n";
echo "Preview rows loaded: " . count($tasks) . "\n\n";

$truncate = static function (string $value, int $length): string {
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $length);
    }
    return substr($value, 0, $length);
};

foreach (array_slice($tasks, 0, 50) as $task) {
    $title = preg_replace('/\s+/', ' ', (string)$task['title']);
    $project = $task['project_name'] ?: 'No project';
    $assignee = $task['assignee_name'] ?: 'Unassigned';
    $state = !empty($task['is_completed']) ? 'completed' : ((string)($task['status'] ?? '') ?: 'open');
    echo sprintf(
        "#%s | %s | due %s | %s | %s | %s\n",
        $task['id'],
        $truncate($title, 90),
        $task['due_date'] ?: 'none',
        $state,
        $truncate((string)$project, 40),
        $truncate((string)$assignee, 40)
    );
}

if ($targetCount > 50) {
    echo "... " . ($targetCount - 50) . " more matched tasks not shown\n";
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

$remaining = (int)$db->fetchColumn(
    "SELECT COUNT(*)
     FROM tasks
     WHERE LOWER(title) REGEXP ?",
    [$testWordPattern]
);

echo "\nDeleted: {$deleted}\n";
echo "Remaining test-title tasks: {$remaining}\n";
echo "Done.\n";
