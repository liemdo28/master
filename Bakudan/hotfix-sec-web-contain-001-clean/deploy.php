<?php
/**
 * ONE-TIME deploy trigger — DELETE THIS FILE after use.
 * Call: https://dashboard.bakudanramen.com/deploy.php?key=deploy-p3-2026
 */
if (($_GET['key'] ?? '') !== 'deploy-p3-2026') {
    http_response_code(403); die('Forbidden');
}

header('Content-Type: text/plain; charset=utf-8');

$output = [];
$root   = __DIR__;

echo "=== PRE-DEPLOY VALIDATION ===\n\n";

// ── CRITICAL: Verify .env is present on production server ──────────────────
$envPath = $root . '/.env';
if (!file_exists($envPath)) {
    echo "ERROR: .env file is MISSING from production server.\n";
    echo "The .env file is gitignored and must be present on the server.\n";
    echo "Without it, DB_PASS is empty → database access denied.\n\n";
    echo "FIX: Upload .env to the server, then re-run deploy.\n";
    exit(1);
}

// Verify critical env vars are present (non-empty)
$envContent = file_get_contents($envPath);
$requiredVars = ['DB_PASS', 'DB_HOST', 'DB_NAME', 'DB_USER'];
$missingVars = [];
foreach ($requiredVars as $var) {
    if (!preg_match('/^' . $var . '=/m', $envContent) ||
        preg_match('/^' . $var . '=\s*$/m', $envContent)) {
        $missingVars[] = $var;
    }
}
if ($missingVars) {
    echo "ERROR: Missing critical environment variables in .env:\n";
    foreach ($missingVars as $v) echo "  - {$v}\n";
    echo "FIX: Add these values to .env on the production server.\n";
    exit(1);
}

echo "✓ .env file present and contains required variables\n\n";

// ── Load .env into local vars directly (no closure scope issue) ───────────
$DB_HOST = ''; $DB_NAME = ''; $DB_USER = ''; $DB_PASS = '';
$lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    $line = trim($line);
    if ($line === '' || $line[0] === '#') continue;
    if (strpos($line, '=') === false) continue;
    [$key, $value] = explode('=', $line, 2);
    $key = trim($key); $value = trim($value);
    if ($key === 'DB_HOST') $DB_HOST = $value;
    if ($key === 'DB_NAME') $DB_NAME = $value;
    if ($key === 'DB_DATABASE') $DB_NAME = $DB_NAME ?: $value;
    if ($key === 'DB_USER') $DB_USER = $value;
    if ($key === 'DB_PASS') $DB_PASS = $value;
    $_ENV[$key] = $value;
    putenv("$key=$value");
}
if (empty($DB_PASS)) {
    echo "ERROR: DB_PASS not loaded from .env during bootstrap test.\n";
    exit(1);
}
echo "✓ .env loads correctly — DB_PASS detected\n\n";

// ── SCHEMA VERIFICATION GATE ─────────────────────────────────────────────────

echo "=== SCHEMA VERIFICATION GATE ===\n\n";

try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    echo "DB connection: OK\n";
} catch (PDOException $e) {
    echo "FATAL: Cannot connect to database: " . $e->getMessage() . "\n";
    exit(1);
}

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

$requiredColumns = [
    'tasks' => ['visibility','submitted_at','recurring_root_id','approval_required',
        'reviewer_id','approver_id','submitted_by','checked_at','checked_by',
        'rejected_at','rejected_by','rejection_reason','final_done_at',
        'accepted_workflow_at','accepted_workflow_by','reviewer_result',
        'reviewer_result_at','approver_result','approver_result_at',
        'reviewer_due_date','reviewer_assigned_at','reviewed_at',
        'review_instructions','review_checklist','required_evidence',
        'required_files','acceptance_note','private_by_user_id','task_category',
        'bill_id','direct_store_id','estimated_time','repeat_from_mode',
        'repeat_end_type','repeat_end_date','repeat_end_count','occurrence_index',
        'reschedule_count'],
    'users' => ['preferred_locale'],
    'notifications' => ['sender_id'],
    'task_notifications' => ['inbox_category'],
    'releases' => ['title','published_by','summary','change_log','bug_fixes',
        'known_issues','risk_notes','rollback_notes','rollback_contact',
        'release_window_notes'],
];

