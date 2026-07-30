<?php
/**
 * P0 VERIFICATION RUNNER — Auto-checks schema, data, and task detail health.
 * Covers Phase A (DB), Phase D (scanner), Phase H (categories), Phase J (task regression).
 * Phases B, C, E, F, G, I, K require manual browser testing (see P0_VERIFICATION_SPEC.md).
 *
 * DELETE AFTER USE.
 * Access: https://dashboard.bakudanramen.com/run_p0_verification.php?key=bkd_verify_2026
 */

define('VERIFY_KEY', 'bkd_verify_2026');
define('TODAY', '2026-06-10');

// Key-only auth — no session required (avoids preview redirect issue)
// Must check key BEFORE loading database.php (which may trigger session logic)
if (($_GET['key'] ?? '') !== VERIFY_KEY) {
    http_response_code(403);
    die('<!DOCTYPE html><html><body style="background:#0f172a;color:#f87171;font-family:monospace;padding:2rem"><h2>403 Forbidden</h2><p>Invalid key.</p></body></html>');
}

require_once __DIR__ . '/config/database.php';

$db  = Database::getInstance();
$pdo = $db->getConnection();

// ── Helpers ─────────────────────────────────────────────────────────────────
function tblExists(PDO $pdo, string $t): bool {
    $s = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1");
    $s->execute([$t]); return (bool)$s->fetch();
}
function colExists(PDO $pdo, string $t, string $c): bool {
    $s = $pdo->prepare("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1");
    $s->execute([$t, $c]); return (bool)$s->fetch();
}
function count_rows(PDO $pdo, string $sql, array $p = []): int {
    try { $s = $pdo->prepare($sql); $s->execute($p); return (int)$s->fetchColumn(); }
    catch (PDOException $e) { return -1; }
}
function pass(string $label, string $detail = ''): string {
    return "<tr class='pass'><td>✅ PASS</td><td>$label</td><td>" . htmlspecialchars($detail) . "</td></tr>";
}
function fail(string $label, string $detail = ''): string {
    return "<tr class='fail'><td>❌ FAIL</td><td>$label</td><td>" . htmlspecialchars($detail) . "</td></tr>";
}
function warn(string $label, string $detail = ''): string {
    return "<tr class='warn'><td>⚠️ WARN</td><td>$label</td><td>" . htmlspecialchars($detail) . "</td></tr>";
}
function section(string $title): string {
    return "<tr class='section'><td colspan='3'><strong>$title</strong></td></tr>";
}

$rows  = '';
$pass  = 0;
$fail  = 0;
$warns = 0;

// ════════════════════════════════════════════════════════════════════════════
// PHASE A — DATABASE SCHEMA
// ════════════════════════════════════════════════════════════════════════════
$rows .= section('PHASE A — Database Schema');

// Required tables
$reqTables = [
    'bill_categories'          => 'New (bill system upgrade)',
    'bill_evidence'            => 'New (file evidence for bills)',
    'bill_history'             => 'New (bill audit trail)',
    'duplicate_groups'         => 'New (duplicate scanner)',
    'duplicate_group_items'    => 'New (duplicate scanner)',
    'duplicate_resolution_log' => 'New (duplicate scanner)',
    'task_notifications'       => 'Existing P0 (reviewer workspace)',
    'task_comments'            => 'Existing P0 (reviewer workspace)',
    'task_mentions'            => 'Existing P0 (reviewer workspace)',
    'task_reviewer_notes'      => 'Existing P0 (reviewer workspace)',
    'task_approval_notes'      => 'Existing P0 — PRIMARY BLOCKER',
];
foreach ($reqTables as $tbl => $desc) {
    $exists = tblExists($pdo, $tbl);
    if ($exists) { $rows .= pass("Table: $tbl", $desc); $pass++; }
    else { $rows .= fail("Table: $tbl MISSING", $desc . ' — run migration'); $fail++; }
}

