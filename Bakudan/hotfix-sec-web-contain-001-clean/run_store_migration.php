<?php
/**
 * Store Module Recovery Migration Runner
 * 
 * Usage: php run_store_migration.php
 * 
 * This script:
 * 1. Creates store_manager_assignments table
 * 2. Adds missing columns to stores table (idempotent)
 * 3. Seeds store_manager_assignments from existing manager_id
 * 4. Creates store_health_scores table
 * 
 * Safe to run multiple times (uses IF NOT EXISTS / IF(col_not_exists))
 */

require_once __DIR__ . '/config/database.php';

echo "=== Store Module Recovery Migration ===\n";
echo "Database: " . DB_NAME . " @ " . DB_HOST . "\n\n";

$db = Database::getInstance();

$migrationFile = __DIR__ . '/sql/migration_store_command_recovery.sql';
if (!file_exists($migrationFile)) {
    echo "ERROR: Migration file not found: $migrationFile\n";
    exit(1);
}

$sql = file_get_contents($migrationFile);

// Split by semicolons (handle multi-statement)
$statements = array_filter(
    array_map('trim', explode(';', $sql)),
    fn($s) => $s !== '' && !str_starts_with($s, '--')
);

$success = 0;
$errors = 0;

foreach ($statements as $i => $stmt) {
    // Skip pure comments
    if (preg_match('/^\s*--/', $stmt)) continue;
    if (trim($stmt) === '') continue;
    
    // Remove trailing comments
    $stmt = preg_replace('/--[^"\']*$/m', '', $stmt);
    $stmt = trim($stmt);
    if ($stmt === '') continue;
    
    $preview = substr($stmt, 0, 80) . (strlen($stmt) > 80 ? '...' : '');
    echo "Statement " . ($i + 1) . ": " . $preview . "\n";
    
    try {
        $db->execute($stmt);
        echo "  ✓ OK\n";
        $success++;
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        // Duplicate table/column errors are expected and safe
        if (str_contains($msg, 'Duplicate') || str_contains($msg, 'duplicate') || str_contains($msg, 'already exists')) {
            echo "  ⚠ Already exists (skipped)\n";
            $success++;
        } else {
            echo "  ✗ ERROR: $msg\n";
            $errors++;
        }
    }
}

echo "\n=== Migration Complete ===\n";
echo "Success: $success\n";
echo "Errors:  $errors\n";

if ($errors === 0) {
    echo "\n✅ All migrations applied successfully!\n";
    echo "You can now access:\n";
    echo "  - Store Command Center: /admin/store-command\n";
    echo "  - Store Detail: /admin/stores/{id}\n";
    echo "  - Health API: /admin/store-command/{id}/stats\n";
} else {
    echo "\n❌ Some migrations failed. Check errors above.\n";
    exit(1);
}

// Optional: pull latest code if ?pull=1
if (isset($_GET['pull']) && $_GET['pull'] === '1') {
    echo "\n=== PULLING LATEST CODE ===\n";
    exec("cd {$root} && git fetch origin main 2>&1 && git reset --hard origin/main 2>&1", $pullOutput, $pullCode);
    echo implode("\n", $pullOutput) . "\n";
    echo $pullCode === 0 ? "\n✅ Git pull OK\n" : "\n❌ Git pull FAILED (code: $pullCode)\n";
}
