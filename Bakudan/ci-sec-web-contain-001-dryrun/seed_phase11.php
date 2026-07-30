<?php
/**
 * Phase 11 — Run migrations + seed demo data
 * Usage: php seed_phase11.php
 */
require_once __DIR__ . '/config/database.php';

$db = Database::getInstance();
echo "Phase 11 Migration & Seed\n";
echo "=========================\n\n";

// Run migration
$migrationFile = __DIR__ . '/database/migrations/2026_05_29_phase11_modules.sql';
$seedFile = __DIR__ . '/database/migrations/2026_05_29_phase11_seed.sql';

echo "[1/2] Running schema migration...\n";
$sql = file_get_contents($migrationFile);
$statements = array_filter(array_map('trim', explode(';', $sql)));
$created = 0;
foreach ($statements as $stmt) {
    if (empty($stmt) || strpos($stmt, '--') === 0) continue;
    try {
        $db->getConnection()->exec($stmt);
        if (stripos($stmt, 'CREATE TABLE') !== false) {
            preg_match('/CREATE TABLE IF NOT EXISTS (\w+)/i', $stmt, $m);
            echo "  ✓ " . ($m[1] ?? 'table') . "\n";
            $created++;
        }
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'already exists') === false) {
            echo "  ✗ Error: " . $e->getMessage() . "\n";
        }
    }
}
echo "  → $created tables ensured\n\n";

echo "[2/2] Seeding demo data...\n";
$sql = file_get_contents($seedFile);
$statements = array_filter(array_map('trim', explode(';', $sql)));
$seeded = 0;
foreach ($statements as $stmt) {
    if (empty($stmt) || strpos($stmt, '--') === 0) continue;
    try {
        $affected = $db->getConnection()->exec($stmt);
        if ($affected > 0) $seeded += $affected;
    } catch (PDOException $e) {
        // Ignore duplicate key errors from INSERT IGNORE
        if (strpos($e->getMessage(), 'Duplicate') === false && strpos($e->getMessage(), '1062') === false) {
            echo "  ✗ " . substr($e->getMessage(), 0, 100) . "\n";
        }
    }
}
echo "  → $seeded rows inserted\n\n";

// Verify
echo "Verification:\n";
$tables = ['shifts', 'employees', 'training_modules', 'procurements', 'documents', 'calendar_events', 'incident_playbooks', 'opening_checklists', 'closing_checklists', 'store_health_scores'];
foreach ($tables as $t) {
    try {
        $count = $db->fetch("SELECT COUNT(*) as cnt FROM $t");
        echo "  $t: " . ($count['cnt'] ?? 0) . " rows\n";
    } catch (PDOException $e) {
        echo "  $t: TABLE MISSING\n";
    }
}

echo "\n✅ Phase 11 migration complete.\n";
