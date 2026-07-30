<?php
/**
 * verify-schema.php — Deployment Gate Script
 *
 * Checks that ALL required tables and columns exist in the database.
 * Exits with code 1 (FAIL) if any check fails — blocks deployment.
 * Exits with code 0 (PASS) if all checks pass — allows deployment.
 *
 * Usage:
 *   php scripts/verify-schema.php              # Check current DB
 *   php scripts/verify-schema.php --verbose    # Show all checks
 *   php scripts/verify-schema.php --json       # JSON output for CI
 *   php scripts/verify-schema.php --fix        # Print missing migration files
 */

require_once __DIR__ . '/../config/database.php';

$verbose = in_array('--verbose', $argv);
$json    = in_array('--json', $argv);
$fix     = in_array('--fix', $argv);

// ─── REQUIRED TABLES ───────────────────────────────────────────────
// These tables MUST exist or the application cannot function.

$requiredTables = [
    // Tier 1 — CRITICAL
    'users'            => 'Core user accounts',
    'tasks'            => 'Core task management',
    'stores'           => 'Store locations',
    'bills'            => 'Financial bills',
    'notifications'    => 'User notifications',
    'task_stores'      => 'Task-to-store assignments',

    // Tier 2 — HIGH
    'projects'         => 'Project management',
    'sections'         => 'Task grouping',
    'comments'         => 'Task comments',
    'attachments'      => 'File uploads',
    'activity_log'     => 'Audit trail',
    'releases'         => 'Release management',
    'release_drafts'   => 'Release draft workflow',
    'release_versions' => 'Release version tracking',
    'release_approvals'=> 'Release approval records',
    'release_schedule' => 'Release scheduling',
    'release_artifacts'=> 'Release artifacts',
    'task_notifications'    => 'Inbox notification items',
    'penalties'              => 'Penalty configuration',
    'penalty_assessments'    => 'Penalty assessment records',
    'task_approval_events'   => 'Approval audit trail',
    'task_reviewer_notes'    => 'Reviewer workspace notes',
    'task_approval_notes'    => 'Approval notes',
    'remember_tokens'        => 'Remember-me tokens',
    'obligations'            => 'Financial obligations',
    'obligation_payments'    => 'Payment records',
    'obligation_tasks'       => 'Obligation task links',
    'duplicate_task_flags'   => 'Duplicate task detection',
    'duplicate_bill_flags'   => 'Duplicate bill detection',
    'deadline_extensions'    => 'Deadline extension requests',

    // Tier 3 — MEDIUM
    'store_checklists'       => 'Daily store checklists',
    'employees'              => 'Employee records',
    'shifts'                 => 'Shift scheduling',
    'incidents'              => 'Incident tracking',
    'vendors'                => 'Vendor management',
    'vendor_attachments'     => 'Vendor file attachments',
    'workflows'              => 'Automation workflows',
    'email_queue'            => 'Email sending queue',
    'email_logs'             => 'Email delivery log',
    'api_tokens'             => 'Mobile API tokens',
    'rate_limits'            => 'API rate limiting',
];

// ─── REQUIRED COLUMNS ──────────────────────────────────────────────
// Format: 'table_name' => ['column_name' => 'required_for']

$requiredColumns = [
    'tasks' => [
        'visibility'        => 'OverdueResolverService visibility filtering',
        'submitted_at'      => 'Task approval workflow submission timestamp',
        'recurring_root_id' => 'Recurring task identification',
        'approval_required' => 'Approval workflow toggle',
        'reviewer_id'       => 'Reviewer assignment',
        'approver_id'       => 'Approver assignment',
        'submitted_by'      => 'Task submission tracking',
        'checked_at'        => 'Task checking timestamp',
        'checked_by'        => 'Task checker tracking',
        'rejected_at'       => 'Rejection timestamp',
        'rejected_by'       => 'Rejection tracking',
        'rejection_reason'  => 'Rejection reason text',
        'final_done_at'     => 'Final completion timestamp',
        'accepted_workflow_at' => 'Workflow acceptance timestamp',
        'accepted_workflow_by' => 'Workflow acceptance tracking',
        'reviewer_result'       => 'Reviewer decision',
        'reviewer_result_at'    => 'Reviewer decision timestamp',
        'approver_result'       => 'Approver decision',
        'approver_result_at'    => 'Approver decision timestamp',
        'reviewer_due_date'     => 'Reviewer deadline',
        'reviewer_assigned_at'  => 'Reviewer assignment timestamp',
        'reviewed_at'           => 'Review completion timestamp',
        'review_note'           => 'Reviewer notes',
        'review_instructions'   => 'Reviewer instructions',
        'review_checklist'      => 'Reviewer checklist',
        'required_evidence'     => 'Required evidence for submission',
        'required_files'        => 'Required files for submission',
        'acceptance_note'       => 'Acceptance note',
        'private_by_user_id'    => 'Private task ownership',
        'task_category'         => 'Task classification',
        'bill_id'               => 'Linked bill reference',
        'direct_store_id'       => 'Direct store assignment',
        'estimated_time'        => 'Estimated time for task',
        'repeat_from_mode'      => 'Recurrence start mode',
        'repeat_end_type'       => 'Recurrence end type',
        'repeat_end_date'       => 'Recurrence end date',
        'repeat_end_count'      => 'Recurrence end count',
        'occurrence_index'      => 'Recurrence occurrence number',
        'reschedule_count'      => 'Reschedule tracking',
    ],

    'notifications' => [
        'sender_id' => 'Notification sender identification',
    ],

    'task_notifications' => [
        'inbox_category' => 'Inbox categorization',
    ],

    'releases' => [
        'title'         => 'Release title display',
        'published_by'  => 'Release publisher tracking',
        'summary'       => 'Release summary',
        'change_log'    => 'Release change log',
        'bug_fixes'     => 'Bug fix list',
        'known_issues'  => 'Known issues list',
        'risk_notes'    => 'Risk assessment notes',
        'rollback_notes'=> 'Rollback instructions',
        'rollback_contact' => 'Rollback contact',
        'release_window_notes' => 'Release window notes',
    ],
];

