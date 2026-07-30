<?php
/**
 * Release Governance Schema Audit
 *
 * Usage:
 *   APP_ENV_FILE=/path/to/.env.preview php scripts/release-governance-schema-audit.php
 */

require_once __DIR__ . '/../config/database.php';

$db = Database::getInstance();
$tables = [
    'releases',
    'release_reviews',
    'release_audit_log',
    'release_drafts',
    'release_versions',
    'release_approvals',
    'release_schedule',
    'release_archive',
    'rollback_points',
];

$matrix = [];
$missing = [];
foreach ($tables as $table) {
    $exists = $db->tableExists($table);
    $matrix[] = [
        'table' => $table,
        'exists' => $exists,
        'status' => $exists ? 'PASS' : 'FAIL',
    ];
    if (!$exists) $missing[] = $table;
}

echo json_encode([
    'status' => empty($missing) ? 'PASS' : 'FAIL',
    'database' => DB_NAME,
    'checked_at' => date('c'),
    'missing_tables' => $missing,
    'matrix' => $matrix,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
