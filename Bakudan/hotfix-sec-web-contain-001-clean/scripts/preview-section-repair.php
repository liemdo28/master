<?php
/**
 * Preview Section Repair — run once on preview DB only.
 * Access: https://preview.dashboard.bakudanramen.com/scripts/preview-section-repair.php
 * Protected by APP_ENV check — will refuse to run on production.
 */
define('ROOT_PATH', dirname(__DIR__));
require_once ROOT_PATH . '/config/safety-guard.php';
require_once ROOT_PATH . '/config/database.php';

// Safety: only run on staging/preview
$env = safety_get_env();
if (!in_array($env, ['staging', 'local'], true)) {
    http_response_code(403);
    die(json_encode(['error' => 'This script only runs on staging/preview. Current env: ' . $env]));
}

header('Content-Type: application/json');

try {
    $db = Database::getInstance();

    // 1. Count orphaned tasks before repair
    $orphaned = $db->fetchAll(
        "SELECT t.id, t.title, t.section_id
         FROM tasks t
         LEFT JOIN sections s ON s.id = t.section_id
         WHERE t.section_id IS NOT NULL AND s.id IS NULL"
    );

    // 2. Repair: set orphaned section_id to NULL
    $db->update(
        "UPDATE tasks t
         LEFT JOIN sections s ON s.id = t.section_id
         SET t.section_id = NULL
         WHERE t.section_id IS NOT NULL AND s.id IS NULL"
    );
    $repairedCount = count($orphaned);

    // 3. Create default 'To Do' section for projects with no sections
    $db->insert(
        "INSERT INTO sections (project_id, name, position)
         SELECT p.id, 'To Do', 0
         FROM projects p
         LEFT JOIN sections s ON s.project_id = p.id
         WHERE s.id IS NULL"
    );

    // 4. Count projects that now have sections
    $sectionsAfter = $db->fetchAll(
        "SELECT id, project_id, name, position FROM sections ORDER BY project_id, position"
    );

    echo json_encode([
        'status'         => 'ok',
        'env'            => $env,
        'orphaned_fixed' => $repairedCount,
        'orphaned_tasks' => $orphaned,
        'sections_after' => $sectionsAfter,
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
