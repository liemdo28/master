<?php
/**
 * Migration: Add preferred_locale column to users table.
 * Allowed values: en-US, es-US, vi-VN
 * Default: en-US
 *
 * Run: php migrate_preferred_locale.php
 */
$root = __DIR__;
require_once $root . '/config/database.php';

echo "=== Migration: preferred_locale ===\n\n";

try {
    $db = Database::getInstance();
    $pdo = $db->getConnection();

    // 1. Check if column already exists
    $colExists = $db->columnExists('users', 'preferred_locale');
    if ($colExists) {
        echo "✓ Column 'preferred_locale' already exists in users table.\n";
    } else {
        echo "Adding column 'preferred_locale' to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN preferred_locale VARCHAR(10) NOT NULL DEFAULT 'en-US' AFTER role");
        echo "✓ Column 'preferred_locale' added successfully.\n";
    }

    // 2. Verify column
    $row = $pdo->query("SELECT COLUMN_NAME, COLUMN_DEFAULT, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_locale'")->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        echo "\nVerification:\n";
        echo "  Column: {$row['COLUMN_NAME']}\n";
        echo "  Type: {$row['DATA_TYPE']}({$row['CHARACTER_MAXIMUM_LENGTH']})\n";
        echo "  Default: {$row['COLUMN_DEFAULT']}\n";
    }

    // 3. Show current users with their locale
    $users = $pdo->query("SELECT id, name, role, preferred_locale FROM users ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);
    echo "\nCurrent users (" . count($users) . "):\n";
    foreach ($users as $u) {
        echo "  [{$u['id']}] {$u['name']} ({$u['role']}) — locale: {$u['preferred_locale']}\n";
    }

    echo "\n✓ Migration complete.\n";
} catch (\Throwable $e) {
    echo "\n✗ Migration FAILED: " . $e->getMessage() . "\n";
    exit(1);
}
