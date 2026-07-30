<?php
chdir(dirname(__DIR__));

// Load env — try .env.preview first (preview server), fall back to .env (production)
foreach ([__DIR__ . '/../.env.preview', __DIR__ . '/../.env'] as $envFile) {
    if (file_exists($envFile)) {
        foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
            if (preg_match('/^\s*(DB_[A-Z_]+)\s*=\s*(.+)$/', $line, $m)) {
                putenv("{$m[1]}={$m[2]}");
            }
        }
        echo "Using env: $envFile\n";
        break;
    }
}

$host    = getenv('DB_HOST') ?: 'mysql-taskflow.bakudanramen.com';
$port    = (int)(getenv('DB_PORT') ?: 3306);
$dbname  = getenv('DB_NAME') ?: 'taskflow_db';
$user    = getenv('DB_USER') ?: 'liemdo';
$pass    = getenv('DB_PASS') ?: '';
echo "Connecting to DB: $dbname @ $host\n";

mysqli_report(MYSQLI_REPORT_OFF); // use return-value checks, not exceptions
$mysqli = new mysqli($host, $user, $pass, $dbname, $port);
if ($mysqli->connect_errno) {
    echo "DB connect failed: " . $mysqli->connect_error . "\n";
    exit(1);
}
$mysqli->set_charset('utf8mb4');

$migrations = [
    'database/migrations/2026_06_02_reviewer_workspace.sql',
    'database/migrations/2026_06_02_reviewer_workspace_v2.sql',
    'database/migrations/2026_06_10_p0_missing_reviewer_tables.sql',
    'database/migrations/2026_06_10_bill_registry_upgrade.sql',
    'database/migrations/2026_06_10_duplicate_control.sql',
    'database/migrations/2026_06_10_assignment_flow_fix.sql',
    'database/migrations/2026_06_11_task_notifications_inbox_category.sql',
    'database/migrations/2026_06_11_phase13_penalty_accountability.sql',
];

foreach ($migrations as $f) {
    if (!file_exists($f)) { echo "SKIP (not found): $f\n"; continue; }
    $sql = file_get_contents($f);
    // Strip single-line comments to prevent semicolons inside comments from splitting statements
    $sql = preg_replace('/--[^\n]*/', '', $sql);

    // Split on semicolons; keep only statements that contain SQL keywords
    $stmts = array_filter(array_map('trim', explode(';', $sql)), function($s) {
        return $s !== '' && preg_match('/\b(CREATE|ALTER|INSERT|UPDATE|DELETE|DROP|SET|PREPARE|EXECUTE|DEALLOCATE|SELECT)\b/i', $s);
    });

    $ok = 0; $err = 0;
    foreach ($stmts as $s) {
        if ($mysqli->query($s) !== false) {
            $ok++;
        } else {
            $msg = $mysqli->error;
            // Skip benign "already exists" errors
            if (preg_match('/Duplicate column|already exists|1060|1061|1050/i', $msg)) {
                $ok++;
            } else {
                echo "WARN [{$f}]: $msg\n";
                $err++;
            }
        }
    }
    echo "Migration $f: $ok ok, $err errors\n";
}

$mysqli->close();
echo "Migrations complete.\n";
