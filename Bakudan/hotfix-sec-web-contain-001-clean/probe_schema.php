<?php
/**
 * TEMP PROBE — verify which columns exist on the live preview DB.
 * Will be deleted after Phase 0 QA gate.
 */
$host = 'mysql-taskflow.bakudanramen.com';
$db   = 'preview_database';
$user = 'liemdo';
$pass = 'liem@dt2155';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    fwrite(STDERR, "DB connect failed: " . $e->getMessage() . "\n");
    exit(1);
}

$check = function(string $table, array $cols) use ($pdo) {
    $place = implode(',', array_fill(0, count($cols), '?'));
    $stmt = $pdo->prepare(
        "SELECT column_name FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name IN ($place)"
    );
    $stmt->execute(array_merge([$table], $cols));
    $found = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $missing = array_diff($cols, $found);
    echo str_pad($table, 12) . " | found: " . str_pad(implode(',', $found) ?: '(none)', 60)
       . " | missing: " . implode(',', $missing) . "\n";
    return $missing;
};

echo "=== Schema probe (preview_database) ===\n";
$tasksMissing = $check('tasks', [
    'visibility','private_by_user_id','repeat_type','repeat_config','repeat_from_mode',
    'repeat_end_type','repeat_end_date','repeat_end_count','estimated_time',
    'approver_id','creator_id','penalty_applied','penalty_amount','penalty_currency',
    'penalty_applied_at','accepted_at','parent_task_id','reschedule_count'
]);
$releasesMissing = $check('releases', [
    'published_by','created_by','title','summary','change_log','bug_fixes','known_issues',
    'risk_notes','rollback_notes','rollback_contact','release_window_notes',
    'confidence_letter','target_date'
]);
$sectionsMissing = $check('sections', ['id','project_id','name','position']);
$notificationsMissing = $check('notifications', ['sender_id','is_read','deep_link']);

echo "\n=== Summary ===\n";
echo "tasks missing: " . count($tasksMissing) . "\n";
echo "releases missing: " . count($releasesMissing) . "\n";
echo "sections missing: " . count($sectionsMissing) . "\n";
echo "notifications missing: " . count($notificationsMissing) . "\n";
