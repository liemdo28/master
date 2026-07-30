<?php
/**
 * CLI migration runner — runs a SQL file on the production DB
 * Usage: php scripts/cli_run_migration.php database/migrations/2026_06_12_dashboard_requirements.sql
 */
chdir(dirname(__DIR__));
require_once __DIR__ . '/../config/database.php';

$file = $argv[1] ?? '';
if (!$file || !file_exists($file)) {
    echo "Usage: php scripts/cli_run_migration.php <path/to/migration.sql>\n";
    exit(1);
}

$sql = file_get_contents($file);
$pdo = Database::getInstance()->getConnection();

// Split on semicolons, run each statement. Strip full-line SQL comments from
// each chunk first — a chunk that merely *starts* with a comment header
// (e.g. "-- Table 1\nCREATE TABLE ...") must not be treated as comment-only
// and dropped.
$statements = [];
foreach (preg_split('/;\s*\n/', $sql) as $chunk) {
    $lines = preg_split('/\r?\n/', $chunk);
    $lines = array_filter($lines, fn($line) => !preg_match('/^\s*--/', $line));
    $stmt = trim(implode("\n", $lines));
    if ($stmt !== '') {
        $statements[] = $stmt;
    }
}

$ok = 0; $err = 0;
foreach ($statements as $stmt) {
    $stmt = trim($stmt);
    if ($stmt === '') continue;
    try {
        $pdo->exec($stmt);
        echo "  ✅ OK\n";
        $ok++;
    } catch (PDOException $e) {
        // Ignore "table already exists" and "duplicate column" — idempotent
        if (strpos($e->getMessage(), 'already exists') !== false
            || strpos($e->getMessage(), 'Duplicate column') !== false) {
            echo "  ⚠️  Skipped (already exists)\n";
        } else {
            echo "  ❌ Error: " . $e->getMessage() . "\n";
            echo "     Statement: " . substr($stmt, 0, 120) . "...\n";
            $err++;
        }
    }
}

echo "\nMigration complete: $ok OK, $err errors\n";
exit($err > 0 ? 1 : 0);
