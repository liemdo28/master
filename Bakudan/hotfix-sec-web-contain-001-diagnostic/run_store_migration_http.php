<?php
/**
 * Store Migration — HTTP Runner
 * 
 * Access via: GET /run_store_migration_http.php
 * 
 * SECURITY: Only accessible when logged in as admin.
 * Safe to run multiple times (idempotent).
 */

// Bootstrap the app
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/models/User.php';
require_once __DIR__ . '/helpers/helpers.php';
require_once __DIR__ . '/models/StoreCommand.php';

session_start();

// Only admin
if (!function_exists('isLoggedIn') || !isLoggedIn() || !function_exists('isAdmin') || !isAdmin()) {
    http_response_code(403);
    echo "Admin access required. <a href='/login'>Login</a>";
    exit;
}

echo "<h2>Store Module Recovery Migration</h2><pre>";
echo "Database: " . DB_NAME . " @ " . DB_HOST . "\n\n";

$db = Database::getInstance();

// Statement 1: Create store_manager_assignments
$statements = [
    "CREATE TABLE IF NOT EXISTS store_manager_assignments (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        store_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        role ENUM('primary_manager','assistant_manager','viewer') NOT NULL DEFAULT 'primary_manager',
        is_primary TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_store_user (store_id, user_id),
        KEY idx_sma_store (store_id),
        KEY idx_sma_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",
];

// Idempotent column additions
$columnsToAdd = [
    ['stores', 'store_code', "ALTER TABLE stores ADD COLUMN store_code VARCHAR(20) DEFAULT NULL AFTER name"],
    ['stores', 'store_type', "ALTER TABLE stores ADD COLUMN store_type ENUM('corporate','franchise') NOT NULL DEFAULT 'corporate' AFTER name"],
    ['stores', 'phone', "ALTER TABLE stores ADD COLUMN phone VARCHAR(30) DEFAULT NULL AFTER address"],
    ['stores', 'email', "ALTER TABLE stores ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER phone"],
    ['stores', 'region', "ALTER TABLE stores ADD COLUMN region VARCHAR(100) DEFAULT NULL AFTER store_type"],
    ['stores', 'operating_hours', "ALTER TABLE stores ADD COLUMN operating_hours VARCHAR(255) DEFAULT NULL AFTER region"],
    ['stores', 'manager_id', "ALTER TABLE stores ADD COLUMN manager_id INT UNSIGNED DEFAULT NULL AFTER operating_hours"],
    ['stores', 'assistant_manager_id', "ALTER TABLE stores ADD COLUMN assistant_manager_id INT UNSIGNED DEFAULT NULL AFTER manager_id"],
    ['stores', 'opened_at', "ALTER TABLE stores ADD COLUMN opened_at DATE DEFAULT NULL AFTER assistant_manager_id"],
    ['stores', 'status', "ALTER TABLE stores ADD COLUMN status ENUM('active','inactive','opening_soon','closed') NOT NULL DEFAULT 'active' AFTER is_active"],
];

// Create store_health_scores
$statements[] = "CREATE TABLE IF NOT EXISTS store_health_scores (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    score DECIMAL(5,2) DEFAULT 100.00,
    grade CHAR(1) DEFAULT 'A',
    metrics JSON DEFAULT NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_health_store (store_id),
    INDEX idx_health_date (recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

$success = 0;
$errors = 0;

// Run CREATE TABLE statements
foreach ($statements as $i => $sql) {
    $preview = substr(trim($sql), 0, 80) . '...';
    echo "Statement " . ($i + 1) . ": $preview\n";
    try {
        $db->execute($sql);
        echo "  ✓ OK\n";
        $success++;
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (str_contains($msg, 'Duplicate') || str_contains($msg, 'already exists')) {
            echo "  ⚠ Already exists (skipped)\n";
            $success++;
        } else {
            echo "  ✗ ERROR: $msg\n";
            $errors++;
        }
    }
}

// Run ALTER TABLE columns
foreach ($columnsToAdd as [$table, $col, $sql]) {
    if ($db->columnExists($table, $col)) {
        echo "Column $table.$col — already exists (skipped)\n";
        $success++;
        continue;
    }
    echo "Adding $table.$col...\n";
    try {
        $db->execute($sql);
        echo "  ✓ OK\n";
        $success++;
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        if (str_contains($msg, 'Duplicate') || str_contains($msg, 'already exists') || str_contains($msg, 'Duplicate column')) {
            echo "  ⚠ Already exists (skipped)\n";
            $success++;
        } else {
            echo "  ✗ ERROR: $msg\n";
            $errors++;
        }
    }
}

// Seed store_manager_assignments from existing manager_id
echo "\nSeeding store_manager_assignments from stores.manager_id...\n";
try {
    $exists = $db->columnExists('stores', 'manager_id');
    if ($exists) {
        $db->execute("INSERT IGNORE INTO store_manager_assignments (store_id, user_id, role, is_primary, created_at)
            SELECT s.id, s.manager_id, 'primary_manager', 1, NOW()
            FROM stores s
            WHERE s.manager_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM store_manager_assignments sma WHERE sma.store_id = s.id AND sma.user_id = s.manager_id)");
        echo "  ✓ Seeded\n";
        $success++;
    } else {
        echo "  ⚠ stores.manager_id not yet added (skipped)\n";
    }
} catch (PDOException $e) {
    echo "  ✗ ERROR: " . $e->getMessage() . "\n";
    $errors++;
}

echo "\n=== Migration Complete ===\n";
echo "Success: $success\n";
echo "Errors:  $errors\n";

if ($errors === 0) {
    echo "\n✅ All migrations applied!\n";
    echo "\nNext: Go to <a href='/admin/store-command'>Store Command Center</a>\n";
} else {
    echo "\n❌ Some migrations failed.\n";
}

echo "</pre>";
