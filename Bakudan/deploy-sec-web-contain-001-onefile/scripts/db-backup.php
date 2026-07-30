<?php
/**
 * Database Backup Script — CEO Directive Dashboard Safety
 * ======================================================
 * Creates a point-in-time SQL dump of all critical tables.
 * Safe: SELECT only, never modifies data.
 *
 * Usage:
 *   php scripts/db-backup.php
 *   php scripts/db-backup.php --tables=tasks,users,comments
 *
 * Output:
 *   backup_YYYYMMDD_HHMMSS.sql.gz  →  backups/ directory
 *   STDOUT: filename, timestamp, file size, path
 */

define('BACKUP_DIR', __DIR__ . '/../backups');
define('LOG_FILE',  __DIR__ . '/../logs/backup.log');

// ── Load .env ─────────────────────────────────────────────────────────────────
(function () {
    $envFile = __DIR__ . '/../.env';
    if (!file_exists($envFile)) {
        fwrite(STDERR, "[ERROR] .env not found. Cannot proceed.\n");
        exit(1);
    }
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key   = trim($key);
        $value = trim($value);
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
})();

$DB_HOST = $_ENV['DB_HOST'] ?? getenv('DB_HOST') ?: '';
$DB_NAME = $_ENV['DB_NAME'] ?? getenv('DB_NAME') ?: '';
$DB_USER = $_ENV['DB_USER'] ?? getenv('DB_USER') ?: '';
$DB_PASS = $_ENV['DB_PASS'] ?? getenv('DB_PASS') ?: '';

if (!$DB_HOST || !$DB_NAME || !$DB_USER) {
    fwrite(STDERR, "[ERROR] Missing DB credentials in .env (DB_HOST, DB_NAME, DB_USER required).\n");
    exit(1);
}

// ── Tables to backup (critical business data) ──────────────────────────────────
$TABLES_TO_BACKUP = [
    'tasks',
    'users',
    'comments',
    'attachments',
    'files',
    'images',
    'credentials',
    'credential_permissions',
    'task_approval_events',
    'audit_logs',
    'notifications',
    'stores',
    'projects',
    'shifts',
    'bills',
    'employees',
    'deadline_extensions',
    'penalty_log',
    'releases',
    'release_artifacts',
];

// Allow --tables override
if (isset($_SERVER['argv'][1]) && strpos($_SERVER['argv'][1], '--tables=') === 0) {
    $override = str_replace('--tables=', '', $_SERVER['argv'][1]);
    $TABLES_TO_BACKUP = array_filter(array_map('trim', explode(',', $override)));
}

// ── Setup ─────────────────────────────────────────────────────────────────────
if (!is_dir(BACKUP_DIR)) {
    mkdir(BACKUP_DIR, 0755, true);
}

$timestamp = date('Y-m-d_H-i-s');
$filename  = "backup_{$timestamp}.sql.gz";
$filepath  = BACKUP_DIR . "/{$filename}";

$fp = gzopen($filepath, 'w');
if (!$fp) {
    fwrite(STDERR, "[ERROR] Cannot write to {$filepath}\n");
    exit(1);
}

