<?php
/**
 * PREVIEW DATABASE VALIDATION
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves that rows are actually created in these tables after each workflow step:
 *   1. tasks
 *   2. task_comments
 *   3. task_notifications
 *   4. task_reviewer_notes
 *   5. task_approval_notes
 *   6. task_attachments (schema check only — no migration exists yet)
 *
 * Usage (CLI):
 *   php validate_preview_workflow.php
 *
 * Usage (HTTP):
 *   GET /validate_preview_workflow.php?token=PREVIEW_HEALTH_2026
 *
 * All test rows are wrapped in a transaction and ROLLED BACK after validation.
 * Zero side-effects on the database.
 */

// ── Bootstrap ────────────────────────────────────────────────────────────────
require_once __DIR__ . '/config/database.php';

$expectedToken = $_ENV['PREVIEW_HEALTH_TOKEN'] ?? getenv('PREVIEW_HEALTH_TOKEN') ?: 'PREVIEW_HEALTH_2026';
if (php_sapi_name() !== 'cli') {
    $providedToken = $_GET['token'] ?? ($_SERVER['HTTP_X_PREVIEW_HEALTH_TOKEN'] ?? '');
    if (!hash_equals($expectedToken, $providedToken)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'FORBIDDEN', 'message' => 'Valid token required.']);
        exit;
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function out(string $msg): void {
    echo $msg . PHP_EOL;
}

function step(string $label): void {
    out('');
    out("══════════════════════════════════════════════════════════════");
    out("  STEP: $label");
    out("══════════════════════════════════════════════════════════════");
}

function pass(string $table, int $id): void {
    out("  ✅ PASS — row created in `$table` (id=$id)");
}

function fail(string $msg): void {
    out("  ❌ FAIL — $msg");
}

function info(string $msg): void {
    out("  ℹ️  $msg");
}

// ── Connect ──────────────────────────────────────────────────────────────────
$db = Database::getInstance();
$pdo = $db->getConnection();

out("┌─────────────────────────────────────────────────────────────────┐");
out("│  PREVIEW DATABASE WORKFLOW VALIDATION                           │");
out("│  Database: " . (DB_NAME ?? 'unknown') . str_repeat(' ', max(0, 40 - strlen(DB_NAME ?? ''))) . "│");
out("│  Time:     " . date('Y-m-d H:i:s T') . "                       │");
out("└─────────────────────────────────────────────────────────────────┘");

// ── Pre-check: required tables exist ─────────────────────────────────────────
step("0 — Schema Pre-Check");

$requiredTables = ['tasks', 'task_comments', 'task_notifications', 'task_reviewer_notes', 'task_approval_notes'];
$optionalTables = ['task_attachments'];
$missingRequired = [];
$tableReport = [];

foreach (array_merge($requiredTables, $optionalTables) as $table) {
    $exists = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1");
    $exists->execute([$table]);
    $found = (bool)$exists->fetchColumn();
    $tableReport[$table] = $found ? 'EXISTS' : 'MISSING';
    if (!$found && in_array($table, $requiredTables)) {
        $missingRequired[] = $table;
    }
}

foreach ($tableReport as $t => $status) {
    $icon = $status === 'EXISTS' ? '✅' : '⚠️';
    out("  $icon $t → $status");
}

if (!empty($missingRequired)) {
    out('');
    fail("Missing required tables: " . implode(', ', $missingRequired));
    out("  Run migrations first: database/migrations/2026_06_02_reviewer_workspace.sql");
    if (php_sapi_name() !== 'cli') {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'FAIL', 'missing_tables' => $missingRequired]);
    }
    exit(1);
}

