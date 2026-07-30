<?php
/**
 * DB Safety Check — CEO Directive Dashboard Safety
 * ===============================================
 * Verifies environment, DB config, table counts, dangerous command protection,
 * and latest backup existence. If any check fails: STOP DEPLOY.
 *
 * Usage:
 *   php scripts/db-safety-check.php
 *
 * Exit codes:
 *   0 = PASS
 *   1 = FAIL
 */

require_once __DIR__ . '/../config/safety-guard.php';

function load_env_file(string $envFile): void {
    if (!file_exists($envFile)) return;
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
}

$forcedEnvFile = getenv('APP_ENV_FILE') ?: '';
if ($forcedEnvFile !== '') {
    load_env_file($forcedEnvFile);
} else {
    $host = strtolower(getenv('HTTP_HOST') ?: ($_SERVER['HTTP_HOST'] ?? ''));
    if (str_contains($host, 'preview.') || str_contains($host, 'draft.') || str_contains($host, 'staging.')) {
        load_env_file(__DIR__ . '/../.env.preview');
    }
    load_env_file(__DIR__ . '/../.env');
}

$appEnv = $_ENV['APP_ENV'] ?? getenv('APP_ENV') ?: safety_get_env();
$dbHost = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: 'unknown';
$dbPort = (int) ($_ENV['DB_PORT'] ?? getenv('DB_PORT') ?: 3306);
$dbName = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: 'unknown';
$dbUser = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: 'unknown';

$checks = [];
$failures = [];
$tableCounts = [];

function add_check(array &$checks, array &$failures, string $label, bool $ok, string $detail): void {
    $checks[] = ['label' => $label, 'ok' => $ok, 'detail' => $detail];
    if (!$ok) $failures[] = $label . ': ' . $detail;
}

add_check($checks, $failures, 'APP_ENV present', $appEnv !== '' && $appEnv !== 'unknown', "APP_ENV={$appEnv}");
add_check($checks, $failures, 'DB config present', $dbHost !== 'unknown' && $dbName !== 'unknown' && $dbUser !== 'unknown', "host={$dbHost} db={$dbName} user={$dbUser} port={$dbPort}");

$pdo = null;
if ($dbHost !== 'unknown' && $dbName !== 'unknown' && $dbUser !== 'unknown') {
    try {
        $pdo = new PDO(
            "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
            $dbUser,
            $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '',
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
        );
        add_check($checks, $failures, 'DB connection', true, 'Connection successful');
    } catch (Throwable $e) {
        add_check($checks, $failures, 'DB connection', false, $e->getMessage());
    }
}

if ($pdo) {
    foreach (['tasks', 'users', 'attachments', 'comments'] as $table) {
        try {
            $tableCounts[$table] = (int) $pdo->query("SELECT COUNT(*) FROM `{$table}`")->fetchColumn();
        } catch (Throwable $e) {
            $tableCounts[$table] = 'ERROR: ' . $e->getMessage();
            $failures[] = "Table count failed: {$table}";
        }
    }
}

$dangerousSql = "DELETE FROM tasks WHERE 1=1";
$guardResult  = safety_check($dangerousSql, 'delete');
add_check(
    $checks,
    $failures,
    'Dangerous command protection',
    $guardResult['blocked'] === true || !in_array($appEnv, ['production', 'staging'], true),
    $guardResult['reason']
);

$backupDir = __DIR__ . '/../backups';
$latestBackup = null;
if (is_dir($backupDir)) {
    $files = glob($backupDir . '/*.sql.gz') ?: [];
    if (!empty($files)) {
        usort($files, fn($a, $b) => filemtime($b) <=> filemtime($a));
        $latestBackup = $files[0];
    }
}

add_check(
    $checks,
    $failures,
    'Latest backup exists',
    $latestBackup !== null,
    $latestBackup ? basename($latestBackup) . ' | ' . date('c', filemtime($latestBackup)) : 'No backup found in backups/'
);

$isProtectedEnv = in_array($appEnv, ['production', 'staging', 'preview', 'draft'], true);
$looksLikePreviewDb = preg_match('/preview|draft|staging/i', $dbName) || preg_match('/preview|draft|staging/i', $dbHost);
$looksLikeProdDb = ($dbHost === 'mysql-taskflow.bakudanramen.com' && $dbName === 'taskflow_db');

$envStrategy = 'unknown';
if (in_array($appEnv, ['preview', 'draft', 'staging'], true)) {
    if ($looksLikeProdDb) {
        $envStrategy = 'same production SQL database';
    } elseif ($looksLikePreviewDb) {
        $envStrategy = 'copy staging/preview database';
    } else {
        $envStrategy = 'wrong database';
    }
} elseif ($appEnv === 'local') {
    $envStrategy = $looksLikePreviewDb ? 'local preview database' : ($looksLikeProdDb ? 'production-like shared DB' : 'unknown local DB');
} elseif ($appEnv === 'production') {
    $envStrategy = 'production SQL database';
}

if ($isProtectedEnv && $pdo && isset($tableCounts['tasks']) && is_int($tableCounts['tasks']) && $tableCounts['tasks'] === 0) {
    $failures[] = 'CRITICAL: task count is zero in protected environment — draft/staging may be using the wrong DB';
}

$report = [
    'timestamp' => date('c'),
    'app_env' => $appEnv,
    'db' => [
        'host' => $dbHost,
        'port' => $dbPort,
        'name' => $dbName,
        'user' => $dbUser,
    ],
    'strategy_assessment' => $envStrategy,
    'table_counts' => $tableCounts,
    'latest_backup' => $latestBackup ? [
        'filename' => basename($latestBackup),
        'timestamp' => date('c', filemtime($latestBackup)),
        'size_bytes' => filesize($latestBackup),
        'path' => $latestBackup,
    ] : null,
    'checks' => $checks,
    'passed' => empty($failures),
    'failures' => $failures,
];

$reportPath = __DIR__ . '/../reports/db-safety-check.json';
if (!is_dir(dirname($reportPath))) mkdir(dirname($reportPath), 0755, true);
file_put_contents($reportPath, json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

echo "========================================================\n";
echo " DB SAFETY CHECK\n";
echo "========================================================\n";
echo " APP_ENV    : {$appEnv}\n";
echo " DB_HOST    : {$dbHost}\n";
echo " DB_PORT    : {$dbPort}\n";
echo " DB_NAME    : {$dbName}\n";
echo " DB_USER    : {$dbUser}\n";
echo " Strategy   : {$envStrategy}\n";
echo "--------------------------------------------------------\n";
foreach ($checks as $check) {
    echo sprintf(" [%s] %s — %s\n", $check['ok'] ? 'PASS' : 'FAIL', $check['label'], $check['detail']);
}
echo "--------------------------------------------------------\n";
foreach ($tableCounts as $table => $count) {
    echo " {$table}: {$count}\n";
}
if ($latestBackup) {
    echo " Latest backup: " . basename($latestBackup) . "\n";
}
echo " Report path: {$reportPath}\n";
echo "========================================================\n";

if (!empty($failures)) {
    echo "STOP DEPLOY — failures detected:\n";
    foreach ($failures as $failure) echo " - {$failure}\n";
    exit(1);
}

echo "SAFE TO PROCEED\n";
exit(0);
