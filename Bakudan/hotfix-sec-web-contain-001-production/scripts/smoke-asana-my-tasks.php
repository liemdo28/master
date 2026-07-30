<?php
/**
 * Smoke test for Asana CEO My Tasks sync.
 *
 * Usage:
 *   ASANA_ACCESS_TOKEN=... ASANA_SYNC_MODE=my_tasks php scripts/smoke-asana-my-tasks.php
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/time.php';
require_once __DIR__ . '/../models/Project.php';
require_once __DIR__ . '/../models/Section.php';
require_once __DIR__ . '/../models/Task.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Store.php';
require_once __DIR__ . '/../controllers/AsanaController.php';

$token = getenv('ASANA_ACCESS_TOKEN') ?: ($_ENV['ASANA_ACCESS_TOKEN'] ?? '');
if (trim((string)$token) === '') {
    fwrite(STDERR, "ASANA_ACCESS_TOKEN is required\n");
    exit(2);
}

$result = (new AsanaController())->syncMyTasksFromAsana(
    $token,
    getenv('ASANA_WORKSPACE_GID') ?: ($_ENV['ASANA_WORKSPACE_GID'] ?? null)
);

echo json_encode([
    'success' => (bool)($result['success'] ?? false),
    'mode' => $result['mode'] ?? null,
    'created_tasks' => (int)($result['created_tasks'] ?? 0),
    'updated_tasks' => (int)($result['updated_tasks'] ?? 0),
    'skipped' => (int)($result['skipped'] ?? 0),
    'errors' => $result['errors'] ?? [],
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;

exit(!empty($result['success']) ? 0 : 1);