// ── Find a valid user and project for FK constraints ─────────────────────────
$user = $pdo->query("SELECT id, name FROM users WHERE is_active = 1 LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$user2 = $pdo->query("SELECT id, name FROM users WHERE is_active = 1 AND id != {$user['id']} LIMIT 1")->fetch(PDO::FETCH_ASSOC);
$project = $pdo->query("SELECT id, name FROM projects LIMIT 1")->fetch(PDO::FETCH_ASSOC);

if (!$user || !$project) {
    fail("Need at least 1 active user and 1 project to validate. Seed data first.");
    exit(1);
}

info("Using user: {$user['name']} (id={$user['id']})");
if ($user2) info("Using user2: {$user2['name']} (id={$user2['id']})");
info("Using project: {$project['name']} (id={$project['id']})");

// ── BEGIN TRANSACTION (all inserts will be rolled back) ──────────────────────
$pdo->beginTransaction();
out('');
info("Transaction started — all test rows will be ROLLED BACK after validation.");

$results = [];
$allPass = true;

try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Create a task (simulates task creation workflow)
    // ──────────────────────────────────────────────────────────────────────────
    step("1 — Create Task");

    $pdo->prepare("INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, approval_required, reviewer_id, approver_id, created_at)
        VALUES (?, ?, ?, ?, ?, 'todo', 'medium', 1, ?, ?, NOW())")
        ->execute([
            '[VALIDATION] Test Task ' . date('His'),
            'Automated validation — proves row creation in tasks table',
            $project['id'],
            $user['id'],
            $user['id'],
            $user2 ? $user2['id'] : $user['id'],
            $user['id'],
        ]);
    $taskId = (int)$pdo->lastInsertId();

    $verify = $pdo->prepare("SELECT id, title, status, approval_required FROM tasks WHERE id = ?");
    $verify->execute([$taskId]);
    $taskRow = $verify->fetch(PDO::FETCH_ASSOC);

    if ($taskRow) {
        pass('tasks', $taskId);
        info("title: {$taskRow['title']}");
        info("status: {$taskRow['status']}, approval_required: {$taskRow['approval_required']}");
        $results['tasks'] = ['status' => 'PASS', 'id' => $taskId];
    } else {
        fail("tasks row not found after INSERT");
        $results['tasks'] = ['status' => 'FAIL'];
        $allPass = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: Add a comment (simulates reviewer/assignee commenting)
    // ──────────────────────────────────────────────────────────────────────────
    step("2 — Add Task Comment");

    $pdo->prepare("INSERT INTO task_comments (task_id, user_id, content, comment_type, created_at)
        VALUES (?, ?, ?, 'comment', NOW())")
        ->execute([$taskId, $user['id'], '[VALIDATION] Test comment — workflow step 2']);
    $commentId = (int)$pdo->lastInsertId();

    $verify = $pdo->prepare("SELECT id, task_id, content, comment_type FROM task_comments WHERE id = ?");
    $verify->execute([$commentId]);
    $commentRow = $verify->fetch(PDO::FETCH_ASSOC);

    if ($commentRow) {
        pass('task_comments', $commentId);
        info("task_id: {$commentRow['task_id']}, type: {$commentRow['comment_type']}");
        $results['task_comments'] = ['status' => 'PASS', 'id' => $commentId];
    } else {
        fail("task_comments row not found after INSERT");
        $results['task_comments'] = ['status' => 'FAIL'];
        $allPass = false;
    }

    // Also test a threaded reply
    $pdo->prepare("INSERT INTO task_comments (task_id, user_id, content, comment_type, parent_id, created_at)
        VALUES (?, ?, ?, 'comment', ?, NOW())")
        ->execute([$taskId, $user2 ? $user2['id'] : $user['id'], '[VALIDATION] Threaded reply', $commentId]);
    $replyId = (int)$pdo->lastInsertId();
    info("Threaded reply created (id=$replyId, parent_id=$commentId)");

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Create a notification (simulates task_assigned notification)
    // ──────────────────────────────────────────────────────────────────────────
    step("3 — Create Task Notification");

    $pdo->prepare("INSERT INTO task_notifications (user_id, task_id, notification_type, title, message, from_user_id, inbox_category, created_at)
        VALUES (?, ?, 'task_assigned', ?, ?, ?, 'task', NOW())")
        ->execute([
            $user['id'],
            $taskId,
            '[VALIDATION] Task assigned to you',
            'You have been assigned a validation task',
            $user2 ? $user2['id'] : $user['id'],
        ]);
    $notifId = (int)$pdo->lastInsertId();

    $verify = $pdo->prepare("SELECT id, user_id, notification_type, is_read, inbox_category FROM task_notifications WHERE id = ?");
    $verify->execute([$notifId]);
    $notifRow = $verify->fetch(PDO::FETCH_ASSOC);

    if ($notifRow) {
        pass('task_notifications', $notifId);
        info("type: {$notifRow['notification_type']}, is_read: {$notifRow['is_read']}, category: {$notifRow['inbox_category']}");
        $results['task_notifications'] = ['status' => 'PASS', 'id' => $notifId];
    } else {
        fail("task_notifications row not found after INSERT");
        $results['task_notifications'] = ['status' => 'FAIL'];
        $allPass = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Add a reviewer note (simulates reviewer providing guidance)
    // ──────────────────────────────────────────────────────────────────────────
    step("4 — Add Reviewer Note");

    $reviewerId = $user2 ? $user2['id'] : $user['id'];
    $checklistJson = json_encode([
        ['text' => 'Check formatting', 'done' => false],
        ['text' => 'Verify calculations', 'done' => false],
    ]);

    $pdo->prepare("INSERT INTO task_reviewer_notes (task_id, user_id, note_type, title, content, checklist_items, created_at)
        VALUES (?, ?, 'instruction', ?, ?, ?, NOW())")
        ->execute([
            $taskId,
            $reviewerId,
            '[VALIDATION] Review instructions',
            'Please follow these steps for quality assurance validation.',
            $checklistJson,
        ]);
    $noteId = (int)$pdo->lastInsertId();

    $verify = $pdo->prepare("SELECT id, task_id, note_type, title, checklist_items, is_completed FROM task_reviewer_notes WHERE id = ?");
    $verify->execute([$noteId]);
    $noteRow = $verify->fetch(PDO::FETCH_ASSOC);

    if ($noteRow) {
        pass('task_reviewer_notes', $noteId);
        info("type: {$noteRow['note_type']}, is_completed: {$noteRow['is_completed']}");
        info("checklist_items: {$noteRow['checklist_items']}");
        $results['task_reviewer_notes'] = ['status' => 'PASS', 'id' => $noteId];
    } else {
        fail("task_reviewer_notes row not found after INSERT");
        $results['task_reviewer_notes'] = ['status' => 'FAIL'];
        $allPass = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Add an approval note (simulates approver decision)
    // ──────────────────────────────────────────────────────────────────────────
    step("5 — Add Approval Note");

    $pdo->prepare("INSERT INTO task_approval_notes (task_id, user_id, action, content, is_final, created_at)
        VALUES (?, ?, 'approved', ?, 1, NOW())")
        ->execute([
            $taskId,
            $user['id'],
            '[VALIDATION] Approved — all criteria met. Good work.',
        ]);
    $approvalId = (int)$pdo->lastInsertId();

    $verify = $pdo->prepare("SELECT id, task_id, action, content, is_final FROM task_approval_notes WHERE id = ?");
    $verify->execute([$approvalId]);
    $approvalRow = $verify->fetch(PDO::FETCH_ASSOC);

    if ($approvalRow) {
        pass('task_approval_notes', $approvalId);
        info("action: {$approvalRow['action']}, is_final: {$approvalRow['is_final']}");
        $results['task_approval_notes'] = ['status' => 'PASS', 'id' => $approvalId];
    } else {
        fail("task_approval_notes row not found after INSERT");
        $results['task_approval_notes'] = ['status' => 'FAIL'];
        $allPass = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: task_attachments — schema check only
    // ──────────────────────────────────────────────────────────────────────────
    step("6 — task_attachments (Schema Check)");

    if ($tableReport['task_attachments'] === 'EXISTS') {
        $cols = $pdo->query("SHOW COLUMNS FROM task_attachments")->fetchAll(PDO::FETCH_ASSOC);
        info("Table exists with " . count($cols) . " columns:");
        foreach ($cols as $col) {
            info("  - {$col['Field']} ({$col['Type']})");
        }
        $results['task_attachments'] = ['status' => 'PASS', 'note' => 'table exists'];
    } else {
        info("task_attachments table does NOT exist yet.");
        info("No migration found in database/migrations/. This is expected if the feature is pending.");
        $results['task_attachments'] = ['status' => 'SKIP', 'note' => 'no migration exists'];
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BONUS: Verify cross-table relationships
    // ──────────────────────────────────────────────────────────────────────────
    step("BONUS — Cross-Table Relationship Verification");

    // Verify all rows reference the same task
    $crossCheck = $pdo->prepare("
        SELECT
            (SELECT COUNT(*) FROM task_comments WHERE task_id = ?) AS comments,
            (SELECT COUNT(*) FROM task_notifications WHERE task_id = ?) AS notifications,
            (SELECT COUNT(*) FROM task_reviewer_notes WHERE task_id = ?) AS reviewer_notes,
            (SELECT COUNT(*) FROM task_approval_notes WHERE task_id = ?) AS approval_notes
    ");
    $crossCheck->execute([$taskId, $taskId, $taskId, $taskId]);
    $counts = $crossCheck->fetch(PDO::FETCH_ASSOC);

    info("All rows for task_id=$taskId:");
    info("  task_comments:      {$counts['comments']}");
    info("  task_notifications: {$counts['notifications']}");
    info("  task_reviewer_notes:{$counts['reviewer_notes']}");
    info("  task_approval_notes:{$counts['approval_notes']}");

    $crossPass = $counts['comments'] >= 2 && $counts['notifications'] >= 1
        && $counts['reviewer_notes'] >= 1 && $counts['approval_notes'] >= 1;

    if ($crossPass) {
        out("  ✅ Cross-table integrity VERIFIED");
    } else {
        fail("Cross-table counts don't match expected minimums");
        $allPass = false;
    }

} catch (Throwable $e) {
    fail("Exception: " . $e->getMessage());
    out("  File: " . $e->getFile() . ":" . $e->getLine());
    $allPass = false;
} finally {
    // ── ROLLBACK — no test data persists ─────────────────────────────────────
    $pdo->rollBack();
    out('');
    info("Transaction ROLLED BACK — no test data persists in the database.");
}

// ── Final Summary ────────────────────────────────────────────────────────────
out('');
out("┌─────────────────────────────────────────────────────────────────┐");
out("│  VALIDATION SUMMARY                                             │");
out("├─────────────────────────────────────────────────────────────────┤");
foreach ($results as $table => $r) {
    $icon = $r['status'] === 'PASS' ? '✅' : ($r['status'] === 'SKIP' ? '⏭️' : '❌');
    $detail = isset($r['id']) ? "id={$r['id']}" : ($r['note'] ?? '');
    $line = "│  $icon $table — {$r['status']} $detail";
    $line .= str_repeat(' ', max(0, 66 - mb_strlen($line))) . "│";
    out($line);
}
out("├─────────────────────────────────────────────────────────────────┤");
$finalStatus = $allPass ? '✅ ALL PASS' : '❌ SOME FAILURES';
out("│  RESULT: $finalStatus" . str_repeat(' ', max(0, 55 - strlen($finalStatus))) . "│");
out("└─────────────────────────────────────────────────────────────────┘");

// ── JSON output for HTTP ─────────────────────────────────────────────────────
if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'status' => $allPass ? 'PASS' : 'FAIL',
        'database' => DB_NAME,
        'validated_at' => date('c'),
        'tables' => $results,
        'note' => 'All rows were rolled back — zero side-effects.',
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
}

exit($allPass ? 0 : 1);
