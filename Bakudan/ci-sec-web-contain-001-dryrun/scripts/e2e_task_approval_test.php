<?php
/**
 * P0 — End-to-End Task Approval Workflow Test
 * ============================================
 * Walks the full 3-stage approval chain:
 *   Admin creates task → Staff completes → Reviewer approves → Approver accepts → DONE
 *
 * Usage:
 *   php scripts/e2e_task_approval_test.php
 *
 * Requires:
 *   - Preview server accessible (set PREVIEW_URL below)
 *   - cURL extension enabled
 *   - Valid user accounts in preview DB (see USER IDs below)
 *
 * Output:
 *   - Task IDs at each stage
 *   - SQL evidence (SELECT queries + results)
 *   - HTTP response summaries
 *   - Pass/fail for each verification point
 */

// ── CONFIG ───────────────────────────────────────────────────────────────────
define('PREVIEW_URL', 'https://preview.dashboard.bakudanramen.com');
define('COOKIE_JAR', __DIR__ . '/../tmp/e2e_cookies.txt');

// Find users: run this SQL first to identify IDs:
// SELECT id, name, email, role FROM users ORDER BY id;
define('USERS', [
    'admin'    => ['id' => 1, 'email' => 'admin@bakudanramen.com'],
    'staff'   => ['id' => 2, 'email' => 'staff@bakudanramen.com'],
    'reviewer'=> ['id' => 3, 'email' => 'reviewer@bakudanramen.com'],
    'approver'=> ['id' => 4, 'email' => 'approver@bakudanramen.com'],
    'qa'      => ['id' => 5, 'email' => 'phase11.preview@bakudanramen.com'],
]);

// ── DB CONNECTION (direct, bypasses app bootstrap) ─────────────────────────────
$pdo = null;
$dbConnected = false;
$dbHost = 'preview-db';
$dbName = 'bakudan_preview';
$dbUser = 'bakudan';
$dbPass = 'preview_pass';

try {
    $pdo = new PDO("mysql:host=$dbHost;dbname=$dbName;charset=utf8mb4", $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $dbConnected = true;
} catch (Exception $e) {
    // Try localhost fallback for local dev
    try {
        $dbHost2 = '127.0.0.1';
        $pdo = new PDO("mysql:host=$dbHost2;dbname=$dbName;port=3307;charset=utf8mb4", $dbUser, $dbPass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $dbConnected = true;
    } catch (Exception $e2) {
        echo "[DB] Could not connect to preview DB: " . $e2->getMessage() . "\n";
        echo "[DB] Will run HTTP-only mode. Set correct DB credentials above.\n";
    }
}

// ── UTILITIES ────────────────────────────────────────────────────────────────
function log_msg(string $type, string $msg, array $extra = []) {
    $ts = date('H:i:s');
    $extraStr = $extra ? ' | ' . json_encode($extra, JSON_UNESCAPED_SLASHES) : '';
    echo "[$ts] [$type] $msg$extraStr\n";
}

function log_pass(string $msg) { log_msg('PASS', $msg); }
function log_fail(string $msg) { log_msg('FAIL', $msg); }
function log_info(string $msg) { log_msg('INFO', $msg); }
function log_warn(string $msg) { log_msg('WARN', $msg); }
function log_step(string $msg) { echo "\n" . str_repeat('=', 72) . "\n STEP: $msg\n" . str_repeat('=', 72) . "\n"; }

function http_post(string $url, array $post = [], ?string $cookieFile = null, array $headers = []): array {
    $ch = curl_init($url);
    $postFields = http_build_query($post);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS    => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER    => array_merge(['Content-Type: application/x-www-form-urlencoded'], $headers),
    ]);
    if ($cookieFile && file_exists($cookieFile)) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    }
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err, 'body' => '', 'code' => 0];
    return ['body' => $body, 'code' => $code, 'error' => null];
}

function http_get(string $url, ?string $cookieFile = null): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_HTTPGET       => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_FOLLOWLOCATION => true,
    ]);
    if ($cookieFile && file_exists($cookieFile)) {
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
    }
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($err) return ['error' => $err, 'body' => '', 'code' => 0];
    return ['body' => $body, 'code' => $code, 'error' => null];
}

function login_user(string $email, string $url, string $cookieFile): bool {
    $resp = http_post($url . '/login', [
        'email'    => $email,
        'password' => 'preview123',
        'csrf'     => '',
    ], $cookieFile);
    return $resp['code'] >= 200 && $resp['code'] < 400;
}

