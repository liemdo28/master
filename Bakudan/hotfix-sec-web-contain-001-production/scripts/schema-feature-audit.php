<?php
/**
 * P0 schema feature audit.
 *
 * Usage:
 *   php scripts/schema-feature-audit.php
 *
 * Prints a JSON matrix for task approval / reviewer workspace schema drift.
 * Uses config/database.php, so it reads the same .env as the app.
 */

require_once __DIR__ . '/../config/database.php';

$root = realpath(__DIR__ . '/..');
$features = [
    'approval_events' => [
        'table' => 'task_approval_events',
        'feature' => 'Approval Events',
        'migration' => 'database/migrations/2026_06_02_task_approval_workflow.sql',
        'needles' => ['task_approval_events'],
    ],
    'comments' => [
        'table' => 'task_comments',
        'feature' => 'Comments',
        'migration' => 'database/migrations/2026_06_02_reviewer_workspace.sql',
        'needles' => ['task_comments'],
    ],
    'mentions' => [
        'table' => 'task_mentions',
        'feature' => 'Mentions',
        'migration' => 'database/migrations/2026_06_02_reviewer_workspace.sql',
        'needles' => ['task_mentions'],
    ],
    'notifications' => [
        'table' => 'task_notifications',
        'feature' => 'Notifications',
        'migration' => 'database/migrations/2026_06_02_reviewer_workspace.sql',
        'needles' => ['task_notifications'],
    ],
    'reviewer_notes' => [
        'table' => 'task_reviewer_notes',
        'feature' => 'Reviewer Notes',
        'migration' => 'database/migrations/2026_06_02_reviewer_workspace.sql',
        'needles' => ['task_reviewer_notes'],
    ],
    'approval_notes' => [
        'table' => 'task_approval_notes',
        'feature' => 'Approval Notes',
        'migration' => 'database/migrations/2026_06_02_reviewer_workspace.sql',
        'needles' => ['task_approval_notes'],
    ],
];

$scanDirs = ['controllers', 'models', 'views', 'service', 'config', 'index.php'];

function file_contains_any(string $file, array $needles): bool {
    $body = @file_get_contents($file);
    if ($body === false) return false;
    foreach ($needles as $needle) {
        if (strpos($body, $needle) !== false) return true;
    }
    return false;
}

function code_uses(string $root, array $paths, array $needles): array {
    $hits = [];
    foreach ($paths as $path) {
        $full = $root . DIRECTORY_SEPARATOR . $path;
        if (is_file($full)) {
            if (file_contains_any($full, $needles)) $hits[] = $path;
            continue;
        }
        if (!is_dir($full)) continue;
        $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($full, FilesystemIterator::SKIP_DOTS));
        foreach ($it as $file) {
            if (!$file->isFile()) continue;
            $ext = strtolower(pathinfo($file->getFilename(), PATHINFO_EXTENSION));
            if (!in_array($ext, ['php', 'sql'], true)) continue;
            if (file_contains_any($file->getPathname(), $needles)) {
                $hits[] = str_replace($root . DIRECTORY_SEPARATOR, '', $file->getPathname());
            }
        }
    }
    return array_values(array_unique($hits));
}

$db = Database::getInstance();
$matrix = [];
$missing = [];

foreach ($features as $key => $feature) {
    $hits = code_uses($root, $scanDirs, $feature['needles']);
    $migrationPath = $root . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $feature['migration']);
    $tableExists = $db->tableExists($feature['table']);

    $status = 'PASS';
    if (!empty($hits) && !$tableExists) {
        $status = 'FAIL';
        $missing[] = $feature['table'];
    } elseif (empty($hits) && !$tableExists) {
        $status = 'UNKNOWN';
    }

    $matrix[] = [
        'feature' => $feature['feature'],
        'table' => $feature['table'],
        'code_exists' => !empty($hits),
        'code_references' => $hits,
        'migration_exists' => file_exists($migrationPath),
        'production_table_exists' => $tableExists,
        'status' => $status,
    ];
}

$overall = empty($missing) ? 'PASS' : 'FAIL';

echo json_encode([
    'status' => $overall,
    'database' => DB_NAME,
    'checked_at' => date('c'),
    'missing_tables_referenced_by_code' => $missing,
    'matrix' => $matrix,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
