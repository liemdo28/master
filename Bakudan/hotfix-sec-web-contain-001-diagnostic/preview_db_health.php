<?php
/**
 * Preview DB Health Probe + Repair
 *
 * Usage:
 *   GET  /preview_db_health.php?token=PREVIEW_HEALTH_2026
 *   POST /preview_db_health.php?token=PREVIEW_HEALTH_2026&repair=1
 *
 * Override token by setting PREVIEW_HEALTH_TOKEN in .env.preview / .env.
 */

function preview_env_candidates(): array {
    $candidates = [];
    $forced = getenv('APP_ENV_FILE') ?: ($_SERVER['APP_ENV_FILE'] ?? '');
    if ($forced !== '') $candidates[] = $forced;

    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    if ($host !== '' && (str_contains($host, 'preview.') || str_contains($host, 'draft.') || str_contains($host, 'staging.'))) {
        $candidates[] = __DIR__ . '/.env.preview';
    }

    $candidates[] = __DIR__ . '/.env';
    $candidates[] = __DIR__ . '/.env.preview';
    return array_values(array_unique($candidates));
}

function preview_load_env(): ?string {
    foreach (preview_env_candidates() as $file) {
        if (!$file || !file_exists($file)) continue;
        foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
            $existing = getenv($key);
            if ($existing === false || $existing === '') {
                $_ENV[$key] = $value;
                putenv("$key=$value");
            } elseif (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $existing;
            }
        }
        return $file;
    }
    return null;
}

$loadedEnv = preview_load_env();
$expectedToken = $_ENV['PREVIEW_HEALTH_TOKEN'] ?? getenv('PREVIEW_HEALTH_TOKEN') ?: 'PREVIEW_HEALTH_2026';
$providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_PREVIEW_HEALTH_TOKEN'] ?? '');

if (php_sapi_name() !== 'cli' && !hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['status' => 'FORBIDDEN', 'message' => 'Valid token required.'], JSON_PRETTY_PRINT);
    exit;
}

$appEnv = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: 'unknown';
$dbHost = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '';
$dbPort = (int)($_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: 3306);
$dbName = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: '';
$dbUser = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: '';
$dbPass = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '';

$isPreviewDb = stripos($dbName, 'preview') !== false || stripos($dbHost, 'preview') !== false;
$isProductionDb = $dbName === 'taskflow_db' || stripos($dbHost, 'mysql-taskflow.bakudanramen.com') !== false;

$result = [
    'status' => 'UNKNOWN',
    'checked_at' => date('c'),
    'env' => [
        'loaded_file' => $loadedEnv ? basename($loadedEnv) : null,
        'loaded_file_exists' => $loadedEnv !== null,
        'app_env' => $appEnv,
        'app_url' => $_ENV['APP_URL'] ?? getenv('APP_URL') ?: null,
    ],
    'database' => [
        'host' => $dbHost ?: null,
        'port' => $dbPort,
        'name' => $dbName ?: null,
        'user_present' => $dbUser !== '',
        'password_present' => $dbPass !== '',
        'uses_preview_db' => $isPreviewDb,
        'uses_production_db' => $isProductionDb,
    ],
    'checks' => [],
];

$result['checks'][] = [
    'name' => 'env_file_loaded',
    'status' => $loadedEnv ? 'PASS' : 'FAIL',
];
$result['checks'][] = [
    'name' => 'preview_db_name',
    'status' => $dbName === 'bakudan_preview' ? 'PASS' : 'FAIL',
    'expected' => 'bakudan_preview',
    'actual' => $dbName ?: null,
];
$result['checks'][] = [
    'name' => 'not_production_db',
    'status' => !$isProductionDb ? 'PASS' : 'FAIL',
];