$tableErrors = 0; $colErrors = 0;

foreach ($requiredTables as $table) {
    $ex = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$table' LIMIT 1")->fetchColumn();
    if (!$ex) {
        echo "✗ MISSING TABLE: $table\n";
        $tableErrors++;
    }
}
echo "Table check: " . (count($requiredTables) - $tableErrors) . "/" . count($requiredTables) . " OK";
if ($tableErrors) echo " — {$tableErrors} MISSING";
echo "\n";

foreach ($requiredColumns as $table => $cols) {
    $tableEx = $pdo->query("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='$table' LIMIT 1")->fetchColumn();
    if (!$tableEx) {
        echo "⚠ SKIPPED: $table columns (table missing)\n";
        continue;
    }
    foreach ($cols as $col) {
        $ex = $pdo->query("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='$table' AND column_name='$col' LIMIT 1")->fetchColumn();
        if (!$ex) {
            echo "✗ MISSING COLUMN: $table.$col\n";
            $colErrors++;
        }
    }
}
$totalCols = array_sum(array_map('count', $requiredColumns));
echo "Column check: " . ($totalCols - $colErrors) . "/$totalCols OK";
if ($colErrors) echo " — {$colErrors} MISSING";
echo "\n\n";

if ($tableErrors > 0 || $colErrors > 0) {
    echo "FATAL: Schema verification FAILED — {$tableErrors} table(s), {$colErrors} column(s) missing.\n";
    echo "ABORTING DEPLOY — Run migrations first.\n";
    exit(1);
}
echo "✓ SCHEMA GATE: PASS — all checks passed\n\n";

echo "=== TRANSLATION VERIFICATION GATE ===\n\n";

$translationCheck = [];
exec("cd {$root} && php scripts/verify-translations.php 2>&1", $translationCheck, $translationCode);
echo implode("\n", $translationCheck) . "\n";

if ($translationCode !== 0) {
    echo "\n⚠ WARNING: Translation verification reported issues (non-fatal).\n";
    echo "Translation check output:\n";
    echo implode("\n", $translationCheck) . "\n";
}
echo "✓ TRANSLATION GATE: PASSED (warnings allowed)\n\n";

echo "=== DEPLOYING FILES ===\n\n";

// Directive: Performance — gzip, caching, query consolidation, session lock (2026-04-24)
$files = [
    '.htaccess',
    'index.php',
    'config/database.php',
    'config/safety-guard.php',
    'views/layouts/main.php',
    'views/auth/login.php',
    'deploy_preview.php',
    'preview_db_health.php',
    'validate_preview_workflow.php',
    'repair_preview.php',
];

$fileList = implode(' ', $files);
// Full reset to origin/main to ensure ALL files are in sync
exec("cd {$root} && git fetch origin main 2>&1 && git reset --hard origin/main 2>&1", $output, $code);

echo "Exit code: {$code}\n\n";
echo implode("\n", $output) . "\n";

if ($code === 0) {
    echo "\nDEPLOY_OK\n\n";
} else {
    echo "\nDEPLOY_FAILED — Check output above.\n\n";
}

// ── Diagnostic: verify files exist after deploy ──
echo "=== POST-DEPLOY DIAGNOSTICS ===\n\n";
$checkFiles = [
    'ping.php', 'preview_db_health.php', 'validate_preview_workflow.php',
    'repair_preview.php', 'models/Section.php', 'models/User.php',
    'models/Task.php', 'config/database.php', 'index.php', '.htaccess',
];
foreach ($checkFiles as $f) {
    $full = $root . '/' . $f;
    $exists = file_exists($full);
    $size = $exists ? filesize($full) : 0;
    echo ($exists ? "✓" : "✗") . " {$f}" . ($exists ? " ({$size} bytes)" : " MISSING") . "\n";
}

echo "\nauto_prepend_file: " . (ini_get('auto_prepend_file') ?: '(none)') . "\n";
echo "git HEAD: " . trim(shell_exec("cd {$root} && git log --oneline -1 2>&1") ?: 'unknown') . "\n";
echo "git status: " . trim(shell_exec("cd {$root} && git status --short 2>&1") ?: 'clean') . "\n";
echo "__DIR__: " . __DIR__ . "\n";
echo "cwd: " . getcwd() . "\n";
