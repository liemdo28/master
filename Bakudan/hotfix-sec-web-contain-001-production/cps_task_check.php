<?php
/**
 * Read-only CPS/Gas Electric task checker.
 *
 * /cps_task_check.php
 *   Confirms the checker is installed, no DB access.
 * /cps_task_check.php?key=deploy-p3-2026
 *   Returns live task candidates and B1/B2/B3 split coverage as JSON.
 */

header('Content-Type: application/json; charset=utf-8');

$expectedKey = $_ENV['CPS_TASK_CHECK_KEY'] ?? getenv('CPS_TASK_CHECK_KEY') ?: 'deploy-p3-2026';
$providedKey = (string)($_GET['key'] ?? '');

if ($providedKey === '') {
    echo json_encode([
        'status' => 'installed',
        'usage' => '/cps_task_check.php?key=deploy-p3-2026',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

if (!hash_equals($expectedKey, $providedKey)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden: invalid checker key.'], JSON_PRETTY_PRINT);
    exit;
}

require_once __DIR__ . '/config/time.php';
require_once __DIR__ . '/config/database.php';

app_set_timezone();

$db = Database::getInstance();

$hasTaskStores = $db->tableExists('task_stores');
$hasDirectStore = $db->columnExists('tasks', 'direct_store_id');
$hasRepeatType = $db->columnExists('tasks', 'repeat_type');
$hasRepeatConfig = $db->columnExists('tasks', 'repeat_config');
$hasArchivedDuplicate = $db->columnExists('tasks', 'archived_duplicate');

$directStoreSelect = $hasDirectStore ? 't.direct_store_id' : 'NULL';
$repeatTypeSelect = $hasRepeatType ? 't.repeat_type' : 'NULL';
$repeatConfigSelect = $hasRepeatConfig ? 't.repeat_config' : 'NULL';
$archivedWhere = $hasArchivedDuplicate ? 'AND COALESCE(t.archived_duplicate, 0) = 0' : '';

$taskStoreJoin = $hasTaskStores
    ? 'LEFT JOIN task_stores ts ON ts.task_id = t.id LEFT JOIN stores pts ON pts.id = ts.store_id'
    : '';
$linkedStoresSelect = $hasTaskStores
    ? "GROUP_CONCAT(DISTINCT pts.name ORDER BY pts.name SEPARATOR ', ')"
    : 'NULL';

$matchWhere = "(
       LOWER(t.title) LIKE '%cps energy%'
    OR LOWER(t.description) LIKE '%cps energy%'
    OR LOWER(t.title) LIKE '%cpsenergy%'
    OR LOWER(t.description) LIKE '%cpsenergy%'
    OR LOWER(t.title) LIKE '%gas and electric%'
    OR LOWER(t.description) LIKE '%gas and electric%'
    OR LOWER(t.title) LIKE '%pay gas%'
    OR LOWER(t.description) LIKE '%pay gas%'
    OR LOWER(t.title) = 'jht - pay gas and electric'
)";

$tasks = $db->fetchAll(
    "SELECT
        t.id,
        t.title,
        t.description,
        t.due_date,
        t.status,
        t.is_completed,
        {$repeatTypeSelect} AS repeat_type,
        {$repeatConfigSelect} AS repeat_config,
        {$directStoreSelect} AS direct_store_id,
        p.name AS project_name,
        ps.name AS project_store_name,
        ds.name AS direct_store_name,
        {$linkedStoresSelect} AS linked_store_names,
        u.name AS assignee_name,
        c.name AS creator_name,
        t.created_at,
        t.updated_at
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     LEFT JOIN stores ps ON ps.id = p.store_id
     LEFT JOIN stores ds ON ds.id = {$directStoreSelect}
     LEFT JOIN users u ON u.id = t.assignee_id
     LEFT JOIN users c ON c.id = t.created_by
     {$taskStoreJoin}
     WHERE {$matchWhere}
       {$archivedWhere}
     GROUP BY t.id
     ORDER BY t.is_completed ASC, t.due_date IS NULL ASC, t.due_date ASC, t.updated_at DESC
     LIMIT 250"
);

$taskStats = $db->fetch(
    "SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN t.is_completed = 0 THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN t.is_completed = 1 THEN 1 ELSE 0 END) AS completed_count
     FROM tasks t
     WHERE {$matchWhere}
       {$archivedWhere}"
);

$stores = $db->fetchAll(
    "SELECT id, name
     FROM stores
     WHERE is_active = 1
       AND (
          name LIKE '%B1%' OR name LIKE '%B2%' OR name LIKE '%B3%'
          OR name LIKE '%Rim%' OR name LIKE '%Stone Oak%' OR name LIKE '%Bandera%'
       )
     ORDER BY name"
);

$coverage = [];
foreach ($stores as $store) {
    $storeId = (int)$store['id'];
    $params = [$storeId, $storeId];
    $storePredicate = "(t.project_id IN (SELECT id FROM projects WHERE store_id = ?)";
    if ($hasDirectStore) {
        $storePredicate .= " OR t.direct_store_id = ?";
    } else {
        $params = [$storeId];
    }
    if ($hasTaskStores) {
        $storePredicate .= " OR EXISTS (SELECT 1 FROM task_stores ts2 WHERE ts2.task_id = t.id AND ts2.store_id = ?)";
        $params[] = $storeId;
    }
    $storePredicate .= ")";

    $params = array_merge($params, []);
    $rows = $db->fetchAll(
        "SELECT t.id, t.title, t.due_date, t.status, t.is_completed,
                {$repeatTypeSelect} AS repeat_type,
                u.name AS assignee_name
         FROM tasks t
         LEFT JOIN users u ON u.id = t.assignee_id
         WHERE {$storePredicate}
           AND {$matchWhere}
           {$archivedWhere}
         ORDER BY t.is_completed ASC, t.due_date IS NULL ASC, t.due_date ASC, t.id ASC
         LIMIT 50",
        $params
    );

    $coverage[] = [
        'store_id' => $storeId,
        'store_name' => $store['name'],
        'matched_task_count' => count($rows),
        'open_task_count' => count(array_filter($rows, fn($r) => empty($r['is_completed']))),
        'tasks' => $rows,
    ];
}

echo json_encode([
    'status' => 'ok',
    'today' => app_today(),
    'match_terms' => ['CPS Energy', 'cpsenergy', 'Gas and Electric', 'Pay Gas', 'JHT - Pay Gas and Electric'],
    'task_stats' => [
        'total' => (int)($taskStats['total'] ?? 0),
        'open' => (int)($taskStats['open_count'] ?? 0),
        'completed' => (int)($taskStats['completed_count'] ?? 0),
    ],
    'candidate_count' => count($tasks),
    'candidates' => $tasks,
    'target_store_coverage' => $coverage,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