if ($dbHost === '' || $dbName === '' || $dbUser === '' || $dbPass === '') {
    $result['status'] = 'FAIL';
    $result['checks'][] = ['name' => 'db_config_complete', 'status' => 'FAIL'];
} else {
    $result['checks'][] = ['name' => 'db_config_complete', 'status' => 'PASS'];
    try {
        $pdo = new PDO(
            "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
            $dbUser,
            $dbPass,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_TIMEOUT => 5,
            ]
        );
        $result['checks'][] = ['name' => 'db_connection', 'status' => 'PASS'];
        $result['checks'][] = ['name' => 'current_database', 'status' => $pdo->query('SELECT DATABASE()')->fetchColumn()];
        $tables = ['users', 'tasks', 'task_comments', 'task_mentions', 'task_notifications', 'task_reviewer_notes', 'task_approval_notes'];
        $tableStatus = [];
        foreach ($tables as $table) {
            $stmt = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
            $stmt->execute([$table]);
            $tableStatus[$table] = $stmt->fetchColumn() ? 'EXISTS' : 'MISSING';
        }
        $result['tables'] = $tableStatus;
        $result['status'] = in_array('MISSING', $tableStatus, true) ? 'UNKNOWN' : 'PASS';

        // ── REPAIR MODE ───────────────────────────────────────────────────────
        if (isset($_GET['repair']) && $_GET['repair'] === '1' && php_sapi_name() !== 'cli') {
            header('Content-Type: application/json; charset=utf-8');
            $repairResult = ['repair_started_at' => date('c'), 'steps' => []];

            // Step 1: Inspect orphaned section_ids
            $orphans = $pdo->query("
                SELECT t.id, t.title, t.section_id, t.project_id
                FROM tasks t
                LEFT JOIN sections s ON s.id = t.section_id
                WHERE t.section_id IS NOT NULL AND s.id IS NULL
            ")->fetchAll(PDO::FETCH_ASSOC);
            $repairResult['steps'][] = [
                'step' => 1,
                'name' => 'inspect_orphans',
                'count' => count($orphans),
                'details' => $orphans,
            ];

            // Step 2: Repair orphaned section_ids → NULL
            $pdo->exec("
                UPDATE tasks t
                LEFT JOIN sections s ON s.id = t.section_id
                SET t.section_id = NULL
                WHERE t.section_id IS NOT NULL AND s.id IS NULL
            ");
            $repairResult['steps'][] = [
                'step' => 2,
                'name' => 'repair_orphans',
                'affected_rows' => $pdo->rowCount(),
                'done' => true,
            ];

            // Step 3: Ensure default sections for projects
            $projectsWithoutSections = $pdo->query("
                SELECT p.id, p.name
                FROM projects p
                WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.project_id = p.id)
            ")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($projectsWithoutSections as $p) {
                $pdo->prepare("INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)")
                    ->execute([$p['id']]);
            }
            $repairResult['steps'][] = [
                'step' => 3,
                'name' => 'ensure_default_sections',
                'projects_without_sections_before' => count($projectsWithoutSections),
                'created_sections' => array_map(fn($p) => ['project_id' => $p['id'], 'section_id' => (int)$pdo->lastInsertId()], $projectsWithoutSections),
                'done' => true,
            ];

            // Step 4: Verify sections table
            $sectionCols = $pdo->query("SHOW COLUMNS FROM sections")->fetchAll(PDO::FETCH_COLUMN, 1);
            $sectionCount = $pdo->query("SELECT COUNT(*) FROM sections")->fetchColumn();
            $finalOrphans = $pdo->query("
                SELECT COUNT(*) FROM tasks t
                LEFT JOIN sections s ON s.id = t.section_id
                WHERE t.section_id IS NOT NULL AND s.id IS NULL
            ")->fetchColumn();
            $repairResult['steps'][] = [
                'step' => 4,
                'name' => 'verify_sections_table',
                'columns' => $sectionCols,
                'total_sections' => $sectionCount,
                'final_orphan_count' => (int)$finalOrphans,
                'done' => true,
            ];

            $repairResult['repair_completed_at'] = date('c');
            $repairResult['status'] = ($finalOrphans == 0) ? 'CLEAN' : 'ISSUES_REMAIN';

            echo json_encode($repairResult, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
            exit;
        }
        // ── END REPAIR MODE ────────────────────────────────────────────────────

    } catch (Throwable $e) {
        $result['status'] = 'FAIL';
        $result['checks'][] = [
            'name' => 'db_connection',
            'status' => 'FAIL',
            'error_class' => get_class($e),
            'error_message' => $e->getMessage(),
        ];
    }
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
if (php_sapi_name() === 'cli' && $result['status'] === 'FAIL') {
    exit(1);
}