// ─── VERIFY ────────────────────────────────────────────────────────

$db = Database::getInstance();
$errors   = [];
$warnings = [];
$passed   = 0;
$failed   = 0;

// Check tables
foreach ($requiredTables as $table => $desc) {
    $exists = $db->tableExists($table);
    if ($exists) {
        $passed++;
        if ($verbose) {
            echo "✅ {$table} — {$desc}" . PHP_EOL;
        }
    } else {
        $failed++;
        $errors[] = "TABLE_MISSING: {$table} — {$desc}";
        echo "❌ MISSING TABLE: {$table} — {$desc}" . PHP_EOL;
    }
}

// Check columns
foreach ($requiredColumns as $table => $columns) {
    if (!$db->tableExists($table)) {
        // Table missing — column checks are redundant
        $skipped = count($columns);
        $warnings[] = "SKIPPED: {$skipped} column checks for {$table} (table missing)";
        if ($verbose) {
            echo "⚠️  SKIPPED column checks for {$table} (table missing)" . PHP_EOL;
        }
        continue;
    }

    foreach ($columns as $column => $reason) {
        $exists = $db->columnExists($table, $column);
        if ($exists) {
            $passed++;
            if ($verbose) {
                echo "✅ {$table}.{$column} — {$reason}" . PHP_EOL;
            }
        } else {
            $failed++;
            $errors[] = "COLUMN_MISSING: {$table}.{$column} — {$reason}";
            echo "❌ MISSING COLUMN: {$table}.{$column} — {$reason}" . PHP_EOL;
        }
    }
}

// ─── OUTPUT ────────────────────────────────────────────────────────

echo PHP_EOL;
echo str_repeat('=', 60) . PHP_EOL;
echo "SCHEMA VERIFICATION RESULTS" . PHP_EOL;
echo str_repeat('=', 60) . PHP_EOL;
echo "Passed:  {$passed}" . PHP_EOL;
echo "Failed:  {$failed}" . PHP_EOL;
echo "Warnings: " . count($warnings) . PHP_EOL;
echo str_repeat('=', 60) . PHP_EOL;

if ($json) {
    echo json_encode([
        'status'   => $failed === 0 ? 'PASS' : 'FAIL',
        'passed'   => $passed,
        'failed'   => $failed,
        'warnings' => count($warnings),
        'errors'   => $errors,
        'details'  => $warnings,
    ], JSON_PRETTY_PRINT) . PHP_EOL;
}

if ($fix && count($errors) > 0) {
    echo PHP_EOL;
    echo "MIGRATION FILES TO RUN:" . PHP_EOL;
    echo str_repeat('-', 40) . PHP_EOL;
    $tablesMissing = [];
    foreach ($errors as $e) {
        if (preg_match('/TABLE_MISSING: (\w+)/', $e, $m)) {
            $tablesMissing[] = $m[1];
        }
    }
    if (in_array('stores', $tablesMissing) || in_array('bills', $tablesMissing) || in_array('task_stores', $tablesMissing)) {
        echo "  php migrate.php  (runs all migrations)" . PHP_EOL;
    }
    echo PHP_EOL;
    echo "Run: php migrate.php" . PHP_EOL;
}

// ─── EXIT CODE ─────────────────────────────────────────────────────

if ($failed > 0) {
    echo PHP_EOL;
    echo "❌ DEPLOYMENT GATE: FAIL — {$failed} check(s) failed" . PHP_EOL;
    echo "   Deploy BLOCKED until all checks pass." . PHP_EOL;
    exit(1);
} else {
    echo PHP_EOL;
    echo "✅ DEPLOYMENT GATE: PASS — all {$passed} checks passed" . PHP_EOL;
    exit(0);
}
