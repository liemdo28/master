<?php
/**
 * Standalone schema verification — no project dependencies, direct PDO.
 * Connects to Production (taskflow_db) by default.
 * Use: php scripts/schema_check_standalone.php --verbose --json
 * Use: php scripts/schema_check_standalone.php --env=preview --verbose --json
 */

// Parse CLI args
$args = $argv ?? [];
$verbose = in_array('--verbose', $args);
$json    = in_array('--json', $args);

$isPreview = false;
foreach ($args as $a) {
    if ($a === '--env=preview') $isPreview = true;
}

// Load .env files
$envFiles = $isPreview
    ? [__DIR__ . '/../.env.preview', __DIR__ . '/../.env']
    : [__DIR__ . '/../.env'];
foreach ($envFiles as $ef) {
    if (!file_exists($ef)) continue;
    $lines = file($ef, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) continue;
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        if (!array_key_exists($key, $_ENV)) {
            $_ENV[$key] = $value;
            putenv("$key=$value");
        }
    }
    break;
}

$host = $_ENV['DB_HOST'] ?? '';
$port = (int)($_ENV['DB_PORT'] ?? 3306);
$db   = $_ENV['DB_NAME'] ?? '';
$user = $_ENV['DB_USER'] ?? '';
$pass = $_ENV['DB_PASS'] ?? '';

if (!$host || !$db || !$user) {
    fwrite(STDERR, "FATAL: Missing DB credentials. Host=$host DB=$db User=$user\n");
    fwrite(STDERR, "Ensure .env or .env.preview exists in project root.\n");
    exit(1);
}

echo "Connecting to $host:$port / $db as $user ... ";
try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "OK\n";
} catch (PDOException $e) {
    echo "FAILED\n";
    fwrite(STDERR, "DB ERROR: " . $e->getMessage() . "\n");
    exit(1);
}

// ─── REQUIRED TABLES ───
$requiredTables = [
    'users' => 'Core user accounts', 'tasks' => 'Core task management',
    'stores' => 'Store locations', 'bills' => 'Financial bills',
    'notifications' => 'User notifications', 'task_stores' => 'Task-to-store assignments',
    'projects' => 'Project management', 'sections' => 'Task grouping',
    'comments' => 'Task comments', 'attachments' => 'File uploads',
    'activity_log' => 'Audit trail', 'releases' => 'Release management',
    'release_drafts' => 'Release draft workflow', 'release_versions' => 'Release version tracking',
    'release_approvals' => 'Release approval records', 'release_schedule' => 'Release scheduling',
    'release_artifacts' => 'Release artifacts', 'task_notifications' => 'Inbox notification items',
    'penalties' => 'Penalty configuration', 'penalty_assessments' => 'Penalty assessment records',
    'task_approval_events' => 'Approval audit trail', 'task_reviewer_notes' => 'Reviewer workspace notes',
    'task_approval_notes' => 'Approval notes', 'remember_tokens' => 'Remember-me tokens',
    'obligations' => 'Financial obligations', 'obligation_payments' => 'Payment records',
    'obligation_tasks' => 'Obligation task links', 'duplicate_task_flags' => 'Duplicate task detection',
    'duplicate_bill_flags' => 'Duplicate bill detection', 'deadline_extensions' => 'Deadline extension requests',
    'store_checklists' => 'Daily store checklists', 'employees' => 'Employee records',
    'shifts' => 'Shift scheduling', 'incidents' => 'Incident tracking',
    'vendors' => 'Vendor management', 'vendor_attachments' => 'Vendor file attachments',
    'workflows' => 'Automation workflows', 'email_queue' => 'Email sending queue',
    'email_logs' => 'Email delivery log', 'api_tokens' => 'Mobile API tokens',
    'rate_limits' => 'API rate limiting',
];

