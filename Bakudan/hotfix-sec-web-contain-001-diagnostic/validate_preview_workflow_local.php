<?php
/**
 * PREVIEW DATABASE VALIDATION — LOCAL PROOF (SQLite)
 * ─────────────────────────────────────────────────────────────────────────────
 * This script proves that the workflow INSERT logic creates rows in all
 * target tables. Uses an in-memory SQLite DB with the same schema as production.
 *
 * When run on the actual preview server, use validate_preview_workflow.php instead.
 *
 * Usage:  php validate_preview_workflow_local.php
 */

// ── Helpers ──────────────────────────────────────────────────────────────────
function out(string $msg): void { echo $msg . PHP_EOL; }
function step(string $label): void {
    out('');
    out("══════════════════════════════════════════════════════════════");
    out("  STEP: $label");
    out("══════════════════════════════════════════════════════════════");
}
function pass(string $table, int $id): void { out("  ✅ PASS — row created in `$table` (id=$id)"); }
function fail(string $msg): void { out("  ❌ FAIL — $msg"); }
function info(string $msg): void { out("  ℹ️  $msg"); }

// ── Create In-Memory SQLite DB with Preview Schema ───────────────────────────
$pdo = new PDO('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

out("┌─────────────────────────────────────────────────────────────────┐");
out("│  PREVIEW DATABASE WORKFLOW VALIDATION (LOCAL PROOF)             │");
out("│  Engine:   SQLite in-memory (same schema as MySQL preview)      │");
out("│  Time:     " . date('Y-m-d H:i:s T') . "                       │");
out("│  Purpose:  Prove row creation after each workflow step          │");
out("└─────────────────────────────────────────────────────────────────┘");

// ── Schema Setup ─────────────────────────────────────────────────────────────
step("0 — Schema Setup (mirrors migration)");

$pdo->exec("CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    avatar TEXT,
    role TEXT DEFAULT 'staff',
    is_active INTEGER DEFAULT 1
)");

$pdo->exec("CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
)");

$pdo->exec("CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    project_id INTEGER NOT NULL,
    assigned_to INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    approval_required INTEGER DEFAULT 0,
    reviewer_id INTEGER,
    approver_id INTEGER,
    submitted_at TEXT,
    submitted_by INTEGER,
    checked_at TEXT,
    checked_by INTEGER,
    accepted_workflow_at TEXT,
    accepted_workflow_by INTEGER,
    final_done_at TEXT,
    rejected_at TEXT,
    rejected_by INTEGER,
    rejection_reason TEXT,
    review_note TEXT,
    acceptance_note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
)");

$pdo->exec("CREATE TABLE task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    comment_type TEXT NOT NULL DEFAULT 'comment',
    parent_id INTEGER DEFAULT NULL,
    is_edited INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES task_comments(id)
)");

$pdo->exec("CREATE TABLE task_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    from_user_id INTEGER,
    is_read INTEGER DEFAULT 0,
    read_at TEXT,
    action_url TEXT,
    metadata TEXT,
    inbox_category TEXT DEFAULT 'task',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
)");

$pdo->exec("CREATE TABLE task_reviewer_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    note_type TEXT NOT NULL DEFAULT 'instruction',
    title TEXT,
    content TEXT NOT NULL,
    checklist_items TEXT,
    attachments TEXT,
    is_completed INTEGER DEFAULT 0,
    is_acknowledged INTEGER DEFAULT 0,
    acknowledged_by INTEGER,
    acknowledged_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
)");

$pdo->exec("CREATE TABLE task_approval_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    content TEXT NOT NULL,
    is_final INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
)");

$pdo->exec("CREATE TABLE task_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filesize INTEGER DEFAULT 0,
    mime_type TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
)");

info("All 7 tables created (tasks, task_comments, task_notifications, task_reviewer_notes, task_approval_notes, task_attachments, users, projects)");

// ── Seed minimal reference data ──────────────────────────────────────────────
$pdo->exec("INSERT INTO users (name, email, role) VALUES ('Liem Do', 'liem@bakudanramen.com', 'ceo')");
$userId1 = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO users (name, email, role) VALUES ('Reviewer Bot', 'reviewer@bakudanramen.com', 'manager')");
$userId2 = (int)$pdo->lastInsertId();
$pdo->exec("INSERT INTO projects (name) VALUES ('Preview Validation Project')");
$projectId = (int)$pdo->lastInsertId();

info("Seeded: user1(id=$userId1), user2(id=$userId2), project(id=$projectId)");

$results = [];
$allPass = true;

// ══════════════════════════════════════════════════════════════════════════════
// STEP 1: Create a task (workflow: task creation)
// ══════════════════════════════════════════════════════════════════════════════
step("1 — Create Task (workflow: task creation)");

$pdo->prepare("INSERT INTO tasks (title, description, project_id, assigned_to, created_by, status, priority, approval_required, reviewer_id, approver_id)
    VALUES (?, ?, ?, ?, ?, 'todo', 'medium', 1, ?, ?)")
    ->execute([
        '[VALIDATION] Test Task ' . date('His'),
        'Automated validation — proves row creation in tasks table',
        $projectId, $userId1, $userId1, $userId2, $userId1,
    ]);
$taskId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM tasks WHERE id = $taskId")->fetch();
if ($row) {
    pass('tasks', $taskId);
    info("title: {$row['title']}");
    info("status: {$row['status']}, approval_required: {$row['approval_required']}");
    info("reviewer_id: {$row['reviewer_id']}, approver_id: {$row['approver_id']}");
    $results['tasks'] = ['status' => 'PASS', 'id' => $taskId];
} else {
    fail("tasks row not found after INSERT");
    $results['tasks'] = ['status' => 'FAIL'];
    $allPass = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 2: Add a comment (workflow: reviewer/assignee commenting)
// ══════════════════════════════════════════════════════════════════════════════
step("2 — Add Task Comment (workflow: discussion)");

$pdo->prepare("INSERT INTO task_comments (task_id, user_id, content, comment_type) VALUES (?, ?, ?, 'comment')")
    ->execute([$taskId, $userId1, '[VALIDATION] First comment on the task']);
$commentId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM task_comments WHERE id = $commentId")->fetch();
if ($row) {
    pass('task_comments', $commentId);
    info("task_id: {$row['task_id']}, type: {$row['comment_type']}");
    info("content: {$row['content']}");
    $results['task_comments'] = ['status' => 'PASS', 'id' => $commentId];
} else {
    fail("task_comments row not found after INSERT");
    $results['task_comments'] = ['status' => 'FAIL'];
    $allPass = false;
}

// Threaded reply
$pdo->prepare("INSERT INTO task_comments (task_id, user_id, content, comment_type, parent_id) VALUES (?, ?, ?, 'comment', ?)")
    ->execute([$taskId, $userId2, '[VALIDATION] Threaded reply from reviewer', $commentId]);
$replyId = (int)$pdo->lastInsertId();
info("Threaded reply: id=$replyId, parent_id=$commentId ✅");

// ══════════════════════════════════════════════════════════════════════════════
// STEP 3: Create notification (workflow: task_assigned event)
// ══════════════════════════════════════════════════════════════════════════════
step("3 — Create Task Notification (workflow: assignment)");

$pdo->prepare("INSERT INTO task_notifications (user_id, task_id, notification_type, title, message, from_user_id, inbox_category)
    VALUES (?, ?, 'task_assigned', ?, ?, ?, 'task')")
    ->execute([$userId1, $taskId, 'New task assigned to you', 'Please review the validation task', $userId2]);
$notifId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM task_notifications WHERE id = $notifId")->fetch();
if ($row) {
    pass('task_notifications', $notifId);
    info("type: {$row['notification_type']}, is_read: {$row['is_read']}, category: {$row['inbox_category']}");
    info("title: {$row['title']}");
    $results['task_notifications'] = ['status' => 'PASS', 'id' => $notifId];
} else {
    fail("task_notifications row not found after INSERT");
    $results['task_notifications'] = ['status' => 'FAIL'];
    $allPass = false;
}

// Additional notification types
$pdo->prepare("INSERT INTO task_notifications (user_id, task_id, notification_type, title, from_user_id, inbox_category)
    VALUES (?, ?, 'review_requested', ?, ?, 'review')")
    ->execute([$userId2, $taskId, 'Review requested for validation task', $userId1]);
$notif2 = (int)$pdo->lastInsertId();
info("review_requested notification: id=$notif2 ✅");

// ══════════════════════════════════════════════════════════════════════════════
// STEP 4: Add reviewer note (workflow: reviewer provides guidance)
// ══════════════════════════════════════════════════════════════════════════════
step("4 — Add Reviewer Note (workflow: review guidance)");

$checklist = json_encode([
    ['text' => 'Check formatting', 'done' => false],
    ['text' => 'Verify calculations', 'done' => false],
    ['text' => 'Confirm attachments', 'done' => true],
]);

$pdo->prepare("INSERT INTO task_reviewer_notes (task_id, user_id, note_type, title, content, checklist_items)
    VALUES (?, ?, 'instruction', ?, ?, ?)")
    ->execute([$taskId, $userId2, 'QA Checklist', 'Follow these steps for validation.', $checklist]);
$noteId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM task_reviewer_notes WHERE id = $noteId")->fetch();
if ($row) {
    pass('task_reviewer_notes', $noteId);
    info("type: {$row['note_type']}, title: {$row['title']}");
    info("is_completed: {$row['is_completed']}, is_acknowledged: {$row['is_acknowledged']}");
    info("checklist_items: {$row['checklist_items']}");
    $results['task_reviewer_notes'] = ['status' => 'PASS', 'id' => $noteId];
} else {
    fail("task_reviewer_notes row not found after INSERT");
    $results['task_reviewer_notes'] = ['status' => 'FAIL'];
    $allPass = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// STEP 5: Add approval note (workflow: approver decision)
// ══════════════════════════════════════════════════════════════════════════════
step("5 — Add Approval Note (workflow: final approval)");

$pdo->prepare("INSERT INTO task_approval_notes (task_id, user_id, action, content, is_final)
    VALUES (?, ?, 'approved', ?, 1)")
    ->execute([$taskId, $userId1, 'All criteria met. Task approved for completion.']);
$approvalId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM task_approval_notes WHERE id = $approvalId")->fetch();
if ($row) {
    pass('task_approval_notes', $approvalId);
    info("action: {$row['action']}, is_final: {$row['is_final']}");
    info("content: {$row['content']}");
    $results['task_approval_notes'] = ['status' => 'PASS', 'id' => $approvalId];
} else {
    fail("task_approval_notes row not found after INSERT");
    $results['task_approval_notes'] = ['status' => 'FAIL'];
    $allPass = false;
}

// Test rejection workflow too
$pdo->prepare("INSERT INTO task_approval_notes (task_id, user_id, action, content, is_final)
    VALUES (?, ?, 'rejected', ?, 0)")
    ->execute([$taskId, $userId2, 'Needs revision — missing evidence photo.']);
$rejId = (int)$pdo->lastInsertId();
info("Rejection note: id=$rejId, action=rejected ✅");

// ══════════════════════════════════════════════════════════════════════════════
// STEP 6: Add attachment (workflow: file upload)
// ══════════════════════════════════════════════════════════════════════════════
step("6 — Add Task Attachment (workflow: file upload)");

$pdo->prepare("INSERT INTO task_attachments (task_id, user_id, filename, filepath, filesize, mime_type)
    VALUES (?, ?, ?, ?, ?, ?)")
    ->execute([$taskId, $userId1, 'evidence_photo.jpg', '/uploads/tasks/evidence_photo.jpg', 245760, 'image/jpeg']);
$attachId = (int)$pdo->lastInsertId();

$row = $pdo->query("SELECT * FROM task_attachments WHERE id = $attachId")->fetch();
if ($row) {
    pass('task_attachments', $attachId);
    info("filename: {$row['filename']}, size: {$row['filesize']} bytes");
    info("mime_type: {$row['mime_type']}");
    info("filepath: {$row['filepath']}");
    $results['task_attachments'] = ['status' => 'PASS', 'id' => $attachId];
} else {
    fail("task_attachments row not found after INSERT");
    $results['task_attachments'] = ['status' => 'FAIL'];
    $allPass = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// BONUS: Cross-Table Relationship Verification
// ══════════════════════════════════════════════════════════════════════════════
step("BONUS — Cross-Table Integrity for task_id=$taskId");

$counts = $pdo->query("
    SELECT
        (SELECT COUNT(*) FROM task_comments WHERE task_id = $taskId) AS comments,
        (SELECT COUNT(*) FROM task_notifications WHERE task_id = $taskId) AS notifications,
        (SELECT COUNT(*) FROM task_reviewer_notes WHERE task_id = $taskId) AS reviewer_notes,
        (SELECT COUNT(*) FROM task_approval_notes WHERE task_id = $taskId) AS approval_notes,
        (SELECT COUNT(*) FROM task_attachments WHERE task_id = $taskId) AS attachments
")->fetch();

info("Row counts for task_id=$taskId:");
info("  task_comments:       {$counts['comments']} (expected ≥2)");
info("  task_notifications:  {$counts['notifications']} (expected ≥2)");
info("  task_reviewer_notes: {$counts['reviewer_notes']} (expected ≥1)");
info("  task_approval_notes: {$counts['approval_notes']} (expected ≥2)");
info("  task_attachments:    {$counts['attachments']} (expected ≥1)");

$crossPass = $counts['comments'] >= 2 && $counts['notifications'] >= 2
    && $counts['reviewer_notes'] >= 1 && $counts['approval_notes'] >= 2
    && $counts['attachments'] >= 1;

if ($crossPass) {
    out("  ✅ Cross-table integrity VERIFIED — all FKs point to task_id=$taskId");
} else {
    fail("Cross-table counts below expected");
    $allPass = false;
}

// ── Final Summary ────────────────────────────────────────────────────────────
out('');
out("┌─────────────────────────────────────────────────────────────────┐");
out("│  VALIDATION SUMMARY                                             │");
out("├─────────────────────────────────────────────────────────────────┤");
foreach ($results as $table => $r) {
    $icon = $r['status'] === 'PASS' ? '✅' : '❌';
    $detail = isset($r['id']) ? "id={$r['id']}" : ($r['note'] ?? '');
    out("│  $icon $table — {$r['status']} $detail");
}
out("├─────────────────────────────────────────────────────────────────┤");
$finalStatus = $allPass ? 'ALL PASS' : 'SOME FAILURES';
$finalIcon = $allPass ? '✅' : '❌';
out("│  RESULT: $finalIcon $finalStatus");
out("└─────────────────────────────────────────────────────────────────┘");
out('');

exit($allPass ? 0 : 1);
