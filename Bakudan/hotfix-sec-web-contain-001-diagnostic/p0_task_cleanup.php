<?php
/**
 * P0: Archive duplicate tasks by duplicate_hash
 * Keeps lowest ID per group, archives the rest
 */
error_reporting(0);
ini_set('max_execution_time', '600');
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/config/database.php';
$db = Database::getInstance();
$pdo = $db->getConnection();

try {
    // Find duplicate groups
    $groups = $db->fetchAll("
        SELECT duplicate_hash, COUNT(*) AS cnt, GROUP_CONCAT(id ORDER BY id) AS ids, MIN(title) AS title
        FROM tasks
        WHERE duplicate_hash IS NOT NULL AND duplicate_hash != ''
        GROUP BY duplicate_hash
        HAVING COUNT(*) > 1
        ORDER BY COUNT(*) DESC
    ");
    
    $totalArchived = 0;
    $totalKept = 0;
    $errors = [];
    $details = [];
    
    foreach ($groups as $g) {
        $ids = array_map('intval', explode(',', $g['ids']));
        $keep = $ids[0]; // lowest ID = canonical
        $archive = array_slice($ids, 1);
        
        foreach ($archive as $id) {
            try {
                $pdo->exec("UPDATE tasks SET archived_duplicate = 1 WHERE id = {$id}");
                $totalArchived++;
            } catch (Throwable $e) {
                // Fallback: try deleted_at
                try {
                    $pdo->exec("UPDATE tasks SET deleted_at = NOW() WHERE id = {$id}");
                    $totalArchived++;
                } catch (Throwable $e2) {
                    $errors[] = "task#{$id}: " . $e2->getMessage();
                }
            }
        }
        $totalKept++;
        $details[] = [
            'title' => $g['title'],
            'keep' => $keep,
            'archived' => $archive,
            'group_size' => $g['cnt'],
        ];
    }
    
    echo json_encode([
        'ok' => true,
        'groups_found' => count($groups),
        'tasks_kept' => $totalKept,
        'tasks_archived' => $totalArchived,
        'errors' => $errors,
        'details' => $details,
    ]);
    
} catch (Throwable $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