try {
    $pdo = new PDO(
        "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4",
        $DB_USER, $DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $pdo->exec("SET NAMES utf8mb4");
} catch (PDOException $e) {
    fwrite(STDERR, "[ERROR] DB connection failed: " . $e->getMessage() . "\n");
    exit(1);
}

// ── Write SQL header ───────────────────────────────────────────────────────────
$header = <<<SQL
-- ============================================================
-- Bakudan Dashboard — Database Backup
-- Timestamp : {$timestamp}
-- Database  : {$DB_NAME}
-- Host      : {$DB_HOST}
-- User      : {$DB_USER}
-- Generated : by scripts/db-backup.php
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

SQL;
gzwrite($fp, $header);

// ── Dump each table ────────────────────────────────────────────────────────────
$tableCounts = [];
$failedTables = [];

foreach ($TABLES_TO_BACKUP as $table) {
    $safeTable = preg_replace('/[^a-zA-Z0-9_]/', '', $table);

    // Check if table exists
    $exists = $pdo->query(
        "SELECT 1 FROM information_schema.tables
         WHERE table_schema = '{$DB_NAME}' AND table_name = '{$safeTable}' LIMIT 1"
    )->fetchColumn();

    if (!$exists) {
        fwrite(STDERR, "[SKIP]  Table '{$safeTable}' does not exist — skipping.\n");
        $tableCounts[$safeTable] = 'N/A (table not found)';
        continue;
    }

    // Get row count
    try {
        $count = (int) $pdo->query("SELECT COUNT(*) FROM `{$safeTable}`")->fetchColumn();
        $tableCounts[$safeTable] = $count;
    } catch (Exception $e) {
        $failedTables[] = $safeTable;
        $tableCounts[$safeTable] = 'ERROR';
        fwrite(STDERR, "[WARN]  Cannot count rows in '{$safeTable}': " . $e->getMessage() . "\n");
    }

    // Dump table structure
    $createSql = $pdo->query("SHOW CREATE TABLE `{$safeTable}`")->fetch();
    if ($createSql) {
        gzwrite($fp, "\n\n-- Table: {$safeTable} (rows: {$tableCounts[$safeTable]})\n");
        gzwrite($fp, "DROP TABLE IF EXISTS `{$safeTable}`;\n");
        gzwrite($fp, $createSql['Create Table'] . ";\n");
    }

    // Dump rows in chunks (200 rows per INSERT for readable output)
    if (($tableCounts[$safeTable] ?? 0) > 0) {
        $offset = 0;
        $chunkSize = 200;
        while (true) {
            $rows = $pdo->query(
                "SELECT * FROM `{$safeTable}` LIMIT {$chunkSize} OFFSET {$offset}"
            )->fetchAll(PDO::FETCH_ASSOC);
            if (empty($rows)) break;

            $cols = array_keys($rows[0]);
            $colsSafe = array_map(fn($c) => "`" . preg_replace('/[^a-zA-Z0-9_]/', '', $c) . "`", $cols);

            $valueLines = [];
            foreach ($rows as $row) {
                $serializedValues = [];
                foreach (array_values($row) as $value) {
                    if ($value === null) {
                        $serializedValues[] = 'NULL';
                    } elseif (is_bool($value)) {
                        $serializedValues[] = $value ? '1' : '0';
                    } elseif (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) {
                        $serializedValues[] = (string) $value;
                    } else {
                        $serializedValues[] = $pdo->quote((string) $value);
                    }
                }
                $valueLines[] = '(' . implode(', ', $serializedValues) . ')';
            }

            gzwrite($fp, "INSERT INTO `{$safeTable}` (" . implode(', ', $colsSafe) . ") VALUES\n");
            gzwrite($fp, implode(",\n", $valueLines) . ";\n");

            $offset += $chunkSize;
            if (count($rows) < $chunkSize) break;
        }
    }
}

gzwrite($fp, "\nSET FOREIGN_KEY_CHECKS = 1;\n");
gzclose($fp);

// ── Verify backup file ─────────────────────────────────────────────────────────
clearstatcache(true, $filepath);
$fileSize     = filesize($filepath);
$fileSizeHuman = $fileSize < 1048576
    ? round($fileSize / 1024, 1) . ' KB'
    : round($fileSize / 1048576, 1) . ' MB';

// ── Output result ──────────────────────────────────────────────────────────────
echo "\n";
echo "========================================================\n";
echo "  DATABASE BACKUP — COMPLETED\n";
echo "========================================================\n";
echo "  Filename   : {$filename}\n";
echo "  Timestamp  : {$timestamp}\n";
echo "  File Size  : {$fileSizeHuman} ({$fileSize} bytes)\n";
echo "  Storage    : {$filepath}\n";
echo "  Database   : {$DB_NAME}\n";
echo "  Host       : {$DB_HOST}\n";
echo "--------------------------------------------------------\n";
echo "  Table row counts:\n";
foreach ($tableCounts as $tbl => $cnt) {
    $pad = str_pad($tbl, 30, ' ', STR_PAD_RIGHT);
    echo "    {$pad} : {$cnt}\n";
}
if ($failedTables) {
    echo "  WARNING — failed tables: " . implode(', ', $failedTables) . "\n";
}
echo "========================================================\n";

// ── Log to file ────────────────────────────────────────────────────────────────
$logDir = dirname(LOG_FILE);
if (!is_dir($logDir)) mkdir($logDir, 0755, true);
$logEntry = sprintf(
    "[%s] BACKUP success | %s | %d bytes | tables: %d | failed: %s\n",
    date('Y-m-d H:i:s'),
    $filename,
    $fileSize,
    count(array_filter($tableCounts, fn($v) => $v !== 'N/A (table not found)' && $v !== 'ERROR')),
    implode(',', $failedTables ?: ['none'])
);
file_put_contents(LOG_FILE, $logEntry, FILE_APPEND | LOCK_EX);

echo "\nBackup saved. Copy this path for evidence:\n  {$filepath}\n\n";

exit(empty($failedTables) ? 0 : 2);
