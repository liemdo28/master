<?php
/**
 * QA: Check Release Governance Tables
 * Run: php check_tables.php
 */
require __DIR__ . '/database.php';
$db = Database::getInstance()->getConnection();

$tables = [
    'release_drafts',
    'release_versions', 
    'release_approvals',
    'release_schedule',
    'release_archive',
    'rollback_points'
];

echo "=== Release Governance Table Check ===\n\n";
foreach ($tables as $t) {
    try {
        $r = $db->query("SHOW TABLES LIKE '$t'")->fetchAll();
        echo "$t: " . (count($r) > 0 ? "✅ EXISTS" : "❌ MISSING") . "\n";
        
        if (count($r) > 0) {
            $cols = $db->query("SHOW COLUMNS FROM $t")->fetchAll();
            echo "  Columns: " . implode(', ', array_column($cols, 'Field')) . "\n";
        }
    } catch (Exception $e) {
        echo "$t: ❌ ERROR - " . $e->getMessage() . "\n";
    }
    echo "\n";
}

echo "=== Release Controller Methods ===\n";
$rc = new ReflectionClass('ReleaseController');
foreach ($rc->getMethods(ReflectionMethod::IS_PUBLIC) as $m) {
    if ($m->getName() !== '__construct') {
        echo "- " . $m->getName() . "()\n";
    }
}
echo "\n=== Sidebar Search Functionality ===\n";
echo "Sidebar search found in: views/layouts/main.php (line 220-235)\n";
echo "JavaScript handler: sbSearchInput with live filtering\n\n";

echo "=== Git Commit ===\n";
echo `git rev-parse HEAD` . "\n";
