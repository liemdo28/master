<?php
/**
 * Fix: Add missing 'grade' column to store_health_scores
 * 
 * Production table is missing the 'grade' column that was added in the
 * schema definition but not in the existing production table.
 * 
 * Run via: curl https://dashboard.bakudanramen.com/fix_health_grade_column.php?key=health-grade-fix-2026
 * Or deploy and run: php fix_health_grade_column.php
 */
$SECRET = 'health-grade-fix-2026';

$isHttp = PHP_SAPI !== 'cli';
if ($isHttp) {
    $key = $_GET['key'] ?? '';
    if ($key !== $SECRET) {
        http_response_code(403);
        die('Forbidden');
    }
    header('Content-Type: text/plain; charset=utf-8');
}

require_once __DIR__ . '/config/database.php';

$db = Database::getInstance();

// Check if table exists
if (!$db->tableExists('store_health_scores')) {
    echo "ERROR: store_health_scores table does not exist.\n";
    exit(1);
}

// Check if grade column exists
if ($db->columnExists('store_health_scores', 'grade')) {
    echo "OK: grade column already exists in store_health_scores.\n";
    exit(0);
}

echo "FIXING: Adding 'grade' column to store_health_scores...\n";

// Add the grade column
try {
    $db->execute("
        ALTER TABLE store_health_scores
        ADD COLUMN grade CHAR(1) DEFAULT 'A' AFTER score
    ");
    echo "OK: grade column added.\n";
} catch (Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

// Backfill grade values for existing records using score thresholds
echo "Backfilling grade values for existing records...\n";
$backfill = $db->execute("
    UPDATE store_health_scores
    SET grade = CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        WHEN score >= 60 THEN 'D'
        ELSE 'F'
    END
    WHERE grade IS NULL OR grade = ''
");
echo "OK: Backfilled $backfill records.\n";

// Verify
$col = $db->columnExists('store_health_scores', 'grade');
echo "\nRESULT: grade column exists = " . ($col ? 'YES' : 'NO') . "\n";

if ($col) {
    $count = $db->fetch("SELECT COUNT(*) as cnt FROM store_health_scores");
    $withGrade = $db->fetch("SELECT COUNT(*) as cnt FROM store_health_scores WHERE grade IS NOT NULL AND grade != ''");
    echo "Total records: " . $count['cnt'] . "\n";
    echo "Records with grade: " . $withGrade['cnt'] . "\n";
    
    $samples = $db->fetchAll("SELECT id, store_id, score, grade, recorded_at FROM store_health_scores ORDER BY id DESC LIMIT 5");
    echo "\nSample records:\n";
    foreach ($samples as $s) {
        echo "  ID={$s['id']} store={$s['store_id']} score={$s['score']} grade={$s['grade']} at={$s['recorded_at']}\n";
    }
    echo "\nFIX COMPLETE.\n";
} else {
    echo "\nFIX FAILED - column not created.\n";
    exit(1);
}