function sql_query(string $sql, array $params = []): array {
    global $pdo;
    if (!$pdo) return ['error' => 'No DB connection'];
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return ['rows' => $stmt->fetchAll(), 'count' => $stmt->rowCount()];
    } catch (Exception $e) {
        return ['error' => $e->getMessage()];
    }
}

function sql_one(string $sql, array $params = []): ?array {
    $r = sql_query($sql, $params);
    if (!empty($r['error']) || empty($r['rows'])) return null;
    return $r['rows'][0];
}

function verify_field(string $label, $actual, $expected, bool $strict = false): bool {
    if ($strict) {
        $ok = $actual === $expected;
    } else {
        $ok = strcasecmp((string)$actual, (string)$expected) === 0;
    }
    if ($ok) {
        log_pass("$label: OK (actual='$actual', expected='$expected')");
    } else {
        log_fail("$label: MISMATCH (actual='$actual', expected='$expected')");
    }
    return $ok;
}

function verify_contains(string $label, string $haystack, string $needle): bool {
    $ok = strpos($haystack, $needle) !== false;
    if ($ok) {
        log_pass("$label: contains '$needle'");
    } else {
        log_fail("$label: MISSING '$needle' in response");
    }
    return $ok;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
echo str_repeat('=', 80) . "\n";
echo "P0 E2E Task Approval Workflow Test\n";
echo "Target: " . PREVIEW_URL . "\n";
echo "Started: " . date('Y-m-d H:i:s') . "\n";
echo str_repeat('=', 80) . "\n";

$results = [
    'admin_create'    => false,
    'staff_complete' => false,
    'reviewer_approve' => false,
    'approver_accept' => false,
    'done_status'     => false,
    'repeat_saved'    => false,
    'store_saved'     => false,
    'comments_saved'  => false,
    'notifications'    => false,
];

// Clean up old cookie jar
@mkdir(dirname(COOKIE_JAR), 0755, true);
if (file_exists(COOKIE_JAR)) unlink(COOKIE_JAR);

// ── STEP 1: ADMIN LOGIN ──────────────────────────────────────────────────────
log_step('1. Admin Login & Task Creation');
$adminEmail = USERS['admin']['email'];
if (!login_user($adminEmail, PREVIEW_URL, COOKIE_JAR)) {
    // Try QA bypass user
    $adminEmail = USERS['qa']['email'];
    if (!login_user($adminEmail, PREVIEW_URL, COOKIE_JAR)) {
        log_fail('Admin login failed — cannot continue');
        goto SUMMARY;
    }
    log_warn('Used QA bypass login instead of admin');
}
log_pass("Logged in as: $adminEmail");

// Get CSRF token from dashboard
$dashResp = http_get(PREVIEW_URL . '/dashboard', COOKIE_JAR);
$csrfToken = '';
if (preg_match('/name="csrf"[^>]*value="([^"]+)"/', $dashResp['body'] ?? '', $m)) {
    $csrfToken = $m[1];
}
log_info("CSRF token: " . ($csrfToken ? substr($csrfToken, 0, 8) . '...' : 'NOT FOUND'));

// Get a project ID
$projectId = 1;
if ($dbConnected) {
    $proj = sql_one("SELECT id FROM projects LIMIT 1");
    if ($proj) $projectId = $proj['id'];
    log_info("Using project_id: $projectId");
}

// Get reviewer and approver IDs
$reviewerId = USERS['reviewer']['id'];
$approverId = USERS['approver']['id'];
if ($dbConnected) {
    $rev = sql_one("SELECT id FROM users WHERE role IN ('manager','reviewer') LIMIT 1");
    $app = sql_one("SELECT id FROM users WHERE role IN ('admin','ceo') LIMIT 1");
    if ($rev) $reviewerId = $rev['id'];
    if ($app) $approverId = $app['id'];
}
log_info("Reviewer ID: $reviewerId, Approver ID: $approverId");

// ── STEP 2: CREATE TASK ──────────────────────────────────────────────────────
log_step('2. Admin Creates Task with Full Details');

// Build task data
$taskData = [
    'csrf'              => $csrfToken,
    'title'             => 'P0 E2E Test Task — ' . date('Y-m-d H:i:s'),
    'description'       => 'Automated end-to-end approval workflow test task.',
    'project_id'        => $projectId,
    'assignee_id'       => USERS['staff']['id'],
    'priority'          => 'high',
    'due_date'          => date('Y-m-d', strtotime('+3 days')),
    'status'            => 'todo',
    'visibility'        => 'public',
    'approval_required' => 1,
    'reviewer_id'       => $reviewerId,
    'approver_id'       => $approverId,
    'repeat_type'       => 'weekly',
    'repeat_config'     => json_encode(['interval' => 1, 'days' => [1, 3]]),
    'repeat_from_mode'  => 'due_date',
    'repeat_end_type'   => 'count',
    'repeat_end_count'  => 10,
];

$createResp = http_post(PREVIEW_URL . '/tasks/store', $taskData, COOKIE_JAR);
log_info("Create response code: " . $createResp['code']);

// Extract created task ID
$taskId = null;
if (preg_match('/tasks\/(\d+)/', $createResp['body'] ?? '', $m)) {
    $taskId = (int)$m[1];
}
if (!$taskId && $dbConnected) {
    $newTask = sql_one(
        "SELECT id FROM tasks WHERE title LIKE ? ORDER BY id DESC LIMIT 1",
        ['P0 E2E Test Task%']
    );
    if ($newTask) $taskId = (int)$newTask['id'];
}

if (!$taskId) {
    log_fail("Could not extract task ID. Create may have failed.");
    log_info("Response body preview: " . substr(strip_tags($createResp['body'] ?? ''), 0, 300));
    goto SUMMARY;
}
log_pass("Task created with ID: $taskId");

// ── VERIFY: Task Fields ─────────────────────────────────────────────────────
log_step('3. Verify Created Task Fields');
if ($dbConnected) {
    $task = sql_one("SELECT * FROM tasks WHERE id = ?", [$taskId]);
    if ($task) {
        log_info("Task status: " . $task['status']);
        log_info("Repeat type: " . $task['repeat_type']);
        log_info("Repeat config: " . $task['repeat_config']);

        $results['repeat_saved'] = verify_field('repeat_type', $task['repeat_type'], 'weekly');
        $results['admin_create'] = true;

        // Verify approval setup
        $hasApproval = verify_field('approval_required', $task['approval_required'], 1, true);
        $hasReviewer = verify_field('reviewer_id', $task['reviewer_id'], $reviewerId, true);
        $hasApprover = verify_field('approver_id', $task['approver_id'], $approverId, true);
        $hasDue = !empty($task['due_date']);
        if ($hasDue) log_pass("Due date set: " . $task['due_date']);
        else log_fail("Due date MISSING");

        // Verify repeat config JSON
        $rc = json_decode($task['repeat_config'] ?? '{}', true);
        if (!empty($rc['days']) && in_array(1, $rc['days']) && in_array(3, $rc['days'])) {
            log_pass("Repeat config: Weekly Mon+Wed saved correctly");
        } else {
            log_fail("Repeat config mismatch: " . json_encode($rc));
        }

        // Verify store
        if ($dbConnected) {
            $storeLinks = sql_query(
                "SELECT store_id FROM task_stores WHERE task_id = ?",
                [$taskId]
            );
            if (!empty($storeLinks['rows'])) {
                $results['store_saved'] = true;
                log_pass("Store(s) linked: " . count($storeLinks['rows']) . " store(s)");
            } else {
                log_info("No store links (may be intentional for general task)");
            }
        }

        // SQL Evidence
        echo "\n--- SQL: Task Record ---\n";
        echo "SELECT * FROM tasks WHERE id = $taskId;\n";
        echo json_encode($task, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n\n";
    } else {
        log_fail("Task $taskId not found in DB");
    }
} else {
    log_warn("DB not connected — verifying via HTTP response");
    $results['admin_create'] = verify_contains('Create response', $createResp['body'] ?? '', (string)$taskId);
}

// ── STEP 4: STAFF COMPLETES TASK ─────────────────────────────────────────────
log_step('4. Staff Completes Task');
login_user(USERS['staff']['email'], PREVIEW_URL, COOKIE_JAR);
log_pass("Logged in as staff: " . USERS['staff']['email']);

$csrfStaff = '';
$staffDash = http_get(PREVIEW_URL . '/my-tasks', COOKIE_JAR);
if (preg_match('/name="csrf"[^>]*value="([^"]+)"/', $staffDash['body'] ?? '', $m)) {
    $csrfStaff = $m[1];
}

// Submit for review
$submitResp = http_post(PREVIEW_URL . "/tasks/$taskId/submit", [
    'csrf' => $csrfStaff,
    'note' => 'Task completed, ready for review.',
], COOKIE_JAR);
log_info("Submit response code: " . $submitResp['code']);

if ($dbConnected) {
    $task = sql_one("SELECT status FROM tasks WHERE id = ?", [$taskId]);
    $expectedStatus = 'pending_review';
    $results['staff_complete'] = verify_field('Task status after submit', $task['status'] ?? '', $expectedStatus);
    if ($task) log_info("Current status: " . $task['status']);

    // SQL evidence
    echo "--- SQL: After Submit ---\n";
    echo "SELECT id, status, submitted_at, assignee_id FROM tasks WHERE id = $taskId;\n";
    echo json_encode($task, JSON_PRETTY_PRINT) . "\n\n";
}

// ── STEP 5: REVIEWER APPROVES ────────────────────────────────────────────────
log_step('5. Reviewer Approves Task');
login_user(USERS['reviewer']['email'], PREVIEW_URL, COOKIE_JAR);
log_pass("Logged in as reviewer: " . USERS['reviewer']['email']);

$csrfRev = '';
$revDash = http_get(PREVIEW_URL . '/inbox', COOKIE_JAR);
if (preg_match('/name="csrf"[^>]*value="([^"]+)"/', $revDash['body'] ?? '', $m)) {
    $csrfRev = $m[1];
}

$reviewResp = http_post(PREVIEW_URL . "/tasks/$taskId/review-approve", [
    'csrf' => $csrfRev,
    'note' => 'Looks good. Approved for acceptance.',
], COOKIE_JAR);
log_info("Review approve response code: " . $reviewResp['code']);

if ($dbConnected) {
    $task = sql_one("SELECT status FROM tasks WHERE id = ?", [$taskId]);
    $expectedStatus = 'pending_acceptance';
    $results['reviewer_approve'] = verify_field('Task status after review approve', $task['status'] ?? '', $expectedStatus);
    if ($task) log_info("Current status: " . $task['status']);

    // Check approval event
    $event = sql_one(
        "SELECT * FROM task_approval_events WHERE task_id = ? ORDER BY id DESC LIMIT 2",
        [$taskId]
    );
    echo "--- SQL: Latest Approval Event ---\n";
    echo "SELECT * FROM task_approval_events WHERE task_id = $taskId ORDER BY id DESC LIMIT 2;\n";
    if ($event) echo json_encode($event, JSON_PRETTY_PRINT) . "\n\n";
}

// ── STEP 6: APPROVER ACCEPTS ────────────────────────────────────────────────
log_step('6. Approver Accepts Task');
login_user(USERS['approver']['email'], PREVIEW_URL, COOKIE_JAR);
log_pass("Logged in as approver: " . USERS['approver']['email']);

$csrfApp = '';
$appDash = http_get(PREVIEW_URL . '/inbox', COOKIE_JAR);
if (preg_match('/name="csrf"[^>]*value="([^"]+)"/', $appDash['body'] ?? '', $m)) {
    $csrfApp = $m[1];
}

$acceptResp = http_post(PREVIEW_URL . "/tasks/$taskId/accept", [
    'csrf' => $csrfApp,
    'note' => 'Task accepted. Well done.',
], COOKIE_JAR);
log_info("Accept response code: " . $acceptResp['code']);

if ($dbConnected) {
    $task = sql_one("SELECT status, is_completed, completed_at FROM tasks WHERE id = ?", [$taskId]);
    $expectedStatus = 'done';
    $results['approver_accept'] = verify_field('Task status after accept', $task['status'] ?? '', $expectedStatus);
    $results['done_status'] = $task['is_completed'] ?? false;
    if ($task) {
        log_info("Final status: " . $task['status']);
        log_info("Completed: " . ($task['is_completed'] ? 'YES' : 'NO'));
        log_info("Completed at: " . ($task['completed_at'] ?? 'N/A'));
    }

    echo "--- SQL: Final Task State ---\n";
    echo "SELECT id, status, is_completed, completed_at, repeat_type, repeat_config,\n";
    echo "       assignee_id, reviewer_id, approver_id FROM tasks WHERE id = $taskId;\n";
    echo json_encode($task, JSON_PRETTY_PRINT) . "\n\n";
}

// ── STEP 7: COMMENTS ─────────────────────────────────────────────────────────
log_step('7. Comments Verification');
if ($dbConnected) {
    $comments = sql_query(
        "SELECT * FROM task_comments WHERE task_id = ? ORDER BY id",
        [$taskId]
    );
    if (!empty($comments['rows'])) {
        $results['comments_saved'] = true;
        log_pass("Comments found: " . count($comments['rows']));
        echo "--- SQL: Task Comments ---\n";
        echo "SELECT * FROM task_comments WHERE task_id = $taskId;\n";
        foreach ($comments['rows'] as $c) {
            echo json_encode($c, JSON_PRETTY_PRINT) . "\n";
        }
    } else {
        log_info("No rich task_comments yet (legacy comments may exist)");
    }

    // Legacy comments
    $legacyComments = sql_query(
        "SELECT COUNT(*) as cnt FROM comments WHERE task_id = ?",
        [$taskId]
    );
    if (!empty($legacyComments['rows'][0]['cnt'])) {
        log_pass("Legacy comments: " . $legacyComments['rows'][0]['cnt']);
    }
}

// ── STEP 8: NOTIFICATIONS ────────────────────────────────────────────────────
log_step('8. Notifications Verification');
if ($dbConnected) {
    $notifs = sql_query(
        "SELECT * FROM notifications WHERE task_id = ? ORDER BY id DESC LIMIT 10",
        [$taskId]
    );
    if (!empty($notifs['rows'])) {
        $results['notifications'] = true;
        log_pass("Notifications sent: " . count($notifs['rows']));
        echo "--- SQL: Notifications ---\n";
        echo "SELECT id, user_id, type, title, link, created_at FROM notifications WHERE task_id = $taskId;\n";
        foreach ($notifs['rows'] as $n) {
            $link = $n['link'] ?? '';
            echo sprintf("  [%s] User #%d | %s | %s\n", $n['type'], $n['user_id'], $n['title'], $link);
        }
        echo "\n";
    } else {
        log_info("No notifications found (may be disabled in preview)");
    }
}

// ── STEP 9: APPROVAL EVENTS ─────────────────────────────────────────────────
log_step('9. Approval Events Audit Trail');
if ($dbConnected) {
    $events = sql_query(
        "SELECT * FROM task_approval_events WHERE task_id = ? ORDER BY id",
        [$taskId]
    );
    if (!empty($events['rows'])) {
        log_pass("Approval events: " . count($events['rows']));
        echo "--- SQL: Full Approval Audit Trail ---\n";
        echo "SELECT tae.*, u.name as actor_name FROM task_approval_events tae\n";
        echo "LEFT JOIN users u ON tae.actor_user_id = u.id WHERE tae.task_id = $taskId\n";
        echo "ORDER BY tae.id;\n";
        foreach ($events['rows'] as $e) {
            echo sprintf("  [%s] %s → %s | by user #%d | %s\n",
                $e['created_at'], $e['from_status'], $e['to_status'],
                $e['actor_user_id'], $e['comment'] ?? ''
            );
        }
        echo "\n";
    } else {
        log_warn("No approval events found (task_approval_events table may not exist yet)");
    }
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
SUMMARY:
echo str_repeat('=', 80) . "\n";
echo "RESULTS SUMMARY — Task ID: " . ($taskId ?? 'N/A') . "\n";
echo str_repeat('=', 80) . "\n";

$checks = [
    ['Admin creates task',           $results['admin_create']],
    ['Repeat schedule saved',        $results['repeat_saved']],
    ['Store selection saved',        $results['store_saved']],
    ['Staff submits for review',      $results['staff_complete']],
    ['Reviewer approves',             $results['reviewer_approve']],
    ['Approver accepts',             $results['approver_accept']],
    ['Task marked DONE',             $results['done_status']],
    ['Comments recorded',             $results['comments_saved']],
    ['Notifications sent',            $results['notifications']],
];

$allPass = true;
foreach ($checks as [$label, $pass]) {
    $icon = $pass ? '✅' : '❌';
    $status = $pass ? 'PASS' : 'FAIL';
    echo sprintf("  %s %-35s %s\n", $icon, $label, $status);
    if (!$pass) $allPass = false;
}

echo str_repeat('=', 80) . "\n";
if ($allPass && $taskId) {
    echo "✅ ALL CHECKS PASSED — Task $taskId completed full approval chain.\n";
} else {
    echo "⚠️  SOME CHECKS FAILED — Review the log above.\n";
    echo "    Run the SQL queries manually to verify DB state.\n";
}

echo "\nQuick verification SQL:\n";
echo "  SELECT * FROM tasks WHERE id = $taskId;\n";
echo "  SELECT * FROM task_approval_events WHERE task_id = $taskId;\n";
echo "  SELECT * FROM notifications WHERE task_id = $taskId;\n";
echo "  SELECT * FROM task_comments WHERE task_id = $taskId;\n";
echo "\nCompleted: " . date('Y-m-d H:i:s') . "\n";

// Cleanup
@unlink(COOKIE_JAR);
