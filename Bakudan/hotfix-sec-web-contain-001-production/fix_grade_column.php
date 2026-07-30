<?php
/**
 * HOTFIX: Add missing 'grade' column to store_health_scores
 * 
 * Production table was created without the 'grade' column.
 * This causes all health score operations to fail with:
 *   SQLSTATE[42S22]: Column not found: 1054 Unknown column 'grade' in 'field list'
 * 
 * Run: curl https://dashboard.bakudanramen.com/fix_grade_column.php?key=grade-hotfix-2026
 */
header('Content-Type: text/plain; charset=utf-8');

$key = $_GET['key'] ?? '';
if ($key !== 'grade-hotfix-2026') {
    http_response_code(403);
    die('Forbidden');
}

require_once __DIR__ . '/config/database.php';

$db = Database::getInstance();

echo "=== GRADE COLUMN HOTFIX ===\n\n";

// Check if table exists
$exists = $db->fetch(
    "SELECT COUNT(*) as cnt FROM information_schema.tables 
     WHERE table_schema = ? AND table_name = 'store_health_scores'",
    [DB_NAME]
);
echo "Table exists: " . ($exists['cnt'] > 0 ? 'YES' : 'NO') . "\n";

if (!$exists['cnt']) {
    echo "ERROR: store_health_scores table does not exist.\n";
    exit(1);
}

// Check if grade column exists
$col = $db->fetch(
    "SELECT COUNT(*) as cnt FROM information_schema.columns 
     WHERE table_schema = ? AND table_name = 'store_health_scores' AND column_name = 'grade'",
    [DB_NAME]
);
echo "Grade column exists: " . ($col['cnt'] > 0 ? 'YES' : 'NO') . "\n";

if ($col['cnt']) {
    echo "\nOK: grade column already present. No fix needed.\n";
    exit(0);
}

// Add the grade column
echo "\nFIXING: ALTER TABLE store_health_scores ADD COLUMN grade CHAR(1) DEFAULT 'A' AFTER score\n";
try {
    $db->execute("ALTER TABLE store_health_scores ADD COLUMN grade CHAR(1) DEFAULT 'A' AFTER score");
    echo "SUCCESS: grade column added.\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

// Backfill
echo "\nBACKFILL: Setting grade values for existing records...\n";
$count = $db->execute("
    UPDATE store_health_scores SET grade = CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        WHEN score >= 60 THEN 'D'
        ELSE 'F'
    END
    WHERE grade IS NULL OR grade = ''
");
echo "Backfilled $count records.\n";

// Verify
$col2 = $db->fetch(
    "SELECT COUNT(*) as cnt FROM information_schema.columns 
     WHERE table_schema = ? AND table_name = 'store_health_scores' AND column_name = 'grade'",
    [DB_NAME]
);
echo "\nVERIFY: grade column exists = " . ($col2['cnt'] > 0 ? 'YES' : 'NO') . "\n";

// Show samples
$samples = $db->fetchAll("SELECT id, store_id, score, grade, recorded_at FROM store_health_scores ORDER BY id DESC LIMIT 5");
echo "\nSample records:\n";
foreach ($samples as $s) {
    echo "  ID={$s['id']} store={$s['store_id']} score={$s['score']} grade={$s['grade']} at={$s['recorded_at']}\n";
}

echo "\n=== HOTFIX COMPLETE ===\n";