// ─── REQUIRED COLUMNS ───
$requiredColumns = [
    'tasks' => [
        'visibility' => 'OverdueResolverService visibility filtering',
        'submitted_at' => 'Task approval workflow submission timestamp',
        'recurring_root_id' => 'Recurring task identification',
        'approval_required' => 'Approval workflow toggle',
        'reviewer_id' => 'Reviewer assignment', 'approver_id' => 'Approver assignment',
        'submitted_by' => 'Task submission tracking', 'checked_at' => 'Task checking timestamp',
        'checked_by' => 'Task checker tracking', 'rejected_at' => 'Rejection timestamp',
        'rejected_by' => 'Rejection tracking', 'rejection_reason' => 'Rejection reason text',
        'final_done_at' => 'Final completion timestamp',
        'accepted_workflow_at' => 'Workflow acceptance timestamp',
        'accepted_workflow_by' => 'Workflow acceptance tracking',
        'reviewer_result' => 'Reviewer decision', 'reviewer_result_at' => 'Reviewer decision timestamp',
        'approver_result' => 'Approver decision', 'approver_result_at' => 'Approver decision timestamp',
        'reviewer_due_date' => 'Reviewer deadline',
        'reviewer_assigned_at' => 'Reviewer assignment timestamp',
        'reviewed_at' => 'Review completion timestamp', 'review_note' => 'Reviewer notes',
        'review_instructions' => 'Reviewer instructions', 'review_checklist' => 'Reviewer checklist',
        'required_evidence' => 'Required evidence for submission',
        'required_files' => 'Required files for submission',
        'acceptance_note' => 'Acceptance note', 'private_by_user_id' => 'Private task ownership',
        'task_category' => 'Task classification', 'bill_id' => 'Linked bill reference',
        'direct_store_id' => 'Direct store assignment', 'estimated_time' => 'Estimated time for task',
        'repeat_from_mode' => 'Recurrence start mode', 'repeat_end_type' => 'Recurrence end type',
        'repeat_end_date' => 'Recurrence end date', 'repeat_end_count' => 'Recurrence end count',
        'occurrence_index' => 'Recurrence occurrence number',
        'reschedule_count' => 'Reschedule tracking',
    ],
    'notifications' => ['sender_id' => 'Notification sender identification'],
    'task_notifications' => ['inbox_category' => 'Inbox categorization'],
    'releases' => [
        'title' => 'Release title display', 'published_by' => 'Release publisher tracking',
        'summary' => 'Release summary', 'change_log' => 'Release change log',
        'bug_fixes' => 'Bug fix list', 'known_issues' => 'Known issues list',
        'risk_notes' => 'Risk assessment notes', 'rollback_notes' => 'Rollback instructions',
        'rollback_contact' => 'Rollback contact', 'release_window_notes' => 'Release window notes',
    ],
];

// ─── VERIFY ───
function tableExists(PDO $pdo, string $table): bool {
    $stmt = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
    $stmt->execute([$table]);
    return (bool) $stmt->fetch();
}

function columnExists(PDO $pdo, string $table, string $column): bool {
    $stmt = $pdo->prepare("SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1");
    $stmt->execute([$table, $column]);
    return (bool) $stmt->fetch();
}

$errors = []; $warnings = []; $passed = 0; $failed = 0;

foreach ($requiredTables as $table => $desc) {
    $exists = tableExists($pdo, $table);
    if ($exists) {
        $passed++;
        if ($verbose) echo "✅ {$table} — {$desc}\n";
    } else {
        $failed++;
        $errors[] = "TABLE_MISSING: $table — $desc";
        echo "❌ MISSING TABLE: {$table} — {$desc}\n";
    }
}

foreach ($requiredColumns as $table => $columns) {
    if (!tableExists($pdo, $table)) {
        $skipped = count($columns);
        $warnings[] = "SKIPPED: $skipped column checks for $table (table missing)";
        if ($verbose) echo "⚠️  SKIPPED column checks for {$table} (table missing)\n";
        continue;
    }
    foreach ($columns as $column => $reason) {
        $exists = columnExists($pdo, $table, $column);
        if ($exists) {
            $passed++;
            if ($verbose) echo "✅ {$table}.{$column} — {$reason}\n";
        } else {
            $failed++;
            $errors[] = "COLUMN_MISSING: $table.$column — $reason";
            echo "❌ MISSING COLUMN: {$table}.{$column} — {$reason}\n";
        }
    }
}

echo "\n" . str_repeat('=', 60) . "\n";
echo "SCHEMA VERIFICATION RESULTS\n";
echo "Environment: " . ($isPreview ? "PREVIEW" : "PRODUCTION") . "\n";
echo "Database: $db\n";
echo "Host: $host\n";
echo str_repeat('=', 60) . "\n";
echo "Passed:  $passed\n";
echo "Failed:  $failed\n";
echo "Warnings: " . count($warnings) . "\n";
echo str_repeat('=', 60) . "\n";

if ($json) {
    echo json_encode([
        'status'   => $failed === 0 ? 'PASS' : 'FAIL',
        'passed'   => $passed,
        'failed'   => $failed,
        'warnings' => count($warnings),
        'errors'   => $errors,
        'details'  => $warnings,
    ], JSON_PRETTY_PRINT) . "\n";
}

if ($failed > 0) {
    echo "\n❌ DEPLOYMENT GATE: FAIL — {$failed} check(s) failed\n";
    echo "   Deploy BLOCKED until all checks pass.\n";
    exit(1);
} else {
    echo "\n✅ DEPLOYMENT GATE: PASS — all {$passed} checks passed\n";
    exit(0);
}
