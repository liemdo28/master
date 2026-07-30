<?php
/**
 * verify_schema_api.php — Server-side schema verification endpoint.
 * Call via: curl https://dashboard.bakudanramen.com/verify_schema_api.php?token=SCHEMA_CHECK_2026
 * DELETE after use.
 */
$validToken = 'SCHEMA_CHECK_2026';
if (($_GET['token'] ?? '') !== $validToken) {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/config/database.php';

// Required tables (same as verify-schema.php)
$requiredTables = [
    'users','tasks','stores','bills','notifications','task_stores',
    'projects','sections','comments','attachments','activity_log',
    'releases','release_drafts','release_versions','release_approvals',
    'release_schedule','release_artifacts','task_notifications',
    'penalties','penalty_assessments','task_approval_events',
    'task_reviewer_notes','task_approval_notes','remember_tokens',
    'obligations','obligation_payments','obligation_tasks',
    'duplicate_task_flags','duplicate_bill_flags','deadline_extensions',
    'store_checklists','employees','shifts','incidents','vendors',
    'vendor_attachments','workflows','email_queue','email_logs',
    'api_tokens','rate_limits',
];

// Required columns
$requiredColumns = [
    'tasks' => [
        'visibility','submitted_at','recurring_root_id','approval_required',
        'reviewer_id','approver_id','submitted_by','checked_at','checked_by',
        'rejected_at','rejected_by','rejection_reason','final_done_at',
        'accepted_workflow_at','accepted_workflow_by','reviewer_result',
        'reviewer_result_at','approver_result','approver_result_at',
        'reviewer_due_date','reviewer_assigned_at','reviewed_at',
        'review_note','review_instructions','review_checklist',
        'required_evidence','required_files','acceptance_note',
        'private_by_user_id','task_category','bill_id','direct_store_id',
        'estimated_time','repeat_from_mode','repeat_end_type','repeat_end_date',
        'repeat_end_count','occurrence_index','reschedule_count',
    ],
    'notifications' => ['sender_id'],
    'task_notifications' => ['inbox_category'],
    'releases' => [
        'title','published_by','summary','change_log','bug_fixes',
        'known_issues','risk_notes','rollback_notes','rollback_contact',
        'release_window_notes',
    ],
];

$db = Database::getInstance();
$errors = []; $warnings = []; $passed = 0; $failed = 0;

// Check tables
foreach ($requiredTables as $table) {
    if ($db->tableExists($table)) {
        $passed++;
    } else {
        $failed++;
        $errors[] = "TABLE_MISSING: $table";
    }
}

// Check columns
foreach ($requiredColumns as $table => $columns) {
    if (!$db->tableExists($table)) {
        $warnings[] = "SKIPPED: " . count($columns) . " columns for $table (table missing)";
        continue;
    }
    foreach ($columns as $column) {
        if ($db->columnExists($table, $column)) {
            $passed++;
        } else {
            $failed++;
            $errors[] = "COLUMN_MISSING: $table.$column";
        }
    }
}

// Connection info
$mysqlVersion = $db->getConnection()->query("SELECT VERSION()")->fetchColumn();
$totalTables = $db->fetchColumn("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()");

echo json_encode([
    'status' => $failed === 0 ? 'PASS' : 'FAIL',
    'environment' => APP_ENV,
    'database' => DB_NAME,
    'host' => DB_HOST,
    'mysql_version' => $mysqlVersion,
    'total_tables_in_db' => (int)$totalTables,
    'passed' => $passed,
    'failed' => $failed,
    'warnings' => count($warnings),
    'errors' => $errors,
    'skipped' => $warnings,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
