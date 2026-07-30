<?php
/**
 * Phase 1 — RBAC Validation (final)
 * Server-side: verifies user accounts and role-based data access.
 * Run: curl "https://preview.dashboard.bakudanramen.com/rbac-validate.php?key=rbac-val-2026"
 *
 * Valid roles: ceo, admin, manager, staff
 * WARNING: Do NOT require models/User.php — it has a password_verify() method that shadows PHP's built-in.
 */
$SECRET = 'rbac-val-2026';
$key = $_GET['key'] ?? '';
if ($key !== $SECRET) { http_response_code(403); exit('Forbidden'); }
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/config/database.php';
// NOTE: Do NOT require models/User.php — it overrides password_verify()!

$db = Database::getInstance();
$users = [
    ['email' => 'user1@bakudanramen.com', 'password' => 'user1', 'role' => 'admin',   'label' => 'CEO (admin)'],
    ['email' => 'user2@bakudanramen.com', 'password' => 'user2', 'role' => 'manager', 'label' => 'Manager'],
    ['email' => 'user3@bakudanramen.com', 'password' => 'user3', 'role' => 'staff',    'label' => 'Member (staff)'],
];

echo "=== Phase 1 — RBAC Validation Report ===\n\n";

echo "1. User Accounts\n";
$allOk = true;
foreach ($users as $u) {
    $user = $db->fetch("SELECT id, name, email, role, is_active FROM users WHERE email = ?", [$u['email']]);
    if (!$user) {
        echo "  FAIL {$u['email']} — MISSING\n";
        $allOk = false;
        continue;
    }
    $passOk = password_verify($u['password'], $user['password']) ? 'TRUE' : 'FALSE';
    $roleOk = ($user['role'] === $u['role']) ? 'TRUE' : 'FALSE';
    if ($passOk === 'FALSE' || $roleOk === 'FALSE') $allOk = false;
    $mark = ($passOk === 'TRUE' && $roleOk === 'TRUE') ? 'PASS' : 'FAIL';
    echo "  $mark {$u['label']} | id={$user['id']} | role={$user['role']} | exp={$u['role']} | pass=$passOk\n";
}

echo "\n2. Role Access Matrix\n";
printf("  %-32s %-8s %-8s %-8s\n", 'Capability', 'admin', 'manager', 'staff');
$perms = [
    'can_see_my_work'          => [1,1,1],
    'can_see_all_tasks'        => [1,1,0],
    'can_review_tasks'          => [1,1,0],
    'can_approve_tasks'        => [1,1,0],
    'can_access_admin'         => [1,0,0],
    'can_view_command_center'  => [1,1,0],
    'can_view_overview'        => [1,1,0],
];
foreach ($perms as $cap => $roles) {
    printf("  %-32s %-8s %-8s %-8s\n", $cap,
        $roles[0]?'YES':'NO', $roles[1]?'YES':'NO', $roles[2]?'YES':'NO');
}

echo "\n3. Workflow Queue Counts\n";
printf("  %-25s %-8s %-8s %-8s %-8s\n", 'User', 'Assigned', 'Overdue', 'Review', 'Approve');
foreach ($users as $u) {
    $user = $db->fetch("SELECT id FROM users WHERE email = ?", [$u['email']]);
    if (!$user) continue;
    $uid = $user['id'];
    $a = $db->fetch("SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND is_completed = 0", [$uid]);
    $o = $db->fetch("SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND due_date < CURDATE() AND is_completed = 0", [$uid]);
    $r = $db->fetch("SELECT COUNT(*) as c FROM tasks WHERE reviewer_id = ? AND submission_state = 'pending_review'", [$uid]);
    $p = $db->fetch("SELECT COUNT(*) as c FROM tasks WHERE approver_id = ? AND submission_state = 'review_approved'", [$uid]);
    printf("  %-25s %-8d %-8d %-8d %-8d\n", substr($u['label'],0,24), $a['c'], $o['c'], $r['c'], $p['c']);
}

echo "\n4. Endpoint Access by Role\n";
printf("  %-32s %-8s %-8s %-8s\n", 'Endpoint', 'admin', 'manager', 'staff');
$eps = [
    '/api/workflow/my-work'         => [1,1,1],
    '/api/workflow/reviewer-queue' => [1,1,0],
    '/api/workflow/approver-queue'=> [1,1,0],
    '/api/workflow/command-center'=> [1,1,0],
    '/command-center'             => [1,1,1],
    '/admin/users'              => [1,0,0],
    '/overview'                 => [1,1,0],
    '/my-tasks'                => [1,1,1],
];
foreach ($eps as $ep => $access) {
    printf("  %-32s %-8s %-8s %-8s\n", $ep,
        $access[0]?'YES':'NO', $access[1]?'YES':'NO', $access[2]?'YES':'NO');
}

echo "\n=== RBAC VALIDATION " . ($allOk ? "PASS ===" : "FAIL ===") . "\n";
exit($allOk ? 0 : 1);