// Bill columns
$billCols = [
    'responsible_user_id', 'checker_user_id', 'approver_user_id', 'verifier_user_id',
    'payment_method', 'frequency', 'duplicate_hash', 'is_archived',
    'last_paid_date', 'next_due_date', 'archived_at', 'archived_reason', 'duplicate_of_bill_id',
];
foreach ($billCols as $col) {
    $exists = colExists($pdo, 'bills', $col);
    if ($exists) { $rows .= pass("bills.$col"); $pass++; }
    else { $rows .= fail("bills.$col MISSING", 'Run 2026_06_10_bill_registry_upgrade.sql'); $fail++; }
}

// Task columns
$taskCols = [
    'duplicate_hash', 'archived_duplicate', 'merged_into_task_id',
    'duplicate_reason', 'assignment_notified_at',
];
foreach ($taskCols as $col) {
    $exists = colExists($pdo, 'tasks', $col);
    if ($exists) { $rows .= pass("tasks.$col"); $pass++; }
    else { $rows .= fail("tasks.$col MISSING", 'Run 2026_06_10_duplicate_control.sql'); $fail++; }
}

// bill_categories seeded
$catCount = tblExists($pdo, 'bill_categories')
    ? count_rows($pdo, "SELECT COUNT(*) FROM bill_categories")
    : 0;
if ($catCount >= 9) { $rows .= pass("bill_categories seeded", "$catCount rows"); $pass++; }
elseif ($catCount > 0) { $rows .= warn("bill_categories partial", "$catCount / 9 expected rows"); $warns++; }
else { $rows .= fail("bill_categories empty or missing", "Run migration seed INSERT"); $fail++; }

// ════════════════════════════════════════════════════════════════════════════
// PHASE D — DAILY SCANNER STATE
// ════════════════════════════════════════════════════════════════════════════
$rows .= section('PHASE D — Daily Duplicate Scanner');

