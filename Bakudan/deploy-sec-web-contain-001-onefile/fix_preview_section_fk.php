<?php
/**
 * P0 Preview DB Repair — section_id FK Safety
 * Target: preview_database on mysql-taskflow.bakudanramen.com
 * 
 * Fixes:
 * 1. Orphaned tasks.section_id → NULL (FK violation)
 * 2. Ensures every project has a default section
 * 3. Verifies sections table structure
 *
 * Run: php fix_preview_section_fk.php
 */

require __DIR__ . '/database.php';

$db = Database::getInstance()->getConnection();

// Verify we are hitting the PREVIEW database
$currentDb = $db->query('SELECT DATABASE()')->fetchColumn();
if ($currentDb !== 'preview_database') {
    echo "❌ FATAL: Wrong database '{$currentDb}'. This script must only run on preview_database.\n";
    exit(1);
}
echo "=== P0 Preview DB Repair: section_id FK Safety ===\n";
echo "Database: {$currentDb}\n";
echo "Started: " . date('Y-m-d H:i:s') . "\n\n";

// ── STEP 1: Inspect orphaned section_ids ──────────────────────────────────────
echo "── [1/4] Inspecting orphaned tasks.section_id ──────────────────────────\n";
$orphansBefore = $db->query("
    SELECT t.id, t.title, t.section_id, t.project_id
    FROM tasks t
    LEFT JOIN sections s ON s.id = t.section_id
    WHERE t.section_id IS NOT NULL AND s.id IS NULL
")->fetchAll(PDO::FETCH_ASSOC);
echo "Found " . count($orphansBefore) . " orphaned section_id references:\n";
foreach ($orphansBefore as $o) {
    echo "  Task #{$o['id']}: section_id={$o['section_id']}, project_id={$o['project_id']}\n";
}
if (empty($orphansBefore)) {
    echo "  ✓ No orphaned references — clean state\n";
}
echo "\n";

// ── STEP 2: Repair orphaned section_ids ──────────────────────────────────────
echo "── [2/4] Repairing orphaned section_ids → NULL ─────────────────────────\n";
$repairStmt = $db->prepare("
    UPDATE tasks t
    LEFT JOIN sections s ON s.id = t.section_id
    SET t.section_id = NULL
    WHERE t.section_id IS NOT NULL AND s.id IS NULL
");
$repairStmt->execute();
$affectedOrphans = $repairStmt->rowCount();
echo "  Affected rows: {$affectedOrphans}\n";
echo "  ✓ Orphaned section_ids set to NULL\n\n";

// Verify repair
$orphansAfter = $db->query("
    SELECT COUNT(*) as cnt
    FROM tasks t
    LEFT JOIN sections s ON s.id = t.section_id
    WHERE t.section_id IS NOT NULL AND s.id IS NULL
")->fetchColumn();
echo "  Verification (remaining orphans): {$orphansAfter}\n";
if ($orphansAfter == 0) {
    echo "  ✓ All orphaned references cleared\n";
} else {
    echo "  ⚠ WARNING: {$orphansAfter} orphans remain\n";
}
echo "\n";

// ── STEP 3: Ensure default sections for projects ──────────────────────────────
echo "── [3/4] Ensuring default 'To Do' sections for all projects ────────────\n";
$projectsWithoutSections = $db->query("
    SELECT p.id, p.name
    FROM projects p
    WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.project_id = p.id)
")->fetchAll(PDO::FETCH_ASSOC);
echo "Projects without sections: " . count($projectsWithoutSections) . "\n";
foreach ($projectsWithoutSections as $p) {
    echo "  Creating 'To Do' for project #{$p['id']}: {$p['name']}\n";
    $db->prepare("INSERT INTO sections (project_id, name, position) VALUES (?, 'To Do', 0)")
       ->execute([$p['id']]);
    echo "  ✓ Created section id={$db->lastInsertId()}\n";
}
if (empty($projectsWithoutSections)) {
    echo "  ✓ All projects have at least one section\n";
}
echo "\n";

// ── STEP 4: Verify sections table structure ───────────────────────────────────
echo "── [4/4] Verifying sections table structure ─────────────────────────────\n";
$requiredCols = ['id', 'project_id', 'name', 'position'];
$actualCols = $db->query("SHOW COLUMNS FROM sections")->fetchAll(PDO::FETCH_COLUMN, 1);
echo "Columns: " . implode(', ', $actualCols) . "\n";
$missing = array_diff($requiredCols, $actualCols);
if ($missing) {
    echo "  ❌ Missing columns: " . implode(', ', $missing) . "\n";
} else {
    echo "  ✓ All required columns present\n";
}

// Count sections
$sectionCount = $db->query("SELECT COUNT(*) FROM sections")->fetchColumn();
echo "Total sections: {$sectionCount}\n\n";

// ── FINAL REPORT ─────────────────────────────────────────────────────────────
echo "── Summary ──────────────────────────────────────────────────────────────\n";
$finalOrphans = $db->query("
    SELECT COUNT(*) as cnt FROM tasks t
    LEFT JOIN sections s ON s.id = t.section_id
    WHERE t.section_id IS NOT NULL AND s.id IS NULL
")->fetchColumn();

$finalSections = $db->query("SELECT COUNT(*) FROM sections")->fetchColumn();
$projectsNeedingDefault = $db->query("
    SELECT COUNT(*) FROM projects p
    WHERE NOT EXISTS (SELECT 1 FROM sections s WHERE s.project_id = p.id)
")->fetchColumn();

echo "Orphaned section_ids remaining: {$finalOrphans}\n";
echo "Total sections: {$finalSections}\n";
echo "Projects still missing sections: {$projectsNeedingDefault}\n";
echo "Finished: " . date('Y-m-d H:i:s') . "\n";

if ($finalOrphans == 0 && $projectsNeedingDefault == 0) {
    echo "\n✅ P0 REPAIR COMPLETE — No FK violations, all sections valid.\n";
    exit(0);
} else {
    echo "\n⚠ REVIEW REQUIRED — Some issues remain.\n";
    exit(1);
}