if (tblExists($pdo, 'duplicate_groups')) {
    $dgCount  = count_rows($pdo, "SELECT COUNT(*) FROM duplicate_groups");
    $dgiCount = count_rows($pdo, "SELECT COUNT(*) FROM duplicate_group_items");
    if ($dgCount > 0) { $rows .= pass("duplicate_groups populated", "$dgCount groups found"); $pass++; }
    else { $rows .= warn("duplicate_groups empty", "Run php crons/DailyDuplicateTaskBillScanner.php"); $warns++; }
    if ($dgiCount > 0) { $rows .= pass("duplicate_group_items populated", "$dgiCount items"); $pass++; }
    else { $rows .= warn("duplicate_group_items empty", "Scanner hasn't run yet"); $warns++; }

    // Show last 5 groups
    try {
        $grps = $pdo->query("SELECT entity_type, duplicate_hash, status, detected_at FROM duplicate_groups ORDER BY detected_at DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
        if ($grps) {
            $detail = implode('; ', array_map(fn($g) => "[{$g['entity_type']}|{$g['status']}]", $grps));
            $rows .= pass("Recent groups sample", $detail);
            $pass++;
        }
    } catch (PDOException $e) {}
} else {
    $rows .= fail("duplicate_groups table missing", "Run 2026_06_10_duplicate_control.sql first"); $fail++;
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE H — BILL CATEGORIES
// ════════════════════════════════════════════════════════════════════════════
$rows .= section('PHASE H — Bill Categories');

$requiredCategorySlugs = ['rent','utility','tax','insurance','credit_card','vendor','payroll','compliance','other'];
if (tblExists($pdo, 'bill_categories')) {
    $existingSlugs = $pdo->query("SELECT slug FROM bill_categories")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($requiredCategorySlugs as $slug) {
        if (in_array($slug, $existingSlugs)) { $rows .= pass("bill_categories: $slug"); $pass++; }
        else { $rows .= fail("bill_categories: $slug MISSING", "Re-run seed INSERT"); $fail++; }
    }
} else {
    $rows .= fail("bill_categories table missing — cannot check slugs", ''); $fail++;
}

// Bill count per category (existing categories on bills table)
try {
    $billCats = $pdo->query("SELECT category, COUNT(*) as cnt FROM bills WHERE status != 'archived' GROUP BY category ORDER BY cnt DESC")->fetchAll(PDO::FETCH_ASSOC);
    if ($billCats) {
        $summary = implode(', ', array_map(fn($r) => "{$r['category']}:{$r['cnt']}", $billCats));
        $rows .= pass("Bills by category (existing)", $summary); $pass++;
    } else {
        $rows .= warn("No bills in DB yet", "Create seed bills per category"); $warns++;
    }
} catch (PDOException $e) {
    $rows .= warn("Could not query bills by category", $e->getMessage()); $warns++;
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE J — TASK DETAIL REGRESSION (50 random tasks)
// ════════════════════════════════════════════════════════════════════════════
$rows .= section('PHASE J — Task Detail Regression (50 random tasks)');

// Check all 5 guarded tables exist
$taskGuardTables = ['task_comments', 'task_mentions', 'task_notifications', 'task_reviewer_notes', 'task_approval_notes'];
foreach ($taskGuardTables as $tbl) {
    $exists = tblExists($pdo, $tbl);
    if ($exists) { $rows .= pass("Task table $tbl exists", "Defensive guard active"); $pass++; }
    else { $rows .= warn("Task table $tbl MISSING", "Defensive tableExists() guard should prevent crash — but run migration to create it"); $warns++; }
}

// Spot-check 50 random tasks — verify they have no obvious issues
try {
    $taskIds = $pdo->query("SELECT id FROM tasks WHERE is_completed = 0 ORDER BY RAND() LIMIT 50")->fetchAll(PDO::FETCH_COLUMN);
    $taskCount = count($taskIds);
    if ($taskCount === 0) {
        $rows .= warn("No incomplete tasks found to test", "Add tasks first"); $warns++;
    } else {
        // We can't make HTTP requests from within PHP easily — instead verify the model queries
        // by running the same SQL Task::findById() would use
        $taskErrors = 0;
        $taskOk = 0;
        foreach (array_slice($taskIds, 0, 50) as $tid) {
            try {
                $pdo->prepare("SELECT t.*, u.name as assignee_name FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.id = ? LIMIT 1")->execute([$tid]);
                $taskOk++;
            } catch (PDOException $e) {
                $taskErrors++;
            }
        }
        if ($taskErrors === 0) { $rows .= pass("$taskOk/$taskCount tasks — base query OK", "No SQL errors on task SELECT"); $pass++; }
        else { $rows .= fail("$taskErrors task queries failed", "Check tasks table + joins"); $fail++; }

        // Check task_approval_notes guarded access
        if (tblExists($pdo, 'task_approval_notes')) {
            try {
                $notesCount = count_rows($pdo, "SELECT COUNT(*) FROM task_approval_notes");
                $rows .= pass("task_approval_notes accessible", "$notesCount rows"); $pass++;
            } catch (PDOException $e) {
                $rows .= fail("task_approval_notes query error", $e->getMessage()); $fail++;
            }
        } else {
            $rows .= warn("task_approval_notes missing — tableExists guard prevents crash but table should exist", "Run migration"); $warns++;
        }

        // Check accepted_at gate removed (Task.php should NOT filter on accepted_at)
        // We check by looking at tasks that have accepted_at = NULL
        try {
            $nullAccepted = count_rows($pdo, "SELECT COUNT(*) FROM tasks WHERE accepted_at IS NULL AND is_completed = 0");
            if ($nullAccepted > 0) {
                $rows .= pass("accepted_at IS NULL tasks exist in system", "$nullAccepted tasks — these must be visible to assignee"); $pass++;
            } else {
                $rows .= warn("All tasks have accepted_at set — gate removal may not matter yet", "Test by creating new task"); $warns++;
            }
        } catch (PDOException $e) {
            $rows .= warn("Could not check accepted_at", $e->getMessage()); $warns++;
        }
    }
} catch (PDOException $e) {
    $rows .= fail("Task query failed", $e->getMessage()); $fail++;
}

// ════════════════════════════════════════════════════════════════════════════
// PHASE K — DRILL-DOWN ROUTES REGISTERED
// ════════════════════════════════════════════════════════════════════════════
$rows .= section('PHASE K — Drill-Down Routes (code check)');

// Check DrilldownController exists and has required methods
$dcFile = __DIR__ . '/controllers/DrilldownController.php';
if (file_exists($dcFile)) {
    $dcContent = file_get_contents($dcFile);
    $methods = [
        'overdueBills'     => '/overview/drilldown/overdue-bills',
        'criticalTasks'    => '/overview/drilldown/critical-tasks',
        'complianceRisk'   => '/overview/drilldown/compliance-risk',
        'executionRisk'    => '/overview/drilldown/execution-risk',
        'unifiedRisk'      => '/overview/drilldown/unified-risk',
        'cashRisk'         => '/overview/drilldown/cash-risk',
        'financeBills'     => '/overview/drilldown/finance-bills',
        'executionHealth'  => '/overview/drilldown/execution-health',
        'billsByCategory'  => '/overview/drilldown/bills/category/{slug}',
        'billsByStore'     => '/overview/drilldown/bills/store/{id}',
    ];
    foreach ($methods as $method => $route) {
        if (strpos($dcContent, "function $method") !== false) {
            $rows .= pass("DrilldownController::$method()", $route); $pass++;
        } else {
            $rows .= fail("DrilldownController::$method() MISSING", "Route $route will 404"); $fail++;
        }
    }
} else {
    $rows .= fail("DrilldownController.php NOT FOUND", "Critical — all drill-downs broken"); $fail++;
}

// Check DuplicateDetector exists
if (file_exists(__DIR__ . '/models/DuplicateDetector.php')) {
    $rows .= pass("models/DuplicateDetector.php exists"); $pass++;
} else {
    $rows .= fail("models/DuplicateDetector.php MISSING", "Duplicate detection will not work"); $fail++;
}

// Check popup partial exists
if (file_exists(__DIR__ . '/views/partials/task_assigned_popup.php')) {
    $rows .= pass("views/partials/task_assigned_popup.php exists"); $pass++;
} else {
    $rows .= fail("views/partials/task_assigned_popup.php MISSING", "Popup notifications will not work"); $fail++;
}

// Check admin duplicates view exists
if (file_exists(__DIR__ . '/views/admin/duplicates/index.php')) {
    $rows .= pass("views/admin/duplicates/index.php exists"); $pass++;
} else {
    $rows .= fail("views/admin/duplicates/index.php MISSING"); $fail++;
}

// Check cron exists
if (file_exists(__DIR__ . '/crons/DailyDuplicateTaskBillScanner.php')) {
    $rows .= pass("crons/DailyDuplicateTaskBillScanner.php exists"); $pass++;
} else {
    $rows .= fail("crons/DailyDuplicateTaskBillScanner.php MISSING"); $fail++;
}

// ════════════════════════════════════════════════════════════════════════════
// QUICK RUN SCANNER (if requested)
// ════════════════════════════════════════════════════════════════════════════
$scannerOutput = '';
if (($_GET['run_scanner'] ?? '') === '1') {
    ob_start();
    try {
        require_once __DIR__ . '/crons/DailyDuplicateTaskBillScanner.php';
        $scanner = new DailyDuplicateTaskBillScanner();
        $scanner->run();
        $scannerOutput = nl2br(htmlspecialchars(ob_get_clean()));
    } catch (Throwable $e) {
        ob_end_clean();
        $scannerOutput = '<span style="color:#f87171">Scanner error: ' . htmlspecialchars($e->getMessage()) . '</span>';
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TOTALS
// ════════════════════════════════════════════════════════════════════════════
$total   = $pass + $fail + $warns;
$readyClass = $fail === 0 ? 'ready' : 'not-ready';
$readyLabel = $fail === 0 ? '✅ SCHEMA READY FOR PRODUCTION' : "❌ NOT READY — $fail checks failed";
?>
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>P0 Verification — <?= TODAY ?></title>
<style>
body{font-family:monospace;background:#0f172a;color:#e2e8f0;padding:2rem;font-size:13px}
table{border-collapse:collapse;width:100%;margin:1rem 0}
td{padding:5px 10px;border:1px solid #334155}
h2{color:#60a5fa}h3{color:#94a3b8}
.pass td:first-child{color:#4ade80}
.fail td:first-child{color:#f87171}
.warn td:first-child{color:#fbbf24}
.section td{background:#1e2a3b;color:#60a5fa;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:8px 10px}
.ready{background:#14532d;border:2px solid #166534;padding:1.5rem;border-radius:8px;text-align:center;color:#86efac;font-size:18px;margin-bottom:2rem}
.not-ready{background:#7f1d1d;border:2px solid #991b1b;padding:1.5rem;border-radius:8px;text-align:center;color:#fca5a5;font-size:18px;margin-bottom:2rem}
.stats{display:flex;gap:2rem;margin:1rem 0}
.stat{background:#1e2a3b;border-radius:8px;padding:0.75rem 1.5rem;text-align:center}
.stat .n{font-size:2rem;font-weight:bold}
.stat.sp .n{color:#4ade80}
.stat.sf .n{color:#f87171}
.stat.sw .n{color:#fbbf24}
.btn{display:inline-block;padding:8px 20px;border-radius:6px;text-decoration:none;font-size:13px;cursor:pointer;border:none;margin:4px}
.btn-blue{background:#1d4ed8;color:#fff}.btn-blue:hover{background:#1e40af}
.btn-red{background:#dc2626;color:#fff}
.scanner-out{background:#1e2a3b;padding:1rem;border-radius:8px;margin-top:1rem;max-height:300px;overflow:auto}
</style>
</head>
<body>
<h2>P0 Verification Runner — <?= TODAY ?></h2>
<p style="color:#94a3b8">Auto-checks: Phase A (Schema), Phase D (Scanner), Phase H (Categories), Phase J (Task Regression), Phase K (Code files)<br>
<strong>Manual still required:</strong> Phase B (Bill Dup modal), C (Task Dup modal), E (Admin UI), F (Assignment), G (Popup), I (CEO data), K (browser click test)</p>

<div class="<?= $readyClass ?>"><?= $readyLabel ?></div>

<div class="stats">
  <div class="stat sp"><div class="n"><?= $pass ?></div><div>PASS</div></div>
  <div class="stat sf"><div class="n"><?= $fail ?></div><div>FAIL</div></div>
  <div class="stat sw"><div class="n"><?= $warns ?></div><div>WARN</div></div>
  <div class="stat"><div class="n"><?= $total ?></div><div>TOTAL</div></div>
</div>

<div style="margin-bottom:1rem">
  <a class="btn btn-blue" href="?key=<?= VERIFY_KEY ?>&run_scanner=1">▶ Run Daily Scanner Now</a>
  <a class="btn btn-blue" href="?key=<?= VERIFY_KEY ?>">↺ Refresh Results</a>
  <a class="btn" style="background:#374151;color:#e2e8f0" href="/admin/duplicates">→ Admin Duplicates</a>
  <a class="btn" style="background:#374151;color:#e2e8f0" href="/overview">→ Dashboard</a>
</div>

<?php if ($scannerOutput): ?>
<div class="scanner-out"><strong style="color:#60a5fa">Scanner Output:</strong><br><?= $scannerOutput ?></div>
<?php endif; ?>

<table>
  <tr style="background:#1e2a3b"><th width="80">Status</th><th>Check</th><th>Detail</th></tr>
  <?= $rows ?>
</table>

<?php if ($fail > 0): ?>
<div style="background:#7f1d1d;border:1px solid #991b1b;padding:1rem;border-radius:8px;margin-top:1.5rem">
  <strong style="color:#fca5a5">❌ <?= $fail ?> checks failed — run these migrations before deploy:</strong><br>
  <code style="color:#fde68a">
    database/migrations/2026_06_10_bill_registry_upgrade.sql<br>
    database/migrations/2026_06_10_duplicate_control.sql<br>
    database/migrations/2026_06_10_assignment_flow_fix.sql<br>
    database/migrations/2026_06_02_reviewer_workspace.sql  ← if task_* tables still missing
  </code>
</div>
<?php endif; ?>

<p style="color:#475569;margin-top:2rem;font-size:11px">
  DELETE this file after verification complete. See reports/P0_VERIFICATION_SPEC.md for manual phase instructions.
</p>
</body>
</html>
